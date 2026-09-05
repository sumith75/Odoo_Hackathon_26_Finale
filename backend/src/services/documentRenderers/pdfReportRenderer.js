/**
 * pdfReportRenderer.js — DealFlow360 Executive Report PDF Generator
 *
 * Generates high-fidelity, branded management reports using PDFKit.
 * Includes:
 * - Branded header with organization details & report timestamp
 * - Applied filters summary pill box
 * - 4-column KPI metric summary grid
 * - Formatted sales performance, approvals, and product tables
 * - Multi-page pagination with page numbering
 */

import PDFDocument from 'pdfkit';

function formatCurrency(val, currency = 'INR') {
  const num = Number(val) || 0;
  return `INR ${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export async function generatePdfReport({
  organization = {},
  summary = {},
  salesPerformance = [],
  approvals = [],
  products = [],
  appliedFilters = {},
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const orgName = organization.name || 'DealFlow360 Enterprise';
      const currency = organization.currency || 'INR';
      const kpis = summary.kpis || {};

      // ── Header Banner ────────────────────────────────────────────────────────
      doc.rect(36, 36, 523, 60).fill('#0f172a');

      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
        .text('DealFlow360', 50, 48);
      doc.fillColor('#4ade80').fontSize(10).font('Helvetica')
        .text('EXECUTIVE SALES PERFORMANCE & GOVERNANCE REPORT', 50, 70);

      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
        .text(`Organization: ${orgName}`, 340, 48, { align: 'right', width: 200 })
        .text(`Generated: ${new Date().toLocaleString()}`, 340, 62, { align: 'right', width: 200 })
        .text(`Currency: ${currency}`, 340, 76, { align: 'right', width: 200 });

      doc.moveDown(2);

      // ── Active Filters Bar ───────────────────────────────────────────────────
      let y = 110;
      doc.rect(36, y, 523, 30).fill('#f1f5f9');
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold')
        .text('APPLIED FILTERS:', 46, y + 10);

      const filterParts = [];
      if (appliedFilters.period && appliedFilters.period !== 'ALL') filterParts.push(`Period: ${appliedFilters.period}`);
      if (appliedFilters.startDate) filterParts.push(`From: ${appliedFilters.startDate.substring(0, 10)}`);
      if (appliedFilters.endDate) filterParts.push(`To: ${appliedFilters.endDate.substring(0, 10)}`);
      if (appliedFilters.salesRepId && appliedFilters.salesRepId !== 'ALL') filterParts.push(`Rep Filtered`);
      if (appliedFilters.approvalStatus && appliedFilters.approvalStatus !== 'ALL') filterParts.push(`Approval: ${appliedFilters.approvalStatus}`);
      if (appliedFilters.category && appliedFilters.category !== 'ALL') filterParts.push(`Category: ${appliedFilters.category}`);

      const filterText = filterParts.length > 0 ? filterParts.join('  |  ') : 'All Data (Unfiltered)';
      doc.fillColor('#0f766e').fontSize(8).font('Helvetica')
        .text(filterText, 140, y + 10, { width: 400 });

      // ── KPI Summary Cards (2 rows of 4) ──────────────────────────────────────
      y = 152;
      const kpiItems = [
        { label: 'Total Quotes', val: String(kpis.totalQuotes || 0) },
        { label: 'Won Orders', val: String(kpis.wonOrdersCount || 0) },
        { label: 'Win Rate', val: `${kpis.winRate || 0}%` },
        { label: 'Quoted Pipeline', val: formatCurrency(kpis.totalQuotedValue, currency) },
        { label: 'Won Revenue', val: formatCurrency(kpis.totalWonValue, currency) },
        { label: 'Total Discounts', val: formatCurrency(kpis.totalDiscount, currency) },
        { label: 'Invoiced Amount', val: formatCurrency(kpis.invoicedAmount, currency) },
        { label: 'Settled Payments', val: formatCurrency(kpis.paidAmount, currency) },
      ];

      const cardW = 124;
      const cardH = 40;
      const cardGap = 9;

      kpiItems.forEach((item, idx) => {
        const row = Math.floor(idx / 4);
        const col = idx % 4;
        const cx = 36 + col * (cardW + cardGap);
        const cy = y + row * (cardH + 6);

        doc.rect(cx, cy, cardW, cardH).fillAndStroke('#ffffff', '#e2e8f0');
        doc.fillColor('#64748b').fontSize(7).font('Helvetica')
          .text(item.label.toUpperCase(), cx + 6, cy + 6);
        doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
          .text(item.val, cx + 6, cy + 20, { width: cardW - 12, ellipsis: true });
      });

      // ── Section 1: Sales Rep Performance Table ───────────────────────────────
      y = 250;
      doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold')
        .text('Sales Team Performance Breakdown', 36, y);

      y += 18;
      // Header
      doc.rect(36, y, 523, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('Sales Representative', 44, y + 6);
      doc.text('Quotes', 190, y + 6, { width: 40, align: 'right' });
      doc.text('Won', 240, y + 6, { width: 35, align: 'right' });
      doc.text('Win %', 285, y + 6, { width: 40, align: 'right' });
      doc.text('Quoted Value', 335, y + 6, { width: 75, align: 'right' });
      doc.text('Won Value', 415, y + 6, { width: 70, align: 'right' });
      doc.text('Discount', 490, y + 6, { width: 60, align: 'right' });

      y += 20;
      doc.font('Helvetica');

      if (salesPerformance.length === 0) {
        doc.rect(36, y, 523, 22).fill('#f8fafc');
        doc.fillColor('#64748b').fontSize(8)
          .text('No sales performance records found for active filters.', 44, y + 7);
        y += 22;
      } else {
        salesPerformance.slice(0, 8).forEach((rep, idx) => {
          const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(36, y, 523, 20).fill(bg);
          doc.fillColor('#0f172a').fontSize(8);
          doc.text(rep.repName || 'Unknown', 44, y + 6, { width: 140, ellipsis: true });
          doc.text(String(rep.quotesCount), 190, y + 6, { width: 40, align: 'right' });
          doc.text(String(rep.wonCount), 240, y + 6, { width: 35, align: 'right' });
          doc.text(`${rep.winRate}%`, 285, y + 6, { width: 40, align: 'right' });
          doc.text(formatCurrency(rep.totalQuotedValue, currency), 335, y + 6, { width: 75, align: 'right' });
          doc.text(formatCurrency(rep.totalWonValue, currency), 415, y + 6, { width: 70, align: 'right' });
          doc.text(formatCurrency(rep.totalDiscount, currency), 490, y + 6, { width: 60, align: 'right' });
          y += 20;
        });
      }

      // ── Section 2: Top Products & Categories ─────────────────────────────────
      y += 16;
      if (y > 660) {
        doc.addPage();
        y = 50;
      }

      doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold')
        .text('Product Sales & Discount Analysis', 36, y);

      y += 18;
      doc.rect(36, y, 523, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('Product Name', 44, y + 6);
      doc.text('Category', 220, y + 6);
      doc.text('Qty Sold', 310, y + 6, { width: 45, align: 'right' });
      doc.text('Gross Value', 365, y + 6, { width: 65, align: 'right' });
      doc.text('Discount', 435, y + 6, { width: 55, align: 'right' });
      doc.text('Net Sold Value', 495, y + 6, { width: 60, align: 'right' });

      y += 20;
      doc.font('Helvetica');

      if (products.length === 0) {
        doc.rect(36, y, 523, 22).fill('#f8fafc');
        doc.fillColor('#64748b').fontSize(8)
          .text('No product sales data available for active filters.', 44, y + 7);
        y += 22;
      } else {
        products.slice(0, 8).forEach((prod, idx) => {
          const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(36, y, 523, 20).fill(bg);
          doc.fillColor('#0f172a').fontSize(8);
          doc.text(prod.productName || 'Unknown', 44, y + 6, { width: 170, ellipsis: true });
          doc.fillColor('#0f766e').text(prod.category || 'HARDWARE', 220, y + 6);
          doc.fillColor('#0f172a');
          doc.text(String(prod.quantitySold), 310, y + 6, { width: 45, align: 'right' });
          doc.text(formatCurrency(prod.grossValue, currency), 365, y + 6, { width: 65, align: 'right' });
          doc.text(formatCurrency(prod.discountAmount, currency), 435, y + 6, { width: 55, align: 'right' });
          doc.text(formatCurrency(prod.netValue, currency), 495, y + 6, { width: 60, align: 'right' });
          y += 20;
        });
      }

      // ── Section 3: Governance & Approval Stream ──────────────────────────────
      y += 16;
      if (y > 660) {
        doc.addPage();
        y = 50;
      }

      doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold')
        .text('Recent Deal Approvals & Risk Telemetry', 36, y);

      y += 18;
      doc.rect(36, y, 523, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('Quote #', 44, y + 6);
      doc.text('Customer', 140, y + 6);
      doc.text('Risk', 270, y + 6);
      doc.text('Status', 330, y + 6);
      doc.text('Approver', 410, y + 6);
      doc.text('Deal Value', 490, y + 6, { width: 60, align: 'right' });

      y += 20;
      doc.font('Helvetica');

      if (approvals.length === 0) {
        doc.rect(36, y, 523, 22).fill('#f8fafc');
        doc.fillColor('#64748b').fontSize(8)
          .text('No approval records found matching filters.', 44, y + 7);
        y += 22;
      } else {
        approvals.slice(0, 8).forEach((app, idx) => {
          const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(36, y, 523, 20).fill(bg);
          doc.fillColor('#0f172a').fontSize(8);
          doc.text(app.quoteNumber, 44, y + 6);
          doc.text(app.customerName, 140, y + 6, { width: 120, ellipsis: true });
          doc.fillColor(app.riskScore > 60 ? '#b91c1c' : '#15803d')
            .text(`${app.riskScore}/100 (${app.riskLevel})`, 270, y + 6);
          doc.fillColor('#0f172a').text(app.approvalStatus, 330, y + 6);
          doc.text(app.approverName, 410, y + 6, { width: 75, ellipsis: true });
          doc.text(formatCurrency(app.totalAmount, currency), 490, y + 6, { width: 60, align: 'right' });
          y += 20;
        });
      }

      // ── Page Numbers & Footer on all buffered pages ──────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.rect(36, 792 - 36, 523, 1).fill('#e2e8f0');
        doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
          .text(
            `DealFlow360 Executive Report  |  Confidential & Proprietary  |  Page ${i + 1} of ${range.count}`,
            36,
            792 - 28,
            { align: 'center', width: 523 }
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
