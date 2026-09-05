import express from 'express';
import prisma from '../../db/prisma.js';
import { authenticateUser } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { calculateQuotationTotals } from '../../services/pricingEngine.js';
import { evaluateQuotationRisk } from '../../services/discountRiskService.js';
import { getQuoteRecommendations } from '../../services/recommendationService.js';
import { logAudit } from '../../utils/audit.js';
import { parsePaginationParams, buildPaginationMeta } from '../../utils/pagination.js';
import { dispatchNotificationAsync } from '../../services/notificationService.js';
import { requireRole } from '../../middleware/rbac.js';

const router = express.Router();

router.use(authenticateUser);
router.use(resolveTenant);
router.use(requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE_OPERATIONS'));

// Helper: Safely generate unique sequential quote number e.g. DF360-2026-000001
async function generateQuoteNumber(tenantId, offset = 0, tx = prisma) {
  const currentYear = new Date().getFullYear();
  const prefix = `DF360-${currentYear}-`;

  const lastQuote = await tx.quotation.findFirst({
    where: {
      tenantId,
      quoteNumber: { startsWith: prefix },
    },
    orderBy: { quoteNumber: 'desc' },
    select: { quoteNumber: true },
  });

  let nextSeq = 1;
  if (lastQuote && lastQuote.quoteNumber) {
    const parts = lastQuote.quoteNumber.split('-');
    if (parts.length >= 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextSeq = parsed + 1;
      }
    }
  }

  const seq = String(nextSeq + offset).padStart(6, '0');
  return `${prefix}${seq}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quotations/calculate
// Section 13 & 21: Real-Time Live Pricing, Margin, Risk & Recommendations
// ─────────────────────────────────────────────────────────────────────────────
router.post('/calculate', async (req, res) => {
  try {
    const { items = [], customerTier = 'BRONZE', customerId } = req.body;

    // Authoritative customer tier resolution from tenant database (Requirement 4)
    let activeCustomerTier = customerTier;
    if (customerId) {
      const dbCustomer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId: req.tenantId },
        select: { tier: true },
      });
      if (dbCustomer) {
        activeCustomerTier = dbCustomer.tier;
      }
    }

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

    // 1. Enrich items with authoritative database product and variant pricing and cost
    const productIds = items.map((i) => i.productId).filter(Boolean);
    const variantIds = items.map((i) => i.variantId).filter(Boolean);

    const [dbProducts, dbVariants] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds }, tenantId: req.tenantId },
      }),
      variantIds.length > 0
        ? prisma.productVariant.findMany({
            where: { id: { in: variantIds }, tenantId: req.tenantId },
          })
        : [],
    ]);

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));
    const variantMap = new Map(dbVariants.map((v) => [v.id, v]));

    const enrichedItems = items.map((item) => {
      const dbProduct = productMap.get(item.productId);
      const dbVariant = item.variantId ? variantMap.get(item.variantId) : null;

      const unitPrice = dbVariant
        ? parseFloat(dbVariant.unitPrice)
        : dbProduct
        ? parseFloat(dbProduct.unitPrice)
        : parseFloat(item.unitPrice) || 0;

      const costPrice = dbVariant
        ? parseFloat(dbVariant.costPrice)
        : dbProduct
        ? parseFloat(dbProduct.costPrice)
        : 0;

      const productNameSnapshot = dbVariant
        ? `${dbProduct ? dbProduct.name : item.name} (${dbVariant.name})`
        : dbProduct
        ? dbProduct.name
        : item.name;

      return {
        ...item,
        variantId: dbVariant ? dbVariant.id : null,
        variantSnapshot: dbVariant
          ? {
              id: dbVariant.id,
              name: dbVariant.name,
              sku: dbVariant.sku,
              attributes: dbVariant.attributes,
              stockQuantity: dbVariant.stockQuantity,
            }
          : null,
        productNameSnapshot,
        productTypeSnapshot: dbProduct ? dbProduct.type : item.type || 'HARDWARE',
        unitPrice,
        costPrice,
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
      activeCustomerTier,
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
// Handler: Paginated, Filtered & Searchable Quotations
// Supports: page, limit, status, customerId, search, riskLevel, date range, sorting
// ─────────────────────────────────────────────────────────────────────────────
async function handleListQuotations(req, res) {
  try {
    const {
      status,
      riskLevel,
      search,
      customerId,
      startDate,
      endDate,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = req.query;

    const whereClause = {
      tenantId: req.tenantId,
    };

    // Sales Reps can only view their own quotations (Requirement 1 & 14)
    if (req.user.role === 'SALES_REP') {
      whereClause.salesRepId = req.user.id;
    }

    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    if (riskLevel && riskLevel !== 'ALL') {
      whereClause.riskLevel = riskLevel;
    }

    if (customerId) {
      whereClause.customerId = customerId;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    if (search) {
      whereClause.OR = [
        { quoteNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { companyName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const { page, limit, skip, take } = parsePaginationParams(req.query);

    const allowedSortFields = ['createdAt', 'updatedAt', 'totalAmount', 'quoteNumber', 'status'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'updatedAt';
    const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const [totalCount, quotes] = await Promise.all([
      prisma.quotation.count({ where: whereClause }),
      prisma.quotation.findMany({
        where: whereClause,
        include: {
          customer: { select: { id: true, name: true, companyName: true, tier: true, email: true } },
          salesRep: { select: { id: true, name: true, email: true } },
          _count: { select: { items: true } },
        },
        skip,
        take,
        orderBy: { [safeSortBy]: safeSortOrder },
      }),
    ]);

    res.json({
      success: true,
      data: quotes,
      pagination: buildPaginationMeta(totalCount, page, limit),
    });
  } catch (err) {
    console.error('[QUOTES] Quotations list fetch error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve quotations.' },
    });
  }
}

// GET /api/quotations & GET /api/quotations/my
router.get('/', handleListQuotations);
router.get('/my', handleListQuotations);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quotations/:id
// Section 30: Detailed Quotation View with Approvals Timeline
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
            variant: true,
          },
        },
        approvals: {
          orderBy: { createdAt: 'desc' },
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
// POST /api/quotations/:id/recalculate
// Recalculate pricing, margins, discount ceiling violations & recommendations
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/recalculate', async (req, res) => {
  try {
    const quote = await prisma.quotation.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { customer: true, items: true },
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation not found.' },
      });
    }

    if (req.user.role === 'SALES_REP' && quote.salesRepId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied to this quotation.' },
      });
    }

    // Accept raw items from body if provided, otherwise use quote's current items
    const rawItems = req.body.items && req.body.items.length > 0
      ? req.body.items
      : quote.items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId || null,
          quantity: it.quantity,
          discountPercentage: parseFloat(it.discountPercentage),
        }));

    const productIds = rawItems.map((i) => i.productId).filter(Boolean);
    const variantIds = rawItems.map((i) => i.variantId).filter(Boolean);

    const [dbProducts, dbVariants] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds }, tenantId: req.tenantId, isActive: true },
      }),
      variantIds.length > 0
        ? prisma.productVariant.findMany({
            where: { id: { in: variantIds }, tenantId: req.tenantId, isActive: true },
          })
        : [],
    ]);

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));
    const variantMap = new Map(dbVariants.map((v) => [v.id, v]));

    const enrichedItems = rawItems.map((item) => {
      const dbProduct = productMap.get(item.productId);
      if (!dbProduct) {
        throw new Error(`Product ${item.productId} not found or inactive in catalog.`);
      }
      const dbVariant = item.variantId ? variantMap.get(item.variantId) : null;
      const unitPrice = dbVariant ? parseFloat(dbVariant.unitPrice) : parseFloat(dbProduct.unitPrice);
      const costPrice = dbVariant ? parseFloat(dbVariant.costPrice || 0) : parseFloat(dbProduct.costPrice || 0);
      const productNameSnapshot = dbVariant ? `${dbProduct.name} (${dbVariant.name})` : dbProduct.name;

      return {
        productId: dbProduct.id,
        variantId: dbVariant ? dbVariant.id : null,
        variantSnapshot: dbVariant
          ? {
              id: dbVariant.id,
              name: dbVariant.name,
              sku: dbVariant.sku,
              attributes: dbVariant.attributes,
              stockQuantity: dbVariant.stockQuantity,
            }
          : null,
        productNameSnapshot,
        productTypeSnapshot: dbProduct.type,
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
        unitPrice,
        costPrice,
        taxRate: parseFloat(dbProduct.taxRate || 18.0),
        discountPercentage: Math.min(100, Math.max(0, parseFloat(item.discountPercentage) || 0)),
      };
    });

    const pricing = calculateQuotationTotals(enrichedItems);
    const customerTier = quote.customer ? quote.customer.tier : 'BRONZE';
    const risk = await evaluateQuotationRisk(
      req.tenantId,
      pricing.items,
      customerTier,
      pricing.marginPercentage
    );
    const recommendations = await getQuoteRecommendations(req.tenantId, pricing.items);

    res.json({
      success: true,
      data: {
        quotationId: quote.id,
        quoteNumber: quote.quoteNumber,
        customerTier,
        pricing,
        risk,
        recommendations,
      },
    });
  } catch (err) {
    console.error('[QUOTES] Recalculate error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'RECALCULATE_ERROR', message: err.message || 'Failed to recalculate quotation.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quotations
// Section 8 & 28: Create New Draft Quotation with Snapshotting & Audit
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

    // Verify customer exists within current tenant (Requirement 2 & 5)
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: req.tenantId },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Selected customer not found in organization.' },
      });
    }

    // Fetch authoritative active product & variant snapshots from DB (Requirement 3, 6, 7)
    const productIds = items.map((i) => i.productId).filter(Boolean);
    const variantIds = items.map((i) => i.variantId).filter(Boolean);

    const [dbProducts, dbVariants] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds }, tenantId: req.tenantId, isActive: true },
      }),
      variantIds.length > 0
        ? prisma.productVariant.findMany({
            where: { id: { in: variantIds }, tenantId: req.tenantId, isActive: true },
          })
        : [],
    ]);

    if (productIds.length > 0 && dbProducts.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PRODUCT',
          message: 'One or more selected products are invalid, inactive, or belong to another organization.',
        },
      });
    }

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));
    const variantMap = new Map(dbVariants.map((v) => [v.id, v]));

    const enrichedItems = items.map((item) => {
      const dbProduct = productMap.get(item.productId);
      if (!dbProduct) {
        throw new Error(`Product ${item.productId} not found in catalog.`);
      }
      const dbVariant = item.variantId ? variantMap.get(item.variantId) : null;
      const unitPrice = dbVariant ? parseFloat(dbVariant.unitPrice) : parseFloat(dbProduct.unitPrice);
      const costPrice = dbVariant ? parseFloat(dbVariant.costPrice || 0) : parseFloat(dbProduct.costPrice || 0);
      const productNameSnapshot = dbVariant ? `${dbProduct.name} (${dbVariant.name})` : dbProduct.name;

      return {
        productId: dbProduct.id,
        variantId: dbVariant ? dbVariant.id : null,
        variantSnapshot: dbVariant
          ? {
              id: dbVariant.id,
              name: dbVariant.name,
              sku: dbVariant.sku,
              attributes: dbVariant.attributes,
              stockQuantity: dbVariant.stockQuantity,
            }
          : null,
        productNameSnapshot,
        productTypeSnapshot: dbProduct.type,
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
        unitPrice,
        costPrice,
        taxRate: parseFloat(dbProduct.taxRate || 18.0),
        discountPercentage: Math.min(100, Math.max(0, parseFloat(item.discountPercentage) || 0)),
      };
    });

    // Authoritative totals & risk (Requirement 8, 9, 10, 12)
    const pricing = calculateQuotationTotals(enrichedItems);
    const risk = await evaluateQuotationRisk(
      req.tenantId,
      pricing.items,
      customer.tier,
      pricing.marginPercentage
    );

    // Create quotation & items with concurrency-safe retry on P2002
    let newQuote = null;
    let attempts = 0;
    while (!newQuote && attempts < 4) {
      try {
        const quoteNumber = await generateQuoteNumber(req.tenantId, attempts);
        newQuote = await prisma.$transaction(async (tx) => {
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
                  variantId: it.variantId || null,
                  variantSnapshot: it.variantSnapshot || null,
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

          await logAudit({
            tenantId: req.tenantId,
            userId: req.user.id,
            action: 'RISK_EVALUATED',
            entityType: 'QUOTATION',
            entityId: quote.id,
            metadata: { quoteNumber, riskScore: risk.riskScore, riskLevel: risk.riskLevel },
          });

          return quote;
        });
      } catch (err) {
        if (err.code === 'P2002' && attempts < 3) {
          attempts++;
          continue;
        }
        throw err;
      }
    }

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

    // Ownership check: sales reps can only edit their own draft quotes
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

    // Customer validation
    const activeCustomerId = customerId || quote.customerId;
    const customer = await prisma.customer.findFirst({
      where: { id: activeCustomerId, tenantId: req.tenantId },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found in organization.' },
      });
    }

    // Authoritative active product & variant lookup
    const productIds = items.map((i) => i.productId).filter(Boolean);
    const variantIds = items.map((i) => i.variantId).filter(Boolean);

    const [dbProducts, dbVariants] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds }, tenantId: req.tenantId, isActive: true },
      }),
      variantIds.length > 0
        ? prisma.productVariant.findMany({
            where: { id: { in: variantIds }, tenantId: req.tenantId, isActive: true },
          })
        : [],
    ]);

    if (productIds.length > 0 && dbProducts.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PRODUCT',
          message: 'One or more selected products are invalid, inactive, or belong to another organization.',
        },
      });
    }

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));
    const variantMap = new Map(dbVariants.map((v) => [v.id, v]));

    const enrichedItems = items.map((item) => {
      const dbProduct = productMap.get(item.productId);
      if (!dbProduct) {
        throw new Error(`Product ${item.productId} not found.`);
      }
      const dbVariant = item.variantId ? variantMap.get(item.variantId) : null;
      const unitPrice = dbVariant ? parseFloat(dbVariant.unitPrice) : parseFloat(dbProduct.unitPrice);
      const costPrice = dbVariant ? parseFloat(dbVariant.costPrice || 0) : parseFloat(dbProduct.costPrice || 0);
      const productNameSnapshot = dbVariant ? `${dbProduct.name} (${dbVariant.name})` : dbProduct.name;

      return {
        productId: dbProduct.id,
        variantId: dbVariant ? dbVariant.id : null,
        variantSnapshot: dbVariant
          ? {
              id: dbVariant.id,
              name: dbVariant.name,
              sku: dbVariant.sku,
              attributes: dbVariant.attributes,
              stockQuantity: dbVariant.stockQuantity,
            }
          : null,
        productNameSnapshot,
        productTypeSnapshot: dbProduct.type,
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
        unitPrice,
        costPrice,
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
          version: { increment: 1 },
          items: {
            create: pricing.items.map((it) => ({
              productId: it.productId,
              variantId: it.variantId || null,
              variantSnapshot: it.variantSnapshot || null,
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

      await logAudit({
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'RISK_EVALUATED',
        entityType: 'QUOTATION',
        entityId: quote.id,
        metadata: { quoteNumber: quote.quoteNumber, riskScore: risk.riskScore, riskLevel: risk.riskLevel },
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
// Section 25, 26, 44 & 45: Submit Quote, Atomic Concurrency & Enforce Non-Bypassable Approvals
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

    // Ownership check: sales reps can only submit their own quotations
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

    // Atomic submission transaction with conditional update (Requirement 17, 18, 22)
    const submittedQuote = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.quotation.updateMany({
        where: {
          id: quote.id,
          tenantId: req.tenantId,
          status: { in: ['DRAFT', 'RETURNED_FOR_REVISION', 'REJECTED'] },
        },
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
          version: { increment: 1 },
        },
      });

      // If another concurrent request already transitioned this quote, return current quote safely
      if (updateResult.count === 0) {
        return await tx.quotation.findFirst({
          where: { id: quote.id },
          include: {
            customer: true,
            items: true,
            salesRep: { select: { id: true, name: true, email: true } },
          },
        });
      }

      const updated = await tx.quotation.findFirst({
        where: { id: quote.id },
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

        await logAudit({
          tenantId: req.tenantId,
          userId: req.user.id,
          action: 'APPROVAL_REQUESTED',
          entityType: 'QUOTATION',
          entityId: quote.id,
          metadata: {
            quoteNumber: quote.quoteNumber,
            requiredApproverRole: risk.requiredApproverRole,
            riskScore: risk.riskScore,
            approvalStatus,
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

      await logAudit({
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'RISK_EVALUATED',
        entityType: 'QUOTATION',
        entityId: quote.id,
        metadata: {
          quoteNumber: quote.quoteNumber,
          riskScore: risk.riskScore,
          riskLevel: risk.riskLevel,
          reasons: risk.reasons,
        },
      });

      return updated;
    });

    console.log(
      `🚀 [CPQ] Quote Submitted: ${submittedQuote.quoteNumber} | Status: ${submittedQuote.status} (${submittedQuote.approvalStatus}) | Risk: ${submittedQuote.riskLevel}`
    );

    // Dispatch async notification if approval required
    try {
      if (submittedQuote.status === 'PENDING_APPROVAL') {
        const managers = await prisma.user.findMany({
          where: { tenantId: req.tenantId, role: { in: ['SALES_MANAGER', 'ADMIN'] } },
          select: { id: true },
        });
        for (const mgr of managers) {
          dispatchNotificationAsync({
            tenantId: req.tenantId,
            recipientUserId: mgr.id,
            recipientRole: 'SALES_MANAGER',
            type: 'APPROVAL_REQUIRED',
            title: `Approval Required: Quote #${submittedQuote.quoteNumber}`,
            message: `Quotation #${submittedQuote.quoteNumber} (Total: ₹${submittedQuote.totalAmount}, Risk: ${submittedQuote.riskLevel}) requires approval.`,
            entityType: 'QUOTATION',
            entityId: submittedQuote.id,
          });
        }
      }
    } catch (notifErr) {
      console.error('[SUBMIT_NOTIF_ERROR]:', notifErr);
    }

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
          version: { increment: 1 },
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

    try {
      dispatchNotificationAsync({
        tenantId: req.tenantId,
        recipientCustomerId: quote.customerId,
        recipientRole: 'CUSTOMER',
        type: 'QUOTE_APPROVED',
        title: `New Quotation #${quote.quoteNumber}`,
        message: `Your sales representative shared quotation #${quote.quoteNumber}. Valid until ${validUntilDate.toLocaleDateString()}.`,
        entityType: 'QUOTATION',
        entityId: quote.id,
      });
    } catch (notifErr) {
      console.error('[SEND_NOTIF_ERROR]:', notifErr);
    }

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
