/**
 * reportService.js — PostgreSQL-Authoritative Reporting & Analytics Engine
 *
 * Implements server-side aggregations for:
 * - Sales Performance KPIs & Rep metrics
 * - Approval and Governance telemetry
 * - Product and Category sales analysis
 * - Hybrid Billing and Cashflow settlement
 * - Period, Sales Rep, Approval Status, and Category filters
 */

import prisma from '../db/prisma.js';

/**
 * Normalizes filter parameters into Prisma query where conditions
 */
export function buildFilterConditions(tenantId, rawFilters = {}) {
  const {
    period,
    startDate,
    endDate,
    salesRepId,
    approvalStatus,
    productId,
    category,
  } = rawFilters;

  const quoteWhere = { tenantId };
  const dateFilter = {};

  // 1. Period Filter
  const now = new Date();
  if (period === 'TODAY') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    dateFilter.gte = startOfToday;
    dateFilter.lte = now;
  } else if (period === 'THIS_WEEK') {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    dateFilter.gte = sevenDaysAgo;
    dateFilter.lte = now;
  } else if (period === 'THIS_MONTH') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    dateFilter.gte = startOfMonth;
    dateFilter.lte = now;
  } else if (startDate || endDate) {
    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!isNaN(parsedStart.getTime())) dateFilter.gte = parsedStart;
    }
    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (!isNaN(parsedEnd.getTime())) {
        // Include full day if only YYYY-MM-DD was sent
        if (endDate.length <= 10) parsedEnd.setHours(23, 59, 59, 999);
        dateFilter.lte = parsedEnd;
      }
    }
  }

  if (dateFilter.gte || dateFilter.lte) {
    quoteWhere.createdAt = dateFilter;
  }

  // 2. Sales Rep Filter
  if (salesRepId && salesRepId !== 'ALL') {
    quoteWhere.salesRepId = salesRepId;
  }

  // 3. Approval Status Filter
  if (approvalStatus && approvalStatus !== 'ALL') {
    if (approvalStatus === 'APPROVED') {
      quoteWhere.approvalStatus = 'APPROVED';
    } else if (approvalStatus === 'REJECTED') {
      quoteWhere.approvalStatus = 'REJECTED';
    } else if (approvalStatus === 'PENDING' || approvalStatus === 'PENDING_APPROVAL') {
      quoteWhere.approvalStatus = { in: ['PENDING_MANAGER', 'PENDING_FINANCE'] };
    } else if (['PENDING_MANAGER', 'PENDING_FINANCE', 'NONE', 'RETURNED_FOR_REVISION'].includes(approvalStatus)) {
      quoteWhere.approvalStatus = approvalStatus;
    }
  }

  // 4. Product / Category Filter (nested items filter)
  if ((productId && productId !== 'ALL') || (category && category !== 'ALL')) {
    quoteWhere.items = {
      some: {
        ...(productId && productId !== 'ALL' ? { productId } : {}),
        ...(category && category !== 'ALL' ? { productTypeSnapshot: category } : {}),
      },
    };
  }

  return { quoteWhere, dateFilter };
}

/**
 * Returns Summary KPIs across quotations, orders, and finances
 */
export async function getSalesReportSummary(tenantId, filters = {}) {
  const { quoteWhere, dateFilter } = buildFilterConditions(tenantId, filters);

  // Status arrays
  const wonStatuses = ['CUSTOMER_CONFIRMED', 'FULFILLMENT', 'PARTIALLY_FULFILLED', 'FULFILLED', 'PAID'];
  const pendingApprovalStatuses = ['PENDING_MANAGER', 'PENDING_FINANCE'];

  // Parallel aggregations
  const [
    totalQuotes,
    approvedQuotes,
    pendingApprovals,
    rejectedQuotes,
    wonOrdersCount,
    quotedAgg,
    wonAgg,
    invoiceAgg,
    paymentAgg,
  ] = await Promise.all([
    // 1. Total Quotes
    prisma.quotation.count({ where: quoteWhere }),

    // 2. Approved
    prisma.quotation.count({
      where: { ...quoteWhere, approvalStatus: 'APPROVED' },
    }),

    // 3. Pending Approvals
    prisma.quotation.count({
      where: { ...quoteWhere, approvalStatus: { in: pendingApprovalStatuses } },
    }),

    // 4. Rejected
    prisma.quotation.count({
      where: { ...quoteWhere, approvalStatus: 'REJECTED' },
    }),

    // 5. Won Orders
    prisma.quotation.count({
      where: { ...quoteWhere, status: { in: wonStatuses } },
    }),

    // 6. Quoted value & discount
    prisma.quotation.aggregate({
      where: quoteWhere,
      _sum: { totalAmount: true, discountAmount: true },
    }),

    // 7. Won value
    prisma.quotation.aggregate({
      where: { ...quoteWhere, status: { in: wonStatuses } },
      _sum: { totalAmount: true },
    }),

    // 8. Invoiced amounts
    prisma.invoice.aggregate({
      where: {
        tenantId,
        ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
        ...(filters.salesRepId && filters.salesRepId !== 'ALL'
          ? { quotation: { salesRepId: filters.salesRepId } }
          : {}),
      },
      _sum: { totalAmount: true, amountPaid: true, amountDue: true },
      _count: { id: true },
    }),

    // 9. Payment collections
    prisma.payment.aggregate({
      where: {
        tenantId,
        status: 'SUCCEEDED',
        ...(dateFilter.gte || dateFilter.lte ? { paidAt: dateFilter } : {}),
      },
      _sum: { amount: true, refundedAmount: true },
      _count: { id: true },
    }),
  ]);

  const totalQuotedValue = Number(quotedAgg._sum.totalAmount || 0);
  const totalDiscount = Number(quotedAgg._sum.discountAmount || 0);
  const totalWonValue = Number(wonAgg._sum.totalAmount || 0);
  const avgDealValue = wonOrdersCount > 0 ? totalWonValue / wonOrdersCount : (totalQuotes > 0 ? totalQuotedValue / totalQuotes : 0);

  const invoicedAmount = Number(invoiceAgg._sum.totalAmount || 0);
  const invoicePaidAmount = Number(invoiceAgg._sum.amountPaid || 0);
  const invoiceDueAmount = Number(invoiceAgg._sum.amountDue || 0);

  const totalCollected = Number(paymentAgg._sum.amount || 0);
  const totalRefunded = Number(paymentAgg._sum.refundedAmount || 0);
  const netPaid = totalCollected - totalRefunded;

  return {
    kpis: {
      totalQuotes,
      approvedQuotes,
      pendingApprovals,
      rejectedQuotes,
      wonOrdersCount,
      winRate: totalQuotes > 0 ? Math.round((wonOrdersCount / totalQuotes) * 1000) / 10 : 0,
      totalQuotedValue: Math.round(totalQuotedValue * 100) / 100,
      totalWonValue: Math.round(totalWonValue * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      avgDealValue: Math.round(avgDealValue * 100) / 100,
      invoicedAmount: Math.round(invoicedAmount * 100) / 100,
      paidAmount: Math.round((invoicePaidAmount || netPaid) * 100) / 100,
      outstandingAmount: Math.round(invoiceDueAmount * 100) / 100,
      invoicesCount: invoiceAgg._count.id,
      paymentsCount: paymentAgg._count.id,
    },
    appliedFilters: {
      period: filters.period || 'ALL',
      startDate: filters.startDate || null,
      endDate: filters.endDate || null,
      salesRepId: filters.salesRepId || 'ALL',
      approvalStatus: filters.approvalStatus || 'ALL',
      productId: filters.productId || 'ALL',
      category: filters.category || 'ALL',
    },
  };
}

/**
 * Returns granular Sales Performance breakdown grouped by Sales Representative
 */
export async function getSalesPerformanceReport(tenantId, filters = {}) {
  const { quoteWhere } = buildFilterConditions(tenantId, filters);
  const wonStatuses = ['CUSTOMER_CONFIRMED', 'FULFILLMENT', 'PARTIALLY_FULFILLED', 'FULFILLED', 'PAID'];

  // 1. Fetch sales reps for tenant
  const salesReps = await prisma.user.findMany({
    where: {
      tenantId,
      role: { in: ['SALES_REP', 'ADMIN', 'SALES_MANAGER'] },
      ...(filters.salesRepId && filters.salesRepId !== 'ALL' ? { id: filters.salesRepId } : {}),
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  });

  // 2. Query quotes for these reps
  const quotes = await prisma.quotation.findMany({
    where: quoteWhere,
    select: {
      id: true,
      salesRepId: true,
      status: true,
      approvalStatus: true,
      totalAmount: true,
      discountAmount: true,
      subtotal: true,
      createdAt: true,
    },
  });

  // 3. Aggregate in-memory per rep
  const repMap = {};
  for (const rep of salesReps) {
    repMap[rep.id] = {
      repId: rep.id,
      repName: rep.name,
      repEmail: rep.email,
      role: rep.role,
      quotesCount: 0,
      approvedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      wonCount: 0,
      totalQuotedValue: 0,
      totalWonValue: 0,
      totalDiscount: 0,
      avgDiscountPct: 0,
      winRate: 0,
    };
  }

  for (const q of quotes) {
    const repId = q.salesRepId;
    if (!repMap[repId]) {
      repMap[repId] = {
        repId,
        repName: 'Unassigned / System',
        repEmail: '—',
        role: 'SYSTEM',
        quotesCount: 0,
        approvedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        wonCount: 0,
        totalQuotedValue: 0,
        totalWonValue: 0,
        totalDiscount: 0,
        avgDiscountPct: 0,
        winRate: 0,
      };
    }

    const item = repMap[repId];
    item.quotesCount += 1;
    const total = Number(q.totalAmount);
    const discount = Number(q.discountAmount);
    const subtotal = Number(q.subtotal);

    item.totalQuotedValue += total;
    item.totalDiscount += discount;

    if (q.approvalStatus === 'APPROVED') item.approvedCount += 1;
    if (['PENDING_MANAGER', 'PENDING_FINANCE'].includes(q.approvalStatus)) item.pendingCount += 1;
    if (q.approvalStatus === 'REJECTED') item.rejectedCount += 1;
    if (wonStatuses.includes(q.status)) {
      item.wonCount += 1;
      item.totalWonValue += total;
    }
  }

  // Calculate percentages and round numbers
  const rows = Object.values(repMap).map((r) => {
    const winRate = r.quotesCount > 0 ? Math.round((r.wonCount / r.quotesCount) * 1000) / 10 : 0;
    const avgDiscountPct = r.totalQuotedValue + r.totalDiscount > 0
      ? Math.round((r.totalDiscount / (r.totalQuotedValue + r.totalDiscount)) * 1000) / 10
      : 0;

    return {
      ...r,
      winRate,
      avgDiscountPct,
      totalQuotedValue: Math.round(r.totalQuotedValue * 100) / 100,
      totalWonValue: Math.round(r.totalWonValue * 100) / 100,
      totalDiscount: Math.round(r.totalDiscount * 100) / 100,
    };
  }).filter((r) => r.quotesCount > 0 || filters.salesRepId === r.repId);

  return rows;
}

/**
 * Returns detailed Approval and Risk telemetry report
 */
export async function getApprovalReport(tenantId, filters = {}) {
  const { quoteWhere } = buildFilterConditions(tenantId, filters);

  const quotes = await prisma.quotation.findMany({
    where: quoteWhere,
    include: {
      customer: { select: { name: true, companyName: true, tier: true } },
      salesRep: { select: { name: true, email: true } },
      approvals: {
        include: { approver: { select: { name: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100, // Safe page clamp
  });

  return quotes.map((q) => {
    const latestApproval = q.approvals[0] || null;
    return {
      id: q.id,
      quoteNumber: q.quoteNumber,
      customerName: q.customer?.name || q.customer?.companyName || 'Unknown Customer',
      customerTier: q.customer?.tier || 'BRONZE',
      salesRepName: q.salesRep?.name || 'Unassigned',
      totalAmount: Number(q.totalAmount),
      discountAmount: Number(q.discountAmount),
      riskScore: q.riskScore !== null ? Number(q.riskScore) : 0,
      riskLevel: q.riskLevel || 'LOW',
      approvalStatus: q.approvalStatus || 'APPROVED',
      status: q.status,
      approverName: latestApproval?.approver?.name || (q.approvalStatus === 'APPROVED' ? 'Auto-Approved / System' : '—'),
      decisionNotes: latestApproval?.comments || q.approvalNotes || '—',
      createdAt: q.createdAt.toISOString(),
      decisionDate: latestApproval?.decidedAt ? latestApproval.decidedAt.toISOString() : q.updatedAt.toISOString(),
    };
  });
}

/**
 * Returns Product & Category performance report
 */
export async function getProductCategoryReport(tenantId, filters = {}) {
  const { quoteWhere } = buildFilterConditions(tenantId, filters);
  const wonStatuses = ['CUSTOMER_CONFIRMED', 'FULFILLMENT', 'PARTIALLY_FULFILLED', 'FULFILLED', 'PAID'];

  // Fetch line items matching quotation conditions
  const items = await prisma.quotationItem.findMany({
    where: {
      quotation: quoteWhere,
      ...(filters.productId && filters.productId !== 'ALL' ? { productId: filters.productId } : {}),
      ...(filters.category && filters.category !== 'ALL' ? { productTypeSnapshot: filters.category } : {}),
    },
    include: {
      quotation: {
        select: { id: true, status: true, quoteNumber: true },
      },
      product: {
        select: { id: true, name: true, sku: true, type: true },
      },
    },
  });

  const productMap = {};

  for (const item of items) {
    const pid = item.productId;
    const cat = item.productTypeSnapshot || item.product?.type || 'HARDWARE';
    const name = item.productNameSnapshot || item.product?.name || 'Unknown Product';
    const isWon = wonStatuses.includes(item.quotation?.status);

    if (!productMap[pid]) {
      productMap[pid] = {
        productId: pid,
        productName: name,
        category: cat,
        quoteCount: 0,
        orderCount: 0,
        quantityQuoted: 0,
        quantitySold: 0,
        grossValue: 0,
        discountAmount: 0,
        netValue: 0,
      };
    }

    const p = productMap[pid];
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unitPrice) || 0;
    const lineTotal = Number(item.lineTotal) || 0;
    const discount = Number(item.discountAmount) || 0;

    p.quoteCount += 1;
    p.quantityQuoted += qty;
    p.grossValue += unitPrice * qty;
    p.discountAmount += discount;
    p.netValue += lineTotal;

    if (isWon) {
      p.orderCount += 1;
      p.quantitySold += qty;
    }
  }

  return Object.values(productMap).map((p) => ({
    ...p,
    grossValue: Math.round(p.grossValue * 100) / 100,
    discountAmount: Math.round(p.discountAmount * 100) / 100,
    netValue: Math.round(p.netValue * 100) / 100,
    discountPct: p.grossValue > 0 ? Math.round((p.discountAmount / p.grossValue) * 1000) / 10 : 0,
  })).sort((a, b) => b.netValue - a.netValue);
}

/**
 * Returns comprehensive Financial Cashflow & Invoicing report
 */
export async function getFinancialReport(tenantId, filters = {}) {
  const { dateFilter } = buildFilterConditions(tenantId, filters);

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        tenantId,
        ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
      },
      include: {
        customer: { select: { name: true, companyName: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.payment.findMany({
      where: {
        tenantId,
        ...(dateFilter.gte || dateFilter.lte ? { paidAt: dateFilter } : {}),
      },
      include: {
        invoice: { select: { invoiceNumber: true } },
        customer: { select: { name: true, companyName: true } },
      },
      orderBy: { paidAt: 'desc' },
      take: 100,
    }),
  ]);

  let totalOneTime = 0;
  let totalRecurringMRR = 0;

  for (const inv of invoices) {
    for (const item of inv.items) {
      if (item.billingType === 'RECURRING') {
        totalRecurringMRR += Number(item.lineTotal);
      } else {
        totalOneTime += Number(item.lineTotal);
      }
    }
  }

  return {
    invoices: invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customer?.name || inv.customer?.companyName || '—',
      totalAmount: Number(inv.totalAmount),
      amountPaid: Number(inv.amountPaid),
      amountDue: Number(inv.amountDue),
      status: inv.status,
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate.toISOString(),
    })),
    payments: payments.map((p) => ({
      id: p.id,
      transactionReference: p.transactionReference,
      invoiceNumber: p.invoice?.invoiceNumber || '—',
      customerName: p.customer?.name || p.customer?.companyName || '—',
      amount: Number(p.amount),
      refundedAmount: Number(p.refundedAmount),
      method: p.paymentMethod,
      status: p.status,
      paidAt: p.paidAt.toISOString(),
    })),
    hybridBreakdown: {
      totalOneTime: Math.round(totalOneTime * 100) / 100,
      totalRecurringMRR: Math.round(totalRecurringMRR * 100) / 100,
      totalRecurringARR: Math.round(totalRecurringMRR * 12 * 100) / 100,
    },
  };
}
