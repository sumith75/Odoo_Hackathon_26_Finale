/**
 * xlsxReportRenderer.js — DealFlow360 Multi-Sheet Excel Workbook Generator
 *
 * Uses ExcelJS to generate professional, formatted spreadsheet workbooks:
 * - Sheet 1: Executive Summary & KPIs
 * - Sheet 2: Sales Team Performance
 * - Sheet 3: Governance & Approvals
 * - Sheet 4: Product & Category Analysis
 * - Sheet 5: Invoices & Settlement
 */

import ExcelJS from 'exceljs';

export async function generateXlsxReport({
  organization = {},
  summary = {},
  salesPerformance = [],
  approvals = [],
  products = [],
  financial = {},
  appliedFilters = {},
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DealFlow360 Reporting Engine';
  workbook.lastModifiedBy = 'DealFlow360';
  workbook.created = new Date();
  workbook.modified = new Date();

  const orgName = organization.name || 'DealFlow360 Enterprise';
  const currency = organization.currency || 'INR';
  const kpis = summary.kpis || {};

  // Color Palettes
  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Dark slate
  };
  const headerFont = {
    name: 'Segoe UI',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  const subHeaderFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' }, // Slate-100
  };
  const borderStyle = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 1: Executive Summary & KPIs
  // ═══════════════════════════════════════════════════════════════════════════
  const summarySheet = workbook.addWorksheet('Executive Summary', {
    views: [{ showGridLines: true }],
  });

  summarySheet.columns = [
    { header: '', key: 'colA', width: 28 },
    { header: '', key: 'colB', width: 24 },
    { header: '', key: 'colC', width: 28 },
    { header: '', key: 'colD', width: 24 },
  ];

  // Title
  summarySheet.mergeCells('A1:D1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = `DealFlow360 — ${orgName.toUpperCase()}`;
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle' };
  summarySheet.getRow(1).height = 30;

  summarySheet.mergeCells('A2:D2');
  const subtitleCell = summarySheet.getCell('A2');
  subtitleCell.value = `Executive Sales Performance & Governance Report  |  Generated on ${new Date().toLocaleString()}`;
  subtitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
  summarySheet.getRow(2).height = 20;

  // Filters Block
  summarySheet.getCell('A4').value = 'APPLIED FILTERS';
  summarySheet.getCell('A4').font = { bold: true, size: 11, color: { argb: 'FF0F766E' } };

  summarySheet.getCell('A5').value = 'Period Preset:';
  summarySheet.getCell('B5').value = appliedFilters.period || 'ALL';
  summarySheet.getCell('C5').value = 'Approval Status:';
  summarySheet.getCell('D5').value = appliedFilters.approvalStatus || 'ALL';

  summarySheet.getCell('A6').value = 'Date Range:';
  summarySheet.getCell('B6').value = `${appliedFilters.startDate || 'Beginning'} — ${appliedFilters.endDate || 'Present'}`;
  summarySheet.getCell('C6').value = 'Product Category:';
  summarySheet.getCell('D6').value = appliedFilters.category || 'ALL';

  ['A5', 'A6', 'C5', 'C6'].forEach((c) => {
    summarySheet.getCell(c).font = { bold: true, size: 10 };
  });

  // KPI Table
  summarySheet.getCell('A8').value = 'KEY PERFORMANCE INDICATORS';
  summarySheet.getCell('A8').font = { bold: true, size: 12, color: { argb: 'FF15803D' } };

  const kpiRows = [
    ['Total Quotations Created', kpis.totalQuotes || 0, 'Quoted Pipeline Total', kpis.totalQuotedValue || 0],
    ['Approved Quotations', kpis.approvedQuotes || 0, 'Won Deal Revenue', kpis.totalWonValue || 0],
    ['Pending Review / Approvals', kpis.pendingApprovals || 0, 'Total Discounts Approved', kpis.totalDiscount || 0],
    ['Confirmed Orders Won', kpis.wonOrdersCount || 0, 'Average Deal Size', kpis.avgDealValue || 0],
    ['Deal Win Rate %', `${kpis.winRate || 0}%`, 'Total Invoiced Amount', kpis.invoicedAmount || 0],
    ['Rejected Quotations', kpis.rejectedQuotes || 0, 'Settled Payments (Cash)', kpis.paidAmount || 0],
    ['Invoices Issued Count', kpis.invoicesCount || 0, 'Outstanding Debt (Due)', kpis.outstandingAmount || 0],
  ];

  kpiRows.forEach((r, idx) => {
    const rowNum = 9 + idx;
    summarySheet.getCell(`A${rowNum}`).value = r[0];
    summarySheet.getCell(`B${rowNum}`).value = r[1];
    summarySheet.getCell(`C${rowNum}`).value = r[2];
    summarySheet.getCell(`D${rowNum}`).value = r[3];

    summarySheet.getCell(`A${rowNum}`).font = { size: 10, color: { argb: 'FF334155' } };
    summarySheet.getCell(`B${rowNum}`).font = { size: 11, bold: true, color: { argb: 'FF0F172A' } };
    summarySheet.getCell(`C${rowNum}`).font = { size: 10, color: { argb: 'FF334155' } };
    summarySheet.getCell(`D${rowNum}`).font = { size: 11, bold: true, color: { argb: 'FF0F172A' } };

    if (typeof r[3] === 'number') {
      summarySheet.getCell(`D${rowNum}`).numFmt = '#,##0.00';
    }
    if (typeof r[1] === 'number' && idx === 0 && r[1] > 1000) {
      summarySheet.getCell(`B${rowNum}`).numFmt = '#,##0';
    }

    ['A', 'B', 'C', 'D'].forEach((col) => {
      summarySheet.getCell(`${col}${rowNum}`).border = borderStyle;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 2: Sales Team Performance
  // ═══════════════════════════════════════════════════════════════════════════
  const repSheet = workbook.addWorksheet('Sales Performance', {
    views: [{ showGridLines: true }],
  });

  repSheet.columns = [
    { header: 'Representative Name', key: 'name', width: 25 },
    { header: 'Email Address', key: 'email', width: 30 },
    { header: 'Role', key: 'role', width: 16 },
    { header: 'Quotes Created', key: 'quotesCount', width: 16 },
    { header: 'Approved', key: 'approvedCount', width: 14 },
    { header: 'Pending', key: 'pendingCount', width: 14 },
    { header: 'Rejected', key: 'rejectedCount', width: 14 },
    { header: 'Orders Won', key: 'wonCount', width: 14 },
    { header: 'Win Rate %', key: 'winRate', width: 14 },
    { header: 'Total Quoted Value', key: 'totalQuotedValue', width: 22 },
    { header: 'Won Revenue', key: 'totalWonValue', width: 22 },
    { header: 'Discounts Given', key: 'totalDiscount', width: 20 },
    { header: 'Avg Discount %', key: 'avgDiscountPct', width: 16 },
  ];

  const repHeaderRow = repSheet.getRow(1);
  repHeaderRow.height = 24;
  repHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  salesPerformance.forEach((rep, idx) => {
    const row = repSheet.addRow({
      name: rep.repName,
      email: rep.repEmail,
      role: rep.role,
      quotesCount: rep.quotesCount,
      approvedCount: rep.approvedCount,
      pendingCount: rep.pendingCount,
      rejectedCount: rep.rejectedCount,
      wonCount: rep.wonCount,
      winRate: `${rep.winRate}%`,
      totalQuotedValue: rep.totalQuotedValue,
      totalWonValue: rep.totalWonValue,
      totalDiscount: rep.totalDiscount,
      avgDiscountPct: `${rep.avgDiscountPct}%`,
    });

    row.height = 20;
    const bgFill = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    row.eachCell((cell, colNumber) => {
      cell.border = borderStyle;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgFill } };
      if (colNumber >= 10 && colNumber <= 12) {
        cell.numFmt = '#,##0.00';
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 3: Governance & Approvals
  // ═══════════════════════════════════════════════════════════════════════════
  const appSheet = workbook.addWorksheet('Governance & Approvals', {
    views: [{ showGridLines: true }],
  });

  appSheet.columns = [
    { header: 'Quote Number', key: 'quoteNumber', width: 22 },
    { header: 'Customer Name', key: 'customerName', width: 26 },
    { header: 'Tier', key: 'customerTier', width: 14 },
    { header: 'Sales Rep', key: 'salesRepName', width: 22 },
    { header: 'Risk Score', key: 'riskScore', width: 14 },
    { header: 'Risk Level', key: 'riskLevel', width: 14 },
    { header: 'Approval Status', key: 'approvalStatus', width: 18 },
    { header: 'Approver', key: 'approverName', width: 22 },
    { header: 'Decision / Comments', key: 'decisionNotes', width: 35 },
    { header: 'Deal Amount', key: 'totalAmount', width: 20 },
    { header: 'Discount Amount', key: 'discountAmount', width: 18 },
    { header: 'Created Date', key: 'createdAt', width: 20 },
  ];

  const appHeaderRow = appSheet.getRow(1);
  appHeaderRow.height = 24;
  appHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  approvals.forEach((app, idx) => {
    const row = appSheet.addRow({
      quoteNumber: app.quoteNumber,
      customerName: app.customerName,
      customerTier: app.customerTier,
      salesRepName: app.salesRepName,
      riskScore: app.riskScore,
      riskLevel: app.riskLevel,
      approvalStatus: app.approvalStatus,
      approverName: app.approverName,
      decisionNotes: app.decisionNotes,
      totalAmount: app.totalAmount,
      discountAmount: app.discountAmount,
      createdAt: app.createdAt.substring(0, 10),
    });

    row.height = 20;
    const bgFill = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    row.eachCell((cell, colNumber) => {
      cell.border = borderStyle;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgFill } };
      if (colNumber === 10 || colNumber === 11) {
        cell.numFmt = '#,##0.00';
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 4: Products & Categories
  // ═══════════════════════════════════════════════════════════════════════════
  const prodSheet = workbook.addWorksheet('Products & Categories', {
    views: [{ showGridLines: true }],
  });

  prodSheet.columns = [
    { header: 'Product Name', key: 'productName', width: 30 },
    { header: 'Category / Type', key: 'category', width: 18 },
    { header: 'Quoted Volume', key: 'quantityQuoted', width: 16 },
    { header: 'Orders Sold Qty', key: 'quantitySold', width: 16 },
    { header: 'Gross Quoted Value', key: 'grossValue', width: 22 },
    { header: 'Discount Given', key: 'discountAmount', width: 20 },
    { header: 'Net Settled Value', key: 'netValue', width: 22 },
    { header: 'Discount %', key: 'discountPct', width: 14 },
  ];

  const prodHeaderRow = prodSheet.getRow(1);
  prodHeaderRow.height = 24;
  prodHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  products.forEach((prod, idx) => {
    const row = prodSheet.addRow({
      productName: prod.productName,
      category: prod.category,
      quantityQuoted: prod.quantityQuoted,
      quantitySold: prod.quantitySold,
      grossValue: prod.grossValue,
      discountAmount: prod.discountAmount,
      netValue: prod.netValue,
      discountPct: `${prod.discountPct}%`,
    });

    row.height = 20;
    const bgFill = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    row.eachCell((cell, colNumber) => {
      cell.border = borderStyle;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgFill } };
      if (colNumber >= 5 && colNumber <= 7) {
        cell.numFmt = '#,##0.00';
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 5: Invoices & Cashflow Settlement
  // ═══════════════════════════════════════════════════════════════════════════
  const finSheet = workbook.addWorksheet('Settlement & Invoices', {
    views: [{ showGridLines: true }],
  });

  finSheet.columns = [
    { header: 'Invoice Number', key: 'invoiceNumber', width: 20 },
    { header: 'Customer', key: 'customerName', width: 26 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Total Invoiced', key: 'totalAmount', width: 20 },
    { header: 'Amount Paid', key: 'amountPaid', width: 20 },
    { header: 'Amount Due', key: 'amountDue', width: 20 },
    { header: 'Issue Date', key: 'issueDate', width: 16 },
    { header: 'Due Date', key: 'dueDate', width: 16 },
  ];

  const finHeaderRow = finSheet.getRow(1);
  finHeaderRow.height = 24;
  finHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const invoices = financial.invoices || [];
  invoices.forEach((inv, idx) => {
    const row = finSheet.addRow({
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customerName,
      status: inv.status,
      totalAmount: inv.totalAmount,
      amountPaid: inv.amountPaid,
      amountDue: inv.amountDue,
      issueDate: inv.issueDate.substring(0, 10),
      dueDate: inv.dueDate.substring(0, 10),
    });

    row.height = 20;
    const bgFill = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    row.eachCell((cell, colNumber) => {
      cell.border = borderStyle;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgFill } };
      if (colNumber >= 4 && colNumber <= 6) {
        cell.numFmt = '#,##0.00';
      }
    });
  });

  // Generate buffer
  return await workbook.xlsx.writeBuffer();
}
