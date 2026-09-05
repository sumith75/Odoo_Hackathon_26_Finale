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

  // 1. Fetch sales reps for tenant, and aggregate quote totals in Postgres
  // (groupBy) rather than pulling every matching quotation row into memory —
  // this scales to the whole quote history without a response-time cliff.
  const [salesReps, byApprovalStatus, byWonStatus] = await Promise.all([
    prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['SALES_REP', 'ADMIN', 'SALES_MANAGER'] },
        ...(filters.salesRepId && filters.salesRepId !== 'ALL' ? { id: filters.salesRepId } : {}),
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.quotation.groupBy({
      by: ['salesRepId', 'approvalStatus'],
      where: quoteWhere,
      _count: { _all: true },
      _sum: { totalAmount: true, discountAmount: true },
    }),
    prisma.quotation.groupBy({
      by: ['salesRepId'],
      where: { ...quoteWhere, status: { in: wonStatuses } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
  ]);

  const repMap = {};
  const ensureRep = (repId, name, email, role) => {
    if (!repMap[repId]) {
      repMap[repId] = {
        repId,
        repName: name,
        repEmail: email,
        role,
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
    return repMap[repId];
  };

  for (const rep of salesReps) {
    ensureRep(rep.id, rep.name, rep.email, rep.role);
  }

  for (const row of byApprovalStatus) {
    const rep = ensureRep(row.salesRepId, 'Unassigned / System', '—', 'SYSTEM');
    const count = row._count._all;

    rep.quotesCount += count;
    rep.totalQuotedValue += Number(row._sum.totalAmount || 0);
    rep.totalDiscount += Number(row._sum.discountAmount || 0);

    if (row.approvalStatus === 'APPROVED') rep.approvedCount += count;
    else if (row.approvalStatus === 'PENDING_MANAGER' || row.approvalStatus === 'PENDING_FINANCE') rep.pendingCount += count;
    else if (row.approvalStatus === 'REJECTED') rep.rejectedCount += count;
  }

  for (const row of byWonStatus) {
    const rep = ensureRep(row.salesRepId, 'Unassigned / System', '—', 'SYSTEM');
    rep.wonCount += row._count._all;
    rep.totalWonValue += Number(row._sum.totalAmount || 0);
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

  const itemWhere = {
    quotation: quoteWhere,
    ...(filters.productId && filters.productId !== 'ALL' ? { productId: filters.productId } : {}),
    ...(filters.category && filters.category !== 'ALL' ? { productTypeSnapshot: filters.category } : {}),
  };

  // Aggregate per product in Postgres (groupBy) instead of pulling every
  // matching line item into memory — the response stays one row per
  // product regardless of how many quotation_items exist.
  const [allTotals, wonTotals] = await Promise.all([
    prisma.quotationItem.groupBy({
      by: ['productId'],
      where: itemWhere,
      _count: { _all: true },
      _sum: { quantity: true, lineTotal: true, discountAmount: true, taxAmount: true },
    }),
    prisma.quotationItem.groupBy({
      by: ['productId'],
      where: { ...itemWhere, quotation: { ...quoteWhere, status: { in: wonStatuses } } },
      _count: { _all: true },
      _sum: { quantity: true },
    }),
  ]);

  if (allTotals.length === 0) return [];

  // Display name/category aren't part of the aggregation — one bounded
  // lookup for the distinct products involved, not a per-row join.
  const productIds = allTotals.map((row) => row.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, type: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  const wonByProduct = new Map(wonTotals.map((row) => [row.productId, row]));

  return allTotals
    .map((row) => {
      const won = wonByProduct.get(row.productId);
      const product = productById.get(row.productId);
      const netValue = Number(row._sum.lineTotal || 0);
      const discountAmount = Number(row._sum.discountAmount || 0);
      const taxAmount = Number(row._sum.taxAmount || 0);
      // Exact identity from the pricing engine (lineTotal = gross - discount + tax),
      // so gross value is derived from the aggregated sums instead of re-fetching
      // every line to recompute unitPrice * quantity.
      const grossValue = netValue - taxAmount + discountAmount;

      return {
        productId: row.productId,
        productName: product?.name || 'Unknown Product',
        category: product?.type || 'HARDWARE',
        quoteCount: row._count._all,
        orderCount: won?._count._all || 0,
        quantityQuoted: row._sum.quantity || 0,
        quantitySold: won?._sum.quantity || 0,
        grossValue: Math.round(grossValue * 100) / 100,
        discountAmount: Math.round(discountAmount * 100) / 100,
        netValue: Math.round(netValue * 100) / 100,
        discountPct: grossValue > 0 ? Math.round((discountAmount / grossValue) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.netValue - a.netValue);
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
