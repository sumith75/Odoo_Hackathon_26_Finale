/**
 * invoicePdfRenderer.js — DealFlow360 Professional B2B Tax Invoice Generator
 *
 * Generates an ultra-professional, customer-safe B2B Tax Invoice PDF using PDFKit:
 * - Enterprise branding & Organization information
 * - Invoice details (number, issue date, due date, status badge)
 * - Customer billing details & tax identification
 * - Itemized line items table with separate One-Time Capex and Recurring Opex breakdown
 * - Subtotals, discounts, taxes, and grand totals
 * - Payment History / Settlement Ledger (amount paid, remaining balance due)
 * - Customer-safe: excludes internal costs, margins, and risk scores
 */

import PDFDocument from 'pdfkit';

function formatCurrency(val, currency = 'INR') {
  const num = Number(val) || 0;
  return `INR ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function generateInvoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const org = invoice.tenant || {};
      const customer = invoice.customer || {};
      const quote = invoice.quotation || {};
      const items = invoice.items || [];
      const payments = invoice.payments || [];
      const currency = invoice.currency || 'INR';

      const totalAmount = Number(invoice.totalAmount) || 0;
      const amountPaid = Number(invoice.amountPaid) || 0;
      const amountDue = Number(invoice.amountDue) || 0;
      const isPaid = invoice.status === 'PAID';
      const isPartial = invoice.status === 'PARTIALLY_PAID';

      // ── Header Box ───────────────────────────────────────────────────────────
      doc.rect(36, 36, 523, 75).fill('#0f172a'); // Dark slate header

      // Brand Title
      doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
        .text('DealFlow360', 50, 48);
      doc.fillColor('#4ade80').fontSize(10).font('Helvetica')
        .text('COMMERCIAL B2B TAX INVOICE', 50, 72);

      // Org info right side
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
        .text(org.name || 'TechWorld Solutions Pvt Ltd', 320, 48, { align: 'right', width: 225 });
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
        .text('Enterprise Cloud & Datacenter Solutions', 320, 62, { align: 'right', width: 225 })
        .text(`Tax / GST: ${org.taxNumber || 'GSTIN29AABCU9603R1ZM'}`, 320, 74, { align: 'right', width: 225 })
        .text(`Currency: ${currency}`, 320, 86, { align: 'right', width: 225 });

      // ── Invoice Details & Status Strip ───────────────────────────────────────
      let y = 122;
      doc.rect(36, y, 523, 50).fill('#f8fafc');
      doc.rect(36, y, 523, 50).stroke('#e2e8f0');

      // Invoice metadata
      doc.fillColor('#64748b').fontSize(8).font('Helvetica')
        .text('INVOICE NUMBER', 48, y + 8)
        .text('ISSUE DATE', 165, y + 8)
        .text('PAYMENT DUE DATE', 265, y + 8)
        .text('SETTLEMENT STATUS', 380, y + 8);

      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
        .text(invoice.invoiceNumber, 48, y + 22)
        .text(new Date(invoice.issueDate).toLocaleDateString(), 165, y + 22)
        .text(new Date(invoice.dueDate).toLocaleDateString(), 265, y + 22);

      // Status Pill
      const statusBg = isPaid ? '#dcfce7' : isPartial ? '#fef3c7' : '#e0f2fe';
      const statusColor = isPaid ? '#15803d' : isPartial ? '#b45309' : '#0369a1';
      doc.rect(380, y + 18, 100, 20).fill(statusBg);
      doc.fillColor(statusColor).fontSize(9).font('Helvetica-Bold')
        .text(invoice.status, 380, y + 24, { width: 100, align: 'center' });

      // ── Customer & Order Info Cards ──────────────────────────────────────────
      y = 182;
      const boxW = 256;
      const boxH = 75;

      // Customer Card (Left)
      doc.rect(36, y, boxW, boxH).fill('#ffffff');
      doc.rect(36, y, boxW, boxH).stroke('#e2e8f0');

      doc.fillColor('#0f766e').fontSize(8).font('Helvetica-Bold')
        .text('BILLED TO (CUSTOMER)', 46, y + 8);
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold')
        .text(customer.companyName || customer.name || 'Valued Customer', 46, y + 22, { width: boxW - 20, ellipsis: true });
      doc.fillColor('#475569').fontSize(8).font('Helvetica')
        .text(`Attention: ${customer.name || 'Accounts Payable'}`, 46, y + 36)
        .text(`Email: ${customer.email || '—'}`, 46, y + 48)
        .text(`Tax / GST: ${customer.taxNumber || 'Unspecified'}`, 46, y + 60);

      // Order / Deal Reference Card (Right)
      const rx = 36 + boxW + 11;
      doc.rect(rx, y, boxW, boxH).fill('#ffffff');
      doc.rect(rx, y, boxW, boxH).stroke('#e2e8f0');

      doc.fillColor('#0f766e').fontSize(8).font('Helvetica-Bold')
        .text('DEAL & CONTRACT REFERENCE', rx + 10, y + 8);
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold')
        .text(`Quote: ${quote.quoteNumber || 'Direct Order'}`, rx + 10, y + 22);
      doc.fillColor('#475569').fontSize(8).font('Helvetica')
        .text(`Customer Tier: ${customer.tier || 'STANDARD'}`, rx + 10, y + 36)
        .text(`Contract Type: Hybrid (One-Time + SLA)`, rx + 10, y + 48)
        .text(`Billing Type: ${invoice.invoiceType || 'COMMERCIAL'}`, rx + 10, y + 60);

      // ── Line Items Table ─────────────────────────────────────────────────────
      y = 268;
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
        .text('Itemized Statement of Products & Services', 36, y);

      y += 16;
      doc.rect(36, y, 523, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('Item Description', 44, y + 6);
      doc.text('Billing Type', 220, y + 6);
      doc.text('Qty', 295, y + 6, { width: 30, align: 'right' });
      doc.text('Unit Price', 335, y + 6, { width: 55, align: 'right' });
      doc.text('Discount', 400, y + 6, { width: 50, align: 'right' });
      doc.text('Line Total', 460, y + 6, { width: 90, align: 'right' });

      y += 20;
      doc.font('Helvetica');

      if (items.length === 0) {
        doc.rect(36, y, 523, 22).fill('#ffffff');
        doc.fillColor('#64748b').fontSize(8).text('No line items recorded.', 44, y + 7);
        y += 22;
      } else {
        items.forEach((item, idx) => {
          const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(36, y, 523, 22).fill(bg);
          doc.rect(36, y, 523, 22).stroke('#f1f5f9');

          doc.fillColor('#0f172a').fontSize(8);
          doc.text(item.description || item.product?.name || 'Product Item', 44, y + 6, { width: 170, ellipsis: true });

          const isSub = item.billingType === 'RECURRING';
          doc.fillColor(isSub ? '#7c3aed' : '#0f766e').fontSize(7).font('Helvetica-Bold')
            .text(isSub ? 'RECURRING / MO' : 'ONE-TIME', 220, y + 7);

          doc.font('Helvetica').fillColor('#0f172a').fontSize(8);
          doc.text(String(item.quantity), 295, y + 6, { width: 30, align: 'right' });
          doc.text(formatCurrency(item.unitPrice, currency), 335, y + 6, { width: 55, align: 'right' });
          doc.text(formatCurrency(item.discountAmount, currency), 400, y + 6, { width: 50, align: 'right' });
          doc.font('Helvetica-Bold').text(formatCurrency(item.lineTotal, currency), 460, y + 6, { width: 90, align: 'right' });

          y += 22;
        });
      }

      // ── Totals & Summary Block ───────────────────────────────────────────────
      y += 10;
      const totW = 220;
      const totX = 36 + 523 - totW;

      doc.rect(totX, y, totW, 90).fill('#f8fafc');
      doc.rect(totX, y, totW, 90).stroke('#e2e8f0');

      doc.fillColor('#64748b').fontSize(8).font('Helvetica');
      doc.text('Subtotal:', totX + 12, y + 8);
      doc.text('Total Discount:', totX + 12, y + 22);
      doc.text('Taxes (GST):', totX + 12, y + 36);

      doc.fillColor('#0f172a').fontSize(8).font('Helvetica', 'right');
      doc.text(formatCurrency(invoice.subtotal, currency), totX + 90, y + 8, { width: totW - 102, align: 'right' });
      doc.text(formatCurrency(invoice.discountAmount, currency), totX + 90, y + 22, { width: totW - 102, align: 'right' });
      doc.text(formatCurrency(invoice.taxAmount, currency), totX + 90, y + 36, { width: totW - 102, align: 'right' });

      doc.rect(totX, y + 50, totW, 1).fill('#cbd5e1');

      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold');
      doc.text('Grand Total:', totX + 12, y + 56);
      doc.text(formatCurrency(totalAmount, currency), totX + 90, y + 56, { width: totW - 102, align: 'right' });

      doc.fillColor('#15803d').fontSize(8);
      doc.text('Amount Paid:', totX + 12, y + 74);
      doc.text(formatCurrency(amountPaid, currency), totX + 90, y + 74, { width: totW - 102, align: 'right' });

      // Amount Due Highlight Box
      doc.rect(36, y, 280, 90).fill(isPaid ? '#f0fdf4' : '#fffbeb');
      doc.rect(36, y, 280, 90).stroke(isPaid ? '#86efac' : '#fde68a');

      doc.fillColor(isPaid ? '#15803d' : '#92400e').fontSize(10).font('Helvetica-Bold')
        .text(isPaid ? 'INVOICE SETTLED IN FULL' : 'PAYMENT DUE UPON RECEIPT', 48, y + 14);

      doc.fillColor('#475569').fontSize(8).font('Helvetica')
        .text(isPaid
          ? 'Thank you! Full payment has been received and verified.'
          : 'Please transfer the balance due before the due date.', 48, y + 30);

      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold')
        .text('Remaining Amount Due:', 48, y + 56);
      doc.fillColor(isPaid ? '#15803d' : '#b91c1c').fontSize(14).font('Helvetica-Bold')
        .text(formatCurrency(amountDue, currency), 48, y + 68);

      // ── Payment Settlement Ledger Table ──────────────────────────────────────
      y += 105;
      if (payments.length > 0) {
        doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
          .text('Payment Settlement History', 36, y);

        y += 16;
        doc.rect(36, y, 523, 18).fill('#334155');
        doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold');
        doc.text('Transaction Reference', 44, y + 5);
        doc.text('Paid At', 190, y + 5);
        doc.text('Method', 270, y + 5);
        doc.text('Status', 350, y + 5);
        doc.text('Amount Settled', 440, y + 5, { width: 110, align: 'right' });

        y += 18;
        doc.font('Helvetica');

        payments.forEach((p, idx) => {
          const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(36, y, 523, 18).fill(bg);
          doc.rect(36, y, 523, 18).stroke('#e2e8f0');

          doc.fillColor('#0f172a').fontSize(7.5);
          doc.text(p.transactionReference, 44, y + 5);
          doc.text(new Date(p.paidAt).toLocaleString(), 190, y + 5);
          doc.text(p.paymentMethod, 270, y + 5);
          doc.fillColor(p.status === 'SUCCEEDED' ? '#15803d' : '#b45309')
            .text(p.status, 350, y + 5);
          doc.fillColor('#0f172a').font('Helvetica-Bold')
            .text(formatCurrency(p.amount, currency), 440, y + 5, { width: 110, align: 'right' });
          doc.font('Helvetica');
          y += 18;
        });
      }

      // ── Footer on all pages ──────────────────────────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.rect(36, 792 - 36, 523, 1).fill('#e2e8f0');
        doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
          .text(
            `DealFlow360 Official B2B Tax Invoice  |  ${invoice.invoiceNumber}  |  Page ${i + 1} of ${range.count}`,
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

export { generateInvoicePdf as generateInvoicePdfBuffer };
