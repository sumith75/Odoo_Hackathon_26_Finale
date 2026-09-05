/**
 * customerRoutes.js — Customer Deal Room & Negotiation Module
 *
 * Dedicated, restricted customer-facing endpoints.
 * Enforces:
 * - Strict Customer authentication & tenant isolation
 * - 100% IDOR prevention (Customer A cannot access Customer B's quotations)
 * - Complete data masking (strips costPrice, marginAmount, marginPercentage, riskScore, internal rules)
 * - Line-level comments & change requests
 * - Delivery date requests
 * - Counter-offer discount negotiation with automated internal risk re-check & manager approval re-entry
 * - Atomic & idempotent order confirmation
 */

import express from 'express';
import prisma from '../../db/prisma.js';
import { authenticateUser } from '../../middleware/auth.js';
import { calculateQuotationTotals } from '../../services/pricingEngine.js';
import { evaluateQuotationRisk } from '../../services/discountRiskService.js';
import { logAudit } from '../../utils/audit.js';

const router = express.Router();

// Require authenticated customer
function requireCustomer(req, res, next) {
  if (req.user?.role !== 'CUSTOMER') {
    return res.status(403).json({
      success: false,
      error: { code: 'CUSTOMER_ROLE_REQUIRED', message: 'Access restricted to customer accounts.' },
    });
  }
  if (!req.user.customerId) {
    return res.status(401).json({
      success: false,
      error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer account not identified in session.' },
    });
  }
  next();
}

router.use(authenticateUser);
router.use(requireCustomer);

// Helper: Convert internal quote status into customer-friendly display label
function getCustomerFriendlyStatus(status, approvalStatus, validUntil) {
  const isExpired = validUntil && new Date(validUntil) < new Date();
  if (status === 'CUSTOMER_CONFIRMED') return 'CONFIRMED';
  if (isExpired && status !== 'CUSTOMER_CONFIRMED') return 'EXPIRED';
  if (status === 'SENT_TO_CUSTOMER') return 'AWAITING YOUR RESPONSE';
  if (status === 'NEGOTIATION') return 'UNDER NEGOTIATION';
  if (status === 'PENDING_APPROVAL') return 'SELLER REVIEWING';
  if (status === 'APPROVED') return 'READY FOR ACCEPTANCE';
  if (status === 'RETURNED_FOR_REVISION') return 'SELLER REVISING';
  if (status === 'REJECTED') return 'DECLINED BY SELLER';
  if (status === 'CANCELLED') return 'CANCELLED';
  return status;
}

// Helper: Mask sensitive internal data before sending to customer
function sanitizeQuoteForCustomer(quote) {
  const isExpired = quote.validUntil && new Date(quote.validUntil) < new Date();
  const displayStatus = getCustomerFriendlyStatus(quote.status, quote.approvalStatus, quote.validUntil);

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    displayStatus,
    isExpired,
    validUntil: quote.validUntil,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    confirmedAt: quote.confirmedAt,
    notes: quote.notes,
    currency: quote.tenant?.currency || 'INR',
    seller: {
      organizationName: quote.tenant?.name || 'DealFlow360 Enterprise',
      salesRepName: quote.salesRep?.name || 'Sales Representative',
      salesRepEmail: quote.salesRep?.email || null,
      companyEmail: quote.tenant?.companyEmail || null,
      phone: quote.tenant?.phone || null,
    },
    customer: {
      id: quote.customer?.id,
      name: quote.customer?.name,
      email: quote.customer?.email,
      companyName: quote.customer?.companyName,
      tier: quote.customer?.tier,
    },
    // Authoritative totals (NO margins or costs)
    financials: {
      subtotal: parseFloat(quote.subtotal) || 0,
      discountAmount: parseFloat(quote.discountAmount) || 0,
      taxAmount: parseFloat(quote.taxAmount) || 0,
      totalAmount: parseFloat(quote.totalAmount) || 0,
      effectiveDiscountPercentage:
        parseFloat(quote.subtotal) > 0
          ? Math.round(((parseFloat(quote.discountAmount) || 0) / parseFloat(quote.subtotal)) * 10000) / 100
          : 0,
    },
    // Sanitized Line Items (NO costPrice, marginAmount, marginPercentage)
    items: (quote.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productNameSnapshot,
      productType: item.productTypeSnapshot,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice) || 0,
      discountPercentage: parseFloat(item.discountPercentage) || 0,
      discountAmount: parseFloat(item.discountAmount) || 0,
      taxAmount: parseFloat(item.taxAmount) || 0,
      lineTotal: parseFloat(item.lineTotal) || 0,
      comments: (item.comments || []).filter((c) => c.visibility !== 'INTERNAL_ONLY'),
      changeRequests: item.changeRequests || [],
      negotiationProposals: item.negotiationProposals || [],
    })),
    deliveryRequests: quote.deliveryRequests || [],
    comments: (quote.comments || []).filter((c) => c.visibility !== 'INTERNAL_ONLY'),
    changeRequests: quote.changeRequests || [],
    negotiationProposals: quote.negotiationProposals || [],
    timeline: buildCustomerTimeline(quote),
  };
}

// Build customer-visible milestone timeline
function buildCustomerTimeline(quote) {
  const events = [];

  events.push({
    key: 'QUOTE_CREATED',
    title: 'Quotation Prepared',
    description: `Quotation ${quote.quoteNumber} prepared by ${quote.salesRep?.name || 'Sales Representative'}.`,
    date: quote.createdAt,
    status: 'COMPLETED',
  });

  if (quote.status !== 'DRAFT') {
    events.push({
      key: 'QUOTE_SENT',
      title: 'Quotation Shared with You',
      description: 'The quotation was delivered to your customer deal room.',
      date: quote.createdAt,
      status: 'COMPLETED',
    });
  }

  // Delivery Requests
  if (quote.deliveryRequests?.length > 0) {
    quote.deliveryRequests.forEach((dr) => {
      events.push({
        key: 'DELIVERY_REQUESTED',
        title: 'Delivery Date Requested',
        description: `Requested delivery for ${new Date(dr.requestedDate).toLocaleDateString()}.${dr.note ? ' Note: "' + dr.note + '"' : ''} Status: ${dr.status}`,
        date: dr.createdAt,
        status: dr.status === 'ACCEPTED' ? 'COMPLETED' : 'IN_PROGRESS',
      });
    });
  }

  // Negotiation Proposals
  if (quote.negotiationProposals?.length > 0) {
    quote.negotiationProposals.forEach((np) => {
      events.push({
        key: 'COUNTER_OFFER',
        title: `Counter-Offer Proposed (Round #${np.roundNumber})`,
        description: `Proposed discount: ${np.proposedDiscount}%. ${np.reason ? 'Reason: "' + np.reason + '"' : ''}`,
        date: np.createdAt,
        status: np.status === 'APPROVED' ? 'COMPLETED' : 'IN_PROGRESS',
      });
    });
  }

  if (quote.status === 'CUSTOMER_CONFIRMED') {
    events.push({
      key: 'CONFIRMED',
      title: 'Order Officially Confirmed',
      description: 'You digitally accepted and confirmed the quotation terms.',
      date: quote.confirmedAt || quote.updatedAt,
      status: 'COMPLETED',
    });
  } else if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
    events.push({
      key: 'EXPIRED',
      title: 'Quotation Expired',
      description: 'This quotation has expired. Contact your representative for renewal.',
      date: quote.validUntil,
      status: 'EXPIRED',
    });
  }

  return events.sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/customer/dashboard
// Customer Dashboard stats & summary
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const tenantId = req.user.tenantId;

    const quotes = await prisma.quotation.findMany({
      where: {
        tenantId,
        customerId,
        status: { notIn: ['DRAFT'] }, // Hide unsubmitted internal drafts
      },
      include: {
        customer: true,
        salesRep: { select: { name: true, email: true } },
        tenant: true,
        items: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const now = new Date();

    const activeQuotes = quotes.filter(
      (q) => q.status !== 'CUSTOMER_CONFIRMED' && q.status !== 'CANCELLED' && (!q.validUntil || new Date(q.validUntil) >= now)
    ).length;

    const awaitingResponse = quotes.filter(
      (q) => (q.status === 'SENT_TO_CUSTOMER' || q.status === 'APPROVED') && (!q.validUntil || new Date(q.validUntil) >= now)
    ).length;

    const underNegotiation = quotes.filter(
      (q) => q.status === 'NEGOTIATION' || q.status === 'PENDING_APPROVAL'
    ).length;

    const confirmedQuotes = quotes.filter((q) => q.status === 'CUSTOMER_CONFIRMED').length;

    // Recent 5 quotes
    const recentQuotes = quotes.slice(0, 5).map(sanitizeQuoteForCustomer);

    // Urgent items awaiting action
    const actionRequired = quotes
      .filter((q) => (q.status === 'SENT_TO_CUSTOMER' || q.status === 'APPROVED') && (!q.validUntil || new Date(q.validUntil) >= now))
      .slice(0, 3)
      .map(sanitizeQuoteForCustomer);

    res.json({
      success: true,
      data: {
        stats: {
          activeQuotes,
          awaitingResponse,
          underNegotiation,
          confirmedQuotes,
          totalShared: quotes.length,
        },
        customer: {
          id: req.user.customerId,
          name: req.user.name,
          email: req.user.email,
          companyName: req.user.companyName,
          tier: req.user.tier,
          currency: req.user.currency,
          organizationName: req.user.organizationName,
        },
        actionRequired,
        recentQuotes,
      },
    });
  } catch (err) {
    console.error('[CUSTOMER DEAL ROOM] Dashboard error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'DASHBOARD_ERROR', message: 'Failed to load customer dashboard.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/customer/quotes
// Customer Quotations list with filters & search
// ─────────────────────────────────────────────────────────────────────────────
router.get('/quotes', async (req, res) => {
  try {
    const { status, search } = req.query;
    const customerId = req.user.customerId;
    const tenantId = req.user.tenantId;

    const whereClause = {
      tenantId,
      customerId,
      status: { notIn: ['DRAFT'] }, // Hide internal drafts
    };

    const now = new Date();

    if (status === 'AWAITING_RESPONSE') {
      whereClause.status = { in: ['SENT_TO_CUSTOMER', 'APPROVED'] };
      whereClause.OR = [{ validUntil: null }, { validUntil: { gte: now } }];
    } else if (status === 'UNDER_NEGOTIATION') {
      whereClause.status = { in: ['NEGOTIATION', 'PENDING_APPROVAL'] };
    } else if (status === 'CONFIRMED') {
      whereClause.status = 'CUSTOMER_CONFIRMED';
    } else if (status === 'EXPIRED') {
      whereClause.validUntil = { lt: now };
      whereClause.status = { not: 'CUSTOMER_CONFIRMED' };
    }

    if (search && search.trim()) {
      whereClause.quoteNumber = { contains: search.trim(), mode: 'insensitive' };
    }

    const quotes = await prisma.quotation.findMany({
      where: whereClause,
      include: {
        customer: true,
        salesRep: { select: { name: true, email: true } },
        tenant: true,
        items: true,
        deliveryRequests: { take: 1, orderBy: { createdAt: 'desc' } },
        negotiationProposals: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const sanitized = quotes.map(sanitizeQuoteForCustomer);

    res.json({
      success: true,
      data: sanitized,
      count: sanitized.length,
    });
  } catch (err) {
    console.error('[CUSTOMER DEAL ROOM] Quotes list error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'QUOTES_LIST_ERROR', message: 'Failed to load customer quotes.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/customer/quotes/:id
// Deal Room Detail Dossier (Strict IDOR Protection)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/quotes/:id', async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const tenantId = req.user.tenantId;

    // Strict IDOR check: quote must belong to the authenticated customer AND tenant
    const quote = await prisma.quotation.findFirst({
      where: {
        id: req.params.id,
        customerId,
        tenantId,
        status: { notIn: ['DRAFT'] },
      },
      include: {
        customer: true,
        salesRep: { select: { id: true, name: true, email: true } },
        tenant: true,
        items: {
          include: {
            comments: { orderBy: { createdAt: 'asc' } },
            changeRequests: { orderBy: { createdAt: 'desc' } },
            negotiationProposals: { orderBy: { createdAt: 'desc' } },
          },
        },
        deliveryRequests: { orderBy: { createdAt: 'desc' } },
        comments: { orderBy: { createdAt: 'asc' } },
        changeRequests: { orderBy: { createdAt: 'desc' } },
        negotiationProposals: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!quote) {
      // 404 Not Found without revealing existence
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation not found or not accessible.' },
      });
    }

    const sanitized = sanitizeQuoteForCustomer(quote);

    res.json({
      success: true,
      data: sanitized,
    });
  } catch (err) {
    console.error('[CUSTOMER DEAL ROOM] Quote detail error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'QUOTE_DETAIL_ERROR', message: 'Failed to load quotation.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/customer/quotes/:id/delivery-request
// Submit Requested Delivery Date with Note
// ─────────────────────────────────────────────────────────────────────────────
router.post('/quotes/:id/delivery-request', async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const tenantId = req.user.tenantId;
    const { requestedDate, note } = req.body;

    if (!requestedDate) {
      return res.status(400).json({
        success: false,
        error: { code: 'DATE_REQUIRED', message: 'Please specify a requested delivery date.' },
      });
    }

    const parsedDate = new Date(requestedDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DATE', message: 'Invalid delivery date provided.' },
      });
    }

    // Ownership check
    const quote = await prisma.quotation.findFirst({
      where: { id: req.params.id, customerId, tenantId },
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation not found.' },
      });
    }

    // Create delivery request record
    const deliveryRequest = await prisma.$transaction(async (tx) => {
      const dr = await tx.deliveryRequest.create({
        data: {
          tenantId,
          quotationId: quote.id,
          customerId,
          requestedDate: parsedDate,
          note: note?.trim() || null,
          status: 'REQUESTED',
        },
      });

      await logAudit({
        tenantId,
        userId: customerId,
        action: 'CUSTOMER_DELIVERY_REQUESTED',
        entityType: 'QUOTATION',
        entityId: quote.id,
        metadata: {
          requestedDate: parsedDate.toISOString(),
          note: note?.trim(),
          quoteNumber: quote.quoteNumber,
        },
      });

      return dr;
    });

    console.log(`📅 [CUSTOMER DEAL ROOM] Delivery Date Requested: Quote #${quote.quoteNumber} -> Date: ${parsedDate.toLocaleDateString()}`);

    res.status(201).json({
      success: true,
      message: 'Delivery date request submitted to the seller for confirmation.',
      data: deliveryRequest,
    });
  } catch (err) {
    console.error('[CUSTOMER DEAL ROOM] Delivery request error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'DELIVERY_REQUEST_ERROR', message: err.message || 'Failed to submit delivery date request.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/customer/quotes/:id/comments
// Line-Level or Deal-Level Comment Stream
// ─────────────────────────────────────────────────────────────────────────────
router.post('/quotes/:id/comments', async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const tenantId = req.user.tenantId;
    const { quotationItemId, message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMPTY_MESSAGE', message: 'Comment text cannot be empty.' },
      });
    }

    // Ownership check
    const quote = await prisma.quotation.findFirst({
      where: { id: req.params.id, customerId, tenantId },
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation not found.' },
      });
    }

    const comment = await prisma.quoteComment.create({
      data: {
        tenantId,
        quotationId: quote.id,
        quotationItemId: quotationItemId || null,
        authorRole: 'CUSTOMER',
        authorName: req.user.name || 'Customer',
        customerId,
        message: message.trim(),
        visibility: 'CUSTOMER_VISIBLE',
      },
    });

    await logAudit({
      tenantId,
      userId: customerId,
      action: 'CUSTOMER_ADDED_COMMENT',
      entityType: 'QUOTATION',
      entityId: quote.id,
      metadata: { quotationItemId, author: req.user.name },
    });

    res.status(201).json({
      success: true,
      message: 'Comment posted successfully.',
      data: comment,
    });
  } catch (err) {
    console.error('[CUSTOMER DEAL ROOM] Comment error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'COMMENT_ERROR', message: err.message || 'Failed to post comment.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/customer/quotes/:id/change-requests
// Line-Level Change Request (e.g. Quantity change, Remove item, Add item)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/quotes/:id/change-requests', async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const tenantId = req.user.tenantId;
    const { quotationItemId, requestType = 'QUANTITY_CHANGE', currentValue, requestedValue, comment } = req.body;

    if (!requestedValue) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALUE_REQUIRED', message: 'Requested change value is required.' },
      });
    }

    const quote = await prisma.quotation.findFirst({
      where: { id: req.params.id, customerId, tenantId },
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation not found.' },
      });
    }

    const changeRequest = await prisma.$transaction(async (tx) => {
      const cr = await tx.quoteChangeRequest.create({
        data: {
          tenantId,
          quotationId: quote.id,
          quotationItemId: quotationItemId || null,
          customerId,
          requestType,
          currentValue: currentValue ? String(currentValue) : null,
          requestedValue: String(requestedValue),
          comment: comment?.trim() || null,
          status: 'CUSTOMER_SUBMITTED',
        },
      });

      // Update quote status to NEGOTIATION if not already
      if (quote.status === 'SENT_TO_CUSTOMER' || quote.status === 'APPROVED') {
        await tx.quotation.update({
          where: { id: quote.id },
          data: { status: 'NEGOTIATION' },
        });
      }

      await logAudit({
        tenantId,
        userId: customerId,
        action: 'CUSTOMER_SUBMITTED_CHANGE_REQUEST',
        entityType: 'QUOTATION',
        entityId: quote.id,
        metadata: { requestType, requestedValue, comment },
      });

      return cr;
    });

    res.status(201).json({
      success: true,
      message: 'Change request submitted to sales representative.',
      data: changeRequest,
    });
  } catch (err) {
    console.error('[CUSTOMER DEAL ROOM] Change request error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'CHANGE_REQUEST_ERROR', message: err.message || 'Failed to submit change request.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/customer/quotes/:id/counter-offer
// Submit Counter-Offer Discount -> Automated Internal Risk Recheck & Manager Re-Approval
// ─────────────────────────────────────────────────────────────────────────────
router.post('/quotes/:id/counter-offer', async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const tenantId = req.user.tenantId;
    const { quotationItemId, proposedDiscount, reason } = req.body;

    if (proposedDiscount === undefined || proposedDiscount === null) {
      return res.status(400).json({
        success: false,
        error: { code: 'DISCOUNT_REQUIRED', message: 'Proposed discount percentage is required.' },
      });
    }

    const discountNum = parseFloat(proposedDiscount);
    if (isNaN(discountNum) || discountNum < 0 || discountNum > 90) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DISCOUNT', message: 'Proposed discount must be between 0% and 90%.' },
      });
    }

    // Ownership & state check
    const quote = await prisma.quotation.findFirst({
      where: { id: req.params.id, customerId, tenantId },
      include: {
        customer: true,
        items: true,
        negotiationProposals: true,
      },
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation not found.' },
      });
    }

    if (quote.status === 'CUSTOMER_CONFIRMED') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_CONFIRMED', message: 'Cannot negotiate an already confirmed quotation.' },
      });
    }

    if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
      return res.status(400).json({
        success: false,
        error: { code: 'EXPIRED', message: 'This quotation has expired. Please contact your sales representative.' },
      });
    }

    // Determine targeted items
    let targetItem = null;
    if (quotationItemId) {
      targetItem = quote.items.find((i) => i.id === quotationItemId);
    }
    if (!targetItem && quote.items.length > 0) {
      targetItem = quote.items[0];
    }

    const currentDiscount = targetItem ? parseFloat(targetItem.discountPercentage) : 0;
    const roundNumber = (quote.negotiationProposals?.length || 0) + 1;

    // Recalculate proposed pricing
    const proposedItems = quote.items.map((item) => {
      const isTarget = targetItem ? item.id === targetItem.id : true;
      const appliedDiscount = isTarget ? discountNum : parseFloat(item.discountPercentage);

      return {
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        productTypeSnapshot: item.productTypeSnapshot,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        costPrice: parseFloat(item.costPrice),
        taxRate: parseFloat(item.taxAmount > 0 && item.lineTotal > 0 ? (item.taxAmount / (item.lineTotal - item.taxAmount)) * 100 : 18.0),
        discountPercentage: appliedDiscount,
      };
    });

    const proposedPricing = calculateQuotationTotals(proposedItems);

    // Run Internal Risk Evaluation Engine against tenant discount rules
    const riskEvaluation = await evaluateQuotationRisk(
      tenantId,
      proposedPricing.items,
      quote.customer ? quote.customer.tier : 'BRONZE',
      proposedPricing.marginPercentage
    );

    // Snapshot terms before update
    const previousTermsSnapshot = {
      roundNumber,
      subtotal: parseFloat(quote.subtotal),
      discountAmount: parseFloat(quote.discountAmount),
      totalAmount: parseFloat(quote.totalAmount),
      marginPercentage: parseFloat(quote.marginPercentage),
      riskScore: quote.riskScore,
      items: quote.items.map((it) => ({
        id: it.id,
        productName: it.productNameSnapshot,
        quantity: it.quantity,
        unitPrice: parseFloat(it.unitPrice),
        discountPercentage: parseFloat(it.discountPercentage),
        lineTotal: parseFloat(it.lineTotal),
      })),
      timestamp: new Date().toISOString(),
    };

    // Execute negotiation state transition in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create NegotiationProposal record
      const proposal = await tx.negotiationProposal.create({
        data: {
          tenantId,
          quotationId: quote.id,
          quotationItemId: targetItem?.id || null,
          customerId,
          roundNumber,
          currentDiscount,
          proposedDiscount: discountNum,
          proposedTotalAmount: proposedPricing.totalAmount,
          reason: reason?.trim() || null,
          status: 'CUSTOMER_SUBMITTED',
        },
      });

      // 2. Determine approval status:
      // If risk evaluation requires approval OR discount ceiling is violated, route to manager
      let newStatus = 'NEGOTIATION';
      let newApprovalStatus = quote.approvalStatus;

      if (riskEvaluation.approvalRequired || discountNum > currentDiscount) {
        newStatus = 'NEGOTIATION';
        newApprovalStatus =
          riskEvaluation.requiredApproverRole === 'FINANCE_OPERATIONS'
            ? 'PENDING_FINANCE'
            : 'PENDING_MANAGER';

        // Create pending Approval record for Sales Manager
        await tx.approval.create({
          data: {
            tenantId,
            quotationId: quote.id,
            approverRole: newApprovalStatus === 'PENDING_FINANCE' ? 'FINANCE_OPERATIONS' : 'SALES_MANAGER',
            level: newApprovalStatus === 'PENDING_FINANCE' ? 'FINANCE_OPERATIONS' : 'SALES_MANAGER',
            status: newApprovalStatus,
            riskScoreAtDecision: riskEvaluation.riskScore,
            marginPercentageAtDecision: proposedPricing.marginPercentage,
            discountAmountAtDecision: proposedPricing.discountAmount,
            reason: `Customer counter-offer Round #${roundNumber}: Requested ${discountNum}% discount (previous: ${currentDiscount}%).`,
            comment: reason?.trim() || null,
          },
        });
      }

      // 3. Update Quotation with proposed terms & risk
      await tx.quotation.update({
        where: { id: quote.id },
        data: {
          status: newStatus,
          approvalStatus: newApprovalStatus,
          subtotal: proposedPricing.subtotal,
          discountAmount: proposedPricing.discountAmount,
          taxAmount: proposedPricing.taxAmount,
          totalAmount: proposedPricing.totalAmount,
          costAmount: proposedPricing.costAmount,
          marginAmount: proposedPricing.marginAmount,
          marginPercentage: proposedPricing.marginPercentage,
          riskScore: riskEvaluation.riskScore,
          riskLevel: riskEvaluation.riskLevel,
          riskReasons: riskEvaluation.reasons,
          requiredApproverRole: riskEvaluation.requiredApproverRole,
          previousTerms: previousTermsSnapshot,
          revisionNotes: `Customer proposed ${discountNum}% discount. Reason: ${reason || 'Volume pricing'}.`,
        },
      });

      // Update targeted line item discount
      if (targetItem) {
        const updatedItemPricing = proposedPricing.items.find((i) => i.productId === targetItem.productId);
        if (updatedItemPricing) {
          await tx.quotationItem.update({
            where: { id: targetItem.id },
            data: {
              discountPercentage: discountNum,
              discountAmount: updatedItemPricing.discountAmount,
              taxAmount: updatedItemPricing.taxAmount,
              lineTotal: updatedItemPricing.lineTotal,
              marginAmount: updatedItemPricing.marginAmount,
              marginPercentage: updatedItemPricing.marginPercentage,
            },
          });
        }
      }

      // 4. Audit Trail
      await logAudit({
        tenantId,
        userId: customerId,
        action: 'CUSTOMER_SUBMITTED_COUNTER_OFFER',
        entityType: 'QUOTATION',
        entityId: quote.id,
        metadata: {
          roundNumber,
          currentDiscount,
          proposedDiscount: discountNum,
          proposedTotal: proposedPricing.totalAmount,
          requiresApproval: riskEvaluation.approvalRequired,
          riskScore: riskEvaluation.riskScore,
        },
      });

      return proposal;
    });

    console.log(
      `🤝 [CUSTOMER DEAL ROOM] Counter-Offer Submitted: Quote #${quote.quoteNumber} | Round #${roundNumber} | Proposed Discount: ${discountNum}% | Auto-Risk: ${riskEvaluation.riskLevel}`
    );

    res.status(201).json({
      success: true,
      message: 'Your counter-offer has been submitted and sent to the seller for review.',
      data: {
        proposal: result,
        proposedTotal: proposedPricing.totalAmount,
        roundNumber,
        status: 'UNDER_NEGOTIATION',
      },
    });
  } catch (err) {
    console.error('[CUSTOMER DEAL ROOM] Counter-offer error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'COUNTER_OFFER_ERROR', message: err.message || 'Failed to submit counter-offer.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/customer/quotes/:id/confirm
// Accept & Confirm Final Quotation (Idempotent Transaction)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/quotes/:id/confirm', async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const tenantId = req.user.tenantId;
    const { termsAccepted = true, notes } = req.body;

    if (!termsAccepted) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TERMS_NOT_ACCEPTED',
          message: 'You must confirm and accept the quotation terms to complete your order.',
        },
      });
    }

    // Ownership & state check
    const quote = await prisma.quotation.findFirst({
      where: { id: req.params.id, customerId, tenantId },
      include: {
        customer: true,
        items: true,
        tenant: true,
        salesRep: { select: { id: true, name: true, email: true } },
      },
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation not found.' },
      });
    }

    // Idempotency: If already confirmed, return success without duplicate processing
    if (quote.status === 'CUSTOMER_CONFIRMED') {
      return res.json({
        success: true,
        alreadyConfirmed: true,
        message: 'Quotation has already been confirmed.',
        data: sanitizeQuoteForCustomer(quote),
      });
    }

    // Check expiration
    if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'QUOTE_EXPIRED',
          message: 'This quotation has expired and cannot be confirmed. Please contact your sales representative for an updated quote.',
        },
      });
    }

    // Check pending approvals
    if (quote.status === 'PENDING_APPROVAL' || quote.approvalStatus === 'PENDING_MANAGER' || quote.approvalStatus === 'PENDING_FINANCE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'APPROVAL_PENDING',
          message: 'The proposed terms are currently awaiting managerial review and cannot be confirmed yet.',
        },
      });
    }

    // Atomic confirmation transaction
    const confirmedQuote = await prisma.$transaction(async (tx) => {
      const updated = await tx.quotation.update({
        where: { id: quote.id },
        data: {
          status: 'CUSTOMER_CONFIRMED',
          confirmedAt: new Date(),
        },
        include: {
          customer: true,
          salesRep: { select: { id: true, name: true, email: true } },
          tenant: true,
          items: true,
          deliveryRequests: true,
          comments: true,
          changeRequests: true,
          negotiationProposals: true,
        },
      });

      // Create confirmation notification
      await tx.customerNotification.create({
        data: {
          tenantId,
          customerId,
          title: `Order Confirmed: ${quote.quoteNumber}`,
          message: `Thank you! Quote #${quote.quoteNumber} has been officially confirmed and routed to operations for fulfillment.`,
          link: `/customer/quotes/${quote.id}`,
        },
      });

      // Audit Log
      await logAudit({
        tenantId,
        userId: customerId,
        action: 'CUSTOMER_CONFIRMED_DEAL',
        entityType: 'QUOTATION',
        entityId: quote.id,
        metadata: {
          quoteNumber: quote.quoteNumber,
          totalAmount: parseFloat(quote.totalAmount),
          customerName: quote.customer?.name,
          confirmedAt: new Date().toISOString(),
        },
      });

      return updated;
    });

    console.log(
      `🎉 [CUSTOMER DEAL ROOM] Order Confirmed! Quote #${confirmedQuote.quoteNumber} | Amount: ${confirmedQuote.totalAmount} | Customer: ${confirmedQuote.customer?.name}`
    );

    res.json({
      success: true,
      message: 'Quotation confirmed successfully! Your order has been placed and routed for fulfillment.',
      data: sanitizeQuoteForCustomer(confirmedQuote),
    });
  } catch (err) {
    console.error('[CUSTOMER DEAL ROOM] Confirm error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'CONFIRMATION_ERROR', message: err.message || 'Failed to confirm quotation.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/customer/notifications
// Customer in-app alerts
// ─────────────────────────────────────────────────────────────────────────────
router.get('/notifications', async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const tenantId = req.user.tenantId;

    const notifications = await prisma.customerNotification.findMany({
      where: { customerId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({
      success: true,
      data: notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    });
  } catch (err) {
    console.error('[CUSTOMER DEAL ROOM] Notifications error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/customer/notifications/:id/read
// ─────────────────────────────────────────────────────────────────────────────
router.put('/notifications/:id/read', async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const notification = await prisma.customerNotification.updateMany({
      where: { id: req.params.id, customerId },
      data: { isRead: true },
    });

    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    console.error('[CUSTOMER DEAL ROOM] Mark read error:', err);
    res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
});

export default router;
