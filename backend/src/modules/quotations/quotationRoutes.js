import express from 'express';
import prisma from '../../db/prisma.js';
import { authenticateUser } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { calculateQuotationTotals } from '../../services/pricingEngine.js';
import { evaluateQuotationRisk } from '../../services/discountRiskService.js';
import { getQuoteRecommendations } from '../../services/recommendationService.js';
import { logAudit } from '../../utils/audit.js';

const router = express.Router();

router.use(authenticateUser);
router.use(resolveTenant);

// Helper: Generate sequential quote number e.g. DF360-2026-000001
async function generateQuoteNumber(tenantId) {
  const currentYear = new Date().getFullYear();
  const count = await prisma.quotation.count({
    where: { tenantId },
  });
  const seq = String(count + 1).padStart(6, '0');
  return `DF360-${currentYear}-${seq}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quotations/calculate
// Section 13 & 21: Real-Time Live Pricing, Margin, Risk & Recommendations
// ─────────────────────────────────────────────────────────────────────────────
router.post('/calculate', async (req, res) => {
  try {
    const { items = [], customerTier = 'BRONZE' } = req.body;

    if (!items || items.length === 0) {
      return res.json({
        success: true,
        data: {
          pricing: calculateQuotationTotals([]),
          risk: {
            riskScore: 0,
            riskLevel: 'LOW',
            reasons: ['No products added to quote.'],
            approvalRequired: false,
            requiredApproverRole: null,
            violations: [],
          },
          recommendations: await getQuoteRecommendations(req.tenantId, []),
        },
      });
    }

    // 1. Enrich items with authoritative database product pricing and cost
    const productIds = items.map((i) => i.productId).filter(Boolean);
    const dbProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId: req.tenantId,
      },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    const enrichedItems = items.map((item) => {
      const dbProduct = productMap.get(item.productId);
      return {
        ...item,
        productNameSnapshot: dbProduct ? dbProduct.name : item.name,
        productTypeSnapshot: dbProduct ? dbProduct.type : item.type || 'HARDWARE',
        unitPrice: dbProduct ? parseFloat(dbProduct.unitPrice) : parseFloat(item.unitPrice) || 0,
        costPrice: dbProduct ? parseFloat(dbProduct.costPrice) : 0,
        taxRate: dbProduct ? parseFloat(dbProduct.taxRate) : 18.0,
        maxDiscountPercentage: dbProduct ? parseFloat(dbProduct.maxDiscountPercentage) : 15.0,
      };
    });

    // 2. Compute Pricing & Margin
    const pricing = calculateQuotationTotals(enrichedItems);

    // 3. Compute Discount Risk against Admin Rules
    const risk = await evaluateQuotationRisk(
      req.tenantId,
      pricing.items,
      customerTier,
      pricing.marginPercentage
    );

    // 4. Compute Dynamic Cross-sell / Upsell Recommendations
    const recommendations = await getQuoteRecommendations(req.tenantId, pricing.items);

    res.json({
      success: true,
      data: {
        pricing,
        risk,
        recommendations,
      },
    });
  } catch (err) {
    console.error('[CPQ] Live calculation error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'CALCULATION_ERROR', message: 'Failed to calculate quote pricing and risk.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quotations/my
// Section 5: List Deals belonging to Current Sales Representative
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my', async (req, res) => {
  try {
    const { status, riskLevel, search } = req.query;

    const whereClause = {
      tenantId: req.tenantId,
    };

    // If Sales Rep, show only their own deals (Section 33)
    if (req.user.role === 'SALES_REP') {
      whereClause.salesRepId = req.user.id;
    }

    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    if (riskLevel && riskLevel !== 'ALL') {
      whereClause.riskLevel = riskLevel;
    }

    if (search) {
      whereClause.OR = [
        { quoteNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { companyName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const quotes = await prisma.quotation.findMany({
      where: whereClause,
      include: {
        customer: { select: { id: true, name: true, companyName: true, tier: true, email: true } },
        salesRep: { select: { id: true, name: true, email: true } },
        _count: { select: { items: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      success: true,
      data: quotes,
    });
  } catch (err) {
    console.error('[QUOTES] My quotes fetch error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve quotations.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quotations/:id
// Section 30: Detailed Quotation View
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const quote = await prisma.quotation.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId,
      },
      include: {
        customer: true,
        salesRep: { select: { id: true, name: true, email: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, isInventoryTracked: true } },
          },
        },
      },
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation not found.' },
      });
    }

    // Ownership check: sales reps can only see their own quotes (Section 33)
    if (req.user.role === 'SALES_REP' && quote.salesRepId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied to this quotation.' },
      });
    }

    res.json({
      success: true,
      data: quote,
    });
  } catch (err) {
    console.error('[QUOTES] Detail fetch error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve quotation details.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quotations
// Section 8 & 28: Create New Draft Quotation
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { customerId, items = [], notes = '' } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer is required to create a quotation.' },
      });
    }

    // Verify customer exists within tenant
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: req.tenantId },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Selected customer not found in organization.' },
      });
    }

    // Generate unique sequential quote number
    const quoteNumber = await generateQuoteNumber(req.tenantId);

    // Fetch authoritative product snapshots from DB
    const productIds = items.map((i) => i.productId).filter(Boolean);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId: req.tenantId },
    });
    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    const enrichedItems = items.map((item) => {
      const dbProduct = productMap.get(item.productId);
      if (!dbProduct) {
        throw new Error(`Product ${item.productId} not found in catalog.`);
      }
      return {
        productId: dbProduct.id,
        productNameSnapshot: dbProduct.name,
        productTypeSnapshot: dbProduct.type,
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
        unitPrice: parseFloat(dbProduct.unitPrice),
        costPrice: parseFloat(dbProduct.costPrice || 0),
        taxRate: parseFloat(dbProduct.taxRate || 18.0),
        discountPercentage: Math.min(100, Math.max(0, parseFloat(item.discountPercentage) || 0)),
      };
    });

    // Authoritative totals & risk
    const pricing = calculateQuotationTotals(enrichedItems);
    const risk = await evaluateQuotationRisk(
      req.tenantId,
      pricing.items,
      customer.tier,
      pricing.marginPercentage
    );

    // Create quotation & items in atomic transaction
    const newQuote = await prisma.$transaction(async (tx) => {
      const quote = await tx.quotation.create({
        data: {
          tenantId: req.tenantId,
          quoteNumber,
          customerId: customer.id,
          salesRepId: req.user.id,
          status: 'DRAFT',
          approvalStatus: 'NONE',
          subtotal: pricing.subtotal,
          discountAmount: pricing.discountAmount,
          taxAmount: pricing.taxAmount,
          totalAmount: pricing.totalAmount,
          costAmount: pricing.costAmount,
          marginAmount: pricing.marginAmount,
          marginPercentage: pricing.marginPercentage,
          riskScore: risk.riskScore,
          riskLevel: risk.riskLevel,
          riskReasons: risk.reasons,
          requiredApproverRole: risk.requiredApproverRole,
          notes,
          items: {
            create: pricing.items.map((it) => ({
              productId: it.productId,
              productNameSnapshot: it.productNameSnapshot,
              productTypeSnapshot: it.productTypeSnapshot,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              costPrice: it.costPrice,
              discountPercentage: it.discountPercentage,
              discountAmount: it.discountAmount,
              taxAmount: it.taxAmount,
              lineTotal: it.lineTotal,
              marginAmount: it.marginAmount,
              marginPercentage: it.marginPercentage,
            })),
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });

      await logAudit({
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'QUOTE_CREATED',
        entityType: 'QUOTATION',
        entityId: quote.id,
        metadata: { quoteNumber, totalAmount: pricing.totalAmount, riskLevel: risk.riskLevel },
      });

      return quote;
    });

    console.log(`📝 [CPQ] Created Quotation ${newQuote.quoteNumber} (Total: ₹${pricing.totalAmount})`);

    res.status(201).json({
      success: true,
      data: newQuote,
    });
  } catch (err) {
    console.error('[QUOTES] Create error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_ERROR', message: err.message || 'Failed to create quotation.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/quotations/:id
// Section 28: Save / Update Draft Quotation
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const quote = await prisma.quotation.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { customer: true },
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation not found.' },
      });
    }

    // Ownership check
    if (req.user.role === 'SALES_REP' && quote.salesRepId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied.' },
      });
    }

    // State machine check: only DRAFT, REJECTED, or RETURNED_FOR_REVISION quotes can be modified (Section 17 & 27)
    if (quote.status !== 'DRAFT' && quote.status !== 'REJECTED' && quote.status !== 'RETURNED_FOR_REVISION') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Cannot edit quote with status ${quote.status}. Only DRAFT or RETURNED_FOR_REVISION quotations can be modified.`,
        },
      });
    }

    const { customerId, items = [], notes } = req.body;

    // Customer
    const activeCustomerId = customerId || quote.customerId;
    const customer = await prisma.customer.findFirst({
      where: { id: activeCustomerId, tenantId: req.tenantId },
    });

    // Authoritative product lookup
    const productIds = items.map((i) => i.productId).filter(Boolean);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId: req.tenantId },
    });
    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    const enrichedItems = items.map((item) => {
      const dbProduct = productMap.get(item.productId);
      if (!dbProduct) {
        throw new Error(`Product ${item.productId} not found.`);
      }
      return {
        productId: dbProduct.id,
        productNameSnapshot: dbProduct.name,
        productTypeSnapshot: dbProduct.type,
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
        unitPrice: parseFloat(dbProduct.unitPrice),
        costPrice: parseFloat(dbProduct.costPrice || 0),
        taxRate: parseFloat(dbProduct.taxRate || 18.0),
        discountPercentage: Math.min(100, Math.max(0, parseFloat(item.discountPercentage) || 0)),
      };
    });

    const pricing = calculateQuotationTotals(enrichedItems);
    const risk = await evaluateQuotationRisk(
      req.tenantId,
      pricing.items,
      customer ? customer.tier : 'BRONZE',
      pricing.marginPercentage
    );

    const updatedQuote = await prisma.$transaction(async (tx) => {
      // Delete old line items
      await tx.quotationItem.deleteMany({
        where: { quotationId: quote.id },
      });

      // Update quote with new authoritative totals & items
      const updated = await tx.quotation.update({
        where: { id: quote.id },
        data: {
          customerId: activeCustomerId,
          subtotal: pricing.subtotal,
          discountAmount: pricing.discountAmount,
          taxAmount: pricing.taxAmount,
          totalAmount: pricing.totalAmount,
          costAmount: pricing.costAmount,
          marginAmount: pricing.marginAmount,
          marginPercentage: pricing.marginPercentage,
          riskScore: risk.riskScore,
          riskLevel: risk.riskLevel,
          riskReasons: risk.reasons,
          requiredApproverRole: risk.requiredApproverRole,
          notes: notes !== undefined ? notes : quote.notes,
          items: {
            create: pricing.items.map((it) => ({
              productId: it.productId,
              productNameSnapshot: it.productNameSnapshot,
              productTypeSnapshot: it.productTypeSnapshot,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              costPrice: it.costPrice,
              discountPercentage: it.discountPercentage,
              discountAmount: it.discountAmount,
              taxAmount: it.taxAmount,
              lineTotal: it.lineTotal,
              marginAmount: it.marginAmount,
              marginPercentage: it.marginPercentage,
            })),
          },
        },
        include: { items: true, customer: true },
      });

      await logAudit({
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'QUOTE_UPDATED',
        entityType: 'QUOTATION',
        entityId: quote.id,
        metadata: { quoteNumber: quote.quoteNumber, totalAmount: pricing.totalAmount },
      });

      return updated;
    });

    res.json({
      success: true,
      data: updatedQuote,
    });
  } catch (err) {
    console.error('[QUOTES] Update error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: err.message || 'Failed to update quotation.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quotations/:id/submit
// Section 25, 26, 44 & 45: Submit Quote & Enforce Non-Bypassable Approvals
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/submit', async (req, res) => {
  try {
    const quote = await prisma.quotation.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation not found.' },
      });
    }

    // Ownership check
    if (req.user.role === 'SALES_REP' && quote.salesRepId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied.' },
      });
    }

    // Section 45: Idempotency protection against duplicate submit
    if (quote.status === 'PENDING_APPROVAL') {
      return res.json({
        success: true,
        message: 'Quotation has already been submitted and is currently pending approval.',
        data: quote,
      });
    }

    if (quote.status === 'APPROVED' || quote.status === 'SENT_TO_CUSTOMER') {
      return res.json({
        success: true,
        message: 'Quotation is already approved.',
        data: quote,
      });
    }

    if (!quote.items || quote.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMPTY_QUOTE', message: 'Cannot submit a quotation with zero items.' },
      });
    }

    // Section 25 & 34: Authoritative backend recalculation before final state transition
    const enrichedItems = quote.items.map((item) => ({
      productId: item.productId,
      productNameSnapshot: item.productNameSnapshot,
      productTypeSnapshot: item.productTypeSnapshot,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice),
      costPrice: parseFloat(item.costPrice),
      taxRate: parseFloat(item.taxAmount > 0 && item.lineTotal > 0 ? (item.taxAmount / (item.lineTotal - item.taxAmount)) * 100 : 18.0),
      discountPercentage: parseFloat(item.discountPercentage),
    }));

    const pricing = calculateQuotationTotals(enrichedItems);
    const risk = await evaluateQuotationRisk(
      req.tenantId,
      pricing.items,
      quote.customer ? quote.customer.tier : 'BRONZE',
      pricing.marginPercentage
    );

    // Section 25: Determine final status
    let finalStatus = 'APPROVED';
    let approvalStatus = 'APPROVED';
    let responseMessage = 'Quotation approved and ready for customer presentation.';

    const isResubmission = quote.status === 'RETURNED_FOR_REVISION';

    if (risk.approvalRequired) {
      finalStatus = 'PENDING_APPROVAL';
      approvalStatus =
        risk.requiredApproverRole === 'FINANCE_OPERATIONS'
          ? 'PENDING_FINANCE'
          : 'PENDING_MANAGER';
      responseMessage = `Quotation submitted for ${
        risk.requiredApproverRole === 'FINANCE_OPERATIONS' ? 'Finance' : 'Sales Manager'
      } approval due to discount ceiling rules.`;
    }

    // Atomic submission transaction (Section 44)
    const submittedQuote = await prisma.$transaction(async (tx) => {
      const updated = await tx.quotation.update({
        where: { id: quote.id },
        data: {
          status: finalStatus,
          approvalStatus,
          subtotal: pricing.subtotal,
          discountAmount: pricing.discountAmount,
          taxAmount: pricing.taxAmount,
          totalAmount: pricing.totalAmount,
          costAmount: pricing.costAmount,
          marginAmount: pricing.marginAmount,
          marginPercentage: pricing.marginPercentage,
          riskScore: risk.riskScore,
          riskLevel: risk.riskLevel,
          riskReasons: risk.reasons,
          requiredApproverRole: risk.requiredApproverRole,
        },
        include: {
          customer: true,
          items: true,
          salesRep: { select: { id: true, name: true, email: true } },
        },
      });

      // If approval is required, create pending task record
      if (risk.approvalRequired) {
        await tx.approval.create({
          data: {
            tenantId: req.tenantId,
            quotationId: quote.id,
            approverRole: approvalStatus === 'PENDING_FINANCE' ? 'FINANCE_OPERATIONS' : 'SALES_MANAGER',
            level: approvalStatus === 'PENDING_FINANCE' ? 'FINANCE_OPERATIONS' : 'SALES_MANAGER',
            status: approvalStatus,
            riskScoreAtDecision: risk.riskScore,
            marginPercentageAtDecision: pricing.marginPercentage,
            discountAmountAtDecision: pricing.discountAmount,
          },
        });
      }

      await logAudit({
        tenantId: req.tenantId,
        userId: req.user.id,
        action: isResubmission ? 'QUOTE_RESUBMITTED' : 'QUOTE_SUBMITTED',
        entityType: 'QUOTATION',
        entityId: quote.id,
        metadata: {
          quoteNumber: quote.quoteNumber,
          status: finalStatus,
          riskScore: risk.riskScore,
          approvalRequired: risk.approvalRequired,
          totalAmount: pricing.totalAmount,
          isResubmission,
        },
      });

      return updated;
    });

    console.log(
      `🚀 [CPQ] Quote Submitted: ${submittedQuote.quoteNumber} | Status: ${submittedQuote.status} (${submittedQuote.approvalStatus}) | Risk: ${submittedQuote.riskLevel}`
    );

    res.json({
      success: true,
      message: responseMessage,
      data: submittedQuote,
    });
  } catch (err) {
    console.error('[QUOTES] Submit error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SUBMISSION_ERROR', message: err.message || 'Failed to submit quotation.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quotations/:id/send-to-customer
// Present quote to customer Deal Room
// ─────────────────────────────────────────────────────────────────────────────
async function handleSendToCustomer(req, res) {
  try {
    const quote = await prisma.quotation.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { customer: true },
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation not found.' },
      });
    }

    if (quote.status === 'PENDING_APPROVAL') {
      return res.status(400).json({
        success: false,
        error: { code: 'APPROVAL_PENDING', message: 'Cannot send quotation to customer while approval is pending.' },
      });
    }

    const { validityDays = 14, notes } = req.body;
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + parseInt(validityDays, 10));

    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.update({
        where: { id: quote.id },
        data: {
          status: 'SENT_TO_CUSTOMER',
          validUntil: validUntilDate,
          notes: notes !== undefined ? notes : quote.notes,
        },
        include: {
          customer: true,
          items: true,
          salesRep: { select: { id: true, name: true, email: true } },
        },
      });

      // In-app notification for customer
      await tx.customerNotification.create({
        data: {
          tenantId: req.tenantId,
          customerId: quote.customerId,
          title: `New Quotation Received: ${quote.quoteNumber}`,
          message: `Your sales representative has shared quotation ${quote.quoteNumber} for review. Valid until ${validUntilDate.toLocaleDateString()}.`,
          link: `/customer/quotes/${quote.id}`,
        },
      });

      await logAudit({
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'QUOTE_SENT_TO_CUSTOMER',
        entityType: 'QUOTATION',
        entityId: quote.id,
        metadata: {
          quoteNumber: quote.quoteNumber,
          customerId: quote.customerId,
          validUntil: validUntilDate.toISOString(),
        },
      });

      return q;
    });

    console.log(`📤 [CPQ] Quote Sent To Customer: ${updated.quoteNumber} -> Customer: ${updated.customer.name}`);

    res.json({
      success: true,
      message: `Quotation ${updated.quoteNumber} has been delivered to customer deal room.`,
      data: updated,
    });
  } catch (err) {
    console.error('[QUOTES] Send to customer error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SEND_ERROR', message: err.message || 'Failed to send quotation.' },
    });
  }
}

router.post('/:id/send', handleSendToCustomer);
router.post('/:id/send-to-customer', handleSendToCustomer);

export default router;
