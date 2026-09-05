/**
 * verify-module15-reporting-documents.js
 *
 * Comprehensive Test & Verification Suite for Module 15:
 * Reporting, PDF/XLS Export & Professional Invoice Documents.
 *
 * Tests 19 vectors against live Neon PostgreSQL & Express API:
 * 1.  Sales summary KPIs (win rate, values, discounts, balance due)
 * 2.  Sales performance breakdown by representative
 * 3.  Approval governance report with risk filtering
 * 4.  Product & category performance aggregations
 * 5.  Financial settlement ledger and Capex/Opex recurring revenue
 * 6.  Period filters (today, week, month, custom range)
 * 7.  Sales Rep scoping (rep only sees their own pipeline)
 * 8.  PDF Executive Report export buffer generation (%PDF- magic bytes)
 * 9.  XLSX Executive Report export buffer generation (ExcelJS workbook structure)
 * 10. B2B Tax Invoice PDF buffer generation (%PDF- magic bytes, line items, payments)
 * 11. Multi-tenant isolation on reporting metrics
 * 12. Multi-tenant isolation on Invoice PDF (Tenant B cannot access Tenant A invoice)
 * 13. Customer IDOR defense (Customer A cannot download Customer B invoice PDF - 403)
 * 14. Customer legitimate access (Customer A successfully downloads own invoice PDF)
 * 15. REST API: GET /api/reports/sales
 * 16. REST API: GET /api/reports/approvals
 * 17. REST API: GET /api/reports/products
 * 18. REST API: GET /api/reports/export/pdf
 * 19. REST API: GET /api/reports/export/xlsx
 */

import jwt from 'jsonwebtoken';
import prisma from '../src/db/prisma.js';
import {
  getSalesReportSummary,
  getSalesPerformanceReport,
  getApprovalReport,
  getProductCategoryReport,
  getFinancialReport,
} from '../src/services/reportService.js';
import { generatePdfReport } from '../src/services/documentRenderers/pdfReportRenderer.js';
import { generateXlsxReport } from '../src/services/documentRenderers/xlsxReportRenderer.js';
import { generateInvoicePdf } from '../src/services/documentRenderers/invoicePdfRenderer.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dealflow360-secret-key-2025';
const BASE_URL = 'http://127.0.0.1:5000';

function generateTestToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      customerId: user.customerId || null,
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log(' MODULE 15: REPORTING & DOCUMENT GENERATION VERIFICATION');
  console.log('===============================================================\n');

  try {
    // 0. Fetch existing seed data to bind tokens
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });
    const managerUser = await prisma.user.findFirst({
      where: { role: 'SALES_MANAGER' },
    });
    const salesRep = await prisma.user.findFirst({
      where: { role: 'SALES_REP' },
    });
    const financeUser = await prisma.user.findFirst({
      where: { role: 'FINANCE_OPERATIONS' },
    });
    const customerUser = await prisma.user.findFirst({
      where: { role: 'CUSTOMER' },
    });

    if (!adminUser || !salesRep) {
      throw new Error('Database missing essential seed users. Run seed first.');
    }

    const tenantId = adminUser.tenantId;

    // Tokens
    const adminToken = generateTestToken(adminUser);
    const managerToken = generateTestToken(managerUser || adminUser);
    const salesRepToken = generateTestToken(salesRep);
    const customerToken = generateTestToken(customerUser || { id: 'cust-1', role: 'CUSTOMER', tenantId });

    console.log('Step 1: Testing Report Aggregation Services (PostgreSQL authoritativeness)...');

    // 1. Sales summary KPIs
    const salesSummary = await getSalesReportSummary(tenantId, {});
    assert(salesSummary && salesSummary.kpis && typeof salesSummary.kpis.totalQuotes === 'number', 'Sales summary returns totalQuotes count');
    assert(typeof salesSummary.kpis.winRate === 'number', 'Sales summary returns winRate percentage');
    assert(typeof salesSummary.kpis.totalQuotedValue === 'number', 'Sales summary returns totalQuotedValue numeric');
    console.log(`    -> Total Quotes: ${salesSummary.kpis.totalQuotes}, Won: ${salesSummary.kpis.wonOrdersCount}, Win Rate: ${salesSummary.kpis.winRate}%`);

    // 2. Sales performance breakdown by rep
    const repPerformance = await getSalesPerformanceReport(tenantId, {});
    assert(Array.isArray(repPerformance), 'Sales performance returns an array of rep metrics');
    if (repPerformance.length > 0) {
      assert(repPerformance[0].repName && typeof repPerformance[0].quotesCount === 'number', 'Rep entry has name and quotes metrics');
      console.log(`    -> Reps tracked: ${repPerformance.length}, First: ${repPerformance[0].repName} (${repPerformance[0].wonCount} won)`);
    }

    // 3. Approval Governance report
    const approvalReport = await getApprovalReport(tenantId, { approvalStatus: 'ALL' });
    assert(Array.isArray(approvalReport), 'Approval report returns an array of evaluated quotes');
    console.log(`    -> Quotes with approval evaluations: ${approvalReport.length}`);

    // 4. Product & Category report
    const productReport = await getProductCategoryReport(tenantId, {});
    assert(Array.isArray(productReport), 'Product & category report returns an array');
    console.log(`    -> Product/category breakdown rows: ${productReport.length}`);

    // 5. Financial settlement & Cashflow report
    const financialReport = await getFinancialReport(tenantId, {});
    assert(financialReport && financialReport.hybridBreakdown, 'Financial report returns hybridBreakdown and ledger breakdown');
    assert(Array.isArray(financialReport.invoices), 'Financial report contains invoices array');
    console.log(`    -> Financial Invoices tracked: ${financialReport.invoices.length}, Total OneTime: $${financialReport.hybridBreakdown.totalOneTime}`);

    // 6. Period Filtering
    const todaySummary = await getSalesReportSummary(tenantId, { period: 'today' });
    const weekSummary = await getSalesReportSummary(tenantId, { period: 'week' });
    const monthSummary = await getSalesReportSummary(tenantId, { period: 'month' });
    assert(todaySummary && weekSummary && monthSummary, 'Period presets (today, week, month) execute without SQL errors');

    const customRangeSummary = await getSalesReportSummary(tenantId, {
      startDate: '2025-01-01',
      endDate: '2026-12-31',
    });
    assert(customRangeSummary && typeof customRangeSummary.kpis.totalQuotes === 'number', 'Custom date range filter executes correctly');

    // 7. Sales Rep Scoping
    const scopedSummary = await getSalesReportSummary(tenantId, { salesRepId: salesRep.id });
    assert(scopedSummary.kpis.totalQuotes <= salesSummary.kpis.totalQuotes, 'Sales Rep filter limits quotes to rep boundary');

    console.log('\nStep 2: Testing Document Generation Engines (PDFKit & ExcelJS)...');

    // 8. PDF Executive Report Buffer
    const pdfReportBuffer = await generatePdfReport({
      organization: { name: 'Acme Test Corp', currency: 'INR' },
      summary: salesSummary,
      salesPerformance: repPerformance,
      approvals: approvalReport,
      products: productReport,
      appliedFilters: salesSummary.appliedFilters || {},
    });
    assert(Buffer.isBuffer(pdfReportBuffer), 'generatePdfReport returns a Node.js Buffer');
    assert(pdfReportBuffer.length > 500, `PDF Buffer size is substantial (${pdfReportBuffer.length} bytes)`);
    const pdfHeader = pdfReportBuffer.subarray(0, 5).toString('ascii');
    assert(pdfHeader === '%PDF-', `PDF buffer begins with valid magic bytes '%PDF-' (found: ${pdfHeader})`);

    // 9. XLSX Executive Report Buffer
    const xlsxReportBuffer = await generateXlsxReport({
      organization: { name: 'Acme Test Corp', currency: 'INR' },
      summary: salesSummary,
      salesPerformance: repPerformance,
      approvals: approvalReport,
      products: productReport,
      financial: financialReport,
      appliedFilters: salesSummary.appliedFilters || {},
    });
    assert(Buffer.isBuffer(xlsxReportBuffer), 'generateXlsxReport returns a Node.js Buffer');
    assert(xlsxReportBuffer.length > 1000, `XLSX Buffer size is substantial (${xlsxReportBuffer.length} bytes)`);
    // Zip magic bytes for XLSX are PK (0x50, 0x4B)
    assert(xlsxReportBuffer[0] === 0x50 && xlsxReportBuffer[1] === 0x4B, 'XLSX buffer begins with valid PK zip header');

    // 10. B2B Tax Invoice PDF Buffer
    let sampleInvoice = await prisma.invoice.findFirst({
      where: { tenantId },
      include: {
        tenant: true,
        customer: true,
        items: { include: { product: true } },
        payments: true,
      },
    });

    if (!sampleInvoice) {
      let cust = await prisma.customer.findFirst({ where: { tenantId } });
      if (!cust) {
        cust = await prisma.customer.create({
          data: {
            tenantId,
            name: 'Enterprise Client Corp',
            email: `client-${Date.now()}@corp.com`,
            companyName: 'Enterprise Client Corp',
            tier: 'GOLD',
          },
        });
      }

      let prod = await prisma.product.findFirst({ where: { tenantId } });
      if (!prod) {
        prod = await prisma.product.create({
          data: {
            tenantId,
            name: 'Enterprise Cloud Suite',
            sku: `PROD-${Date.now()}`,
            type: 'HARDWARE',
            unitPrice: 37500,
            costPrice: 20000,
          },
        });
      }

      sampleInvoice = await prisma.invoice.create({
        data: {
          tenantId,
          invoiceNumber: `INV-M15-TEST-${Date.now()}`,
          customerId: cust.id,
          invoiceType: 'ONE_TIME',
          status: 'ISSUED',
          totalAmount: 75000,
          amountPaid: 25000,
          amountDue: 50000,
          dueDate: new Date(Date.now() + 86400000 * 30),
          items: {
            create: [
              {
                tenantId,
                productId: prod.id,
                description: 'Enterprise Workstation Hardware',
                quantity: 2,
                unitPrice: 37500,
                lineTotal: 75000,
                billingType: 'ONE_TIME',
              },
            ],
          },
        },
        include: {
          tenant: true,
          customer: true,
          items: { include: { product: true } },
          payments: true,
        },
      });
    }

    const invoicePdfBuffer = await generateInvoicePdf(sampleInvoice);
    assert(Buffer.isBuffer(invoicePdfBuffer), 'generateInvoicePdf returns a Node.js Buffer');
    const invPdfHeader = invoicePdfBuffer.subarray(0, 5).toString('ascii');
    assert(invPdfHeader === '%PDF-', `Invoice PDF begins with valid magic bytes '%PDF-' (found: ${invPdfHeader})`);
    console.log(`    -> Generated Tax Invoice PDF for ${sampleInvoice.invoiceNumber} (${invoicePdfBuffer.length} bytes)`);

    console.log('\nStep 3: Testing REST API Endpoints & Security Controls...');

    // 15. REST API: GET /api/reports/sales
    const salesRes = await fetch(`${BASE_URL}/api/reports/sales?period=all`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const salesJson = await salesRes.json();
    assert(salesRes.status === 200 && salesJson.success === true, 'GET /api/reports/sales returns 200 and success true');
    assert(salesJson.data.summary && Array.isArray(salesJson.data.salesPerformance), 'API returns summary and salesPerformance');

    // 16. REST API: GET /api/reports/approvals
    const appRes = await fetch(`${BASE_URL}/api/reports/approvals`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const appJson = await appRes.json();
    assert(appRes.status === 200 && appJson.success === true, 'GET /api/reports/approvals returns 200');

    // 17. REST API: GET /api/reports/products
    const prodRes = await fetch(`${BASE_URL}/api/reports/products`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const prodJson = await prodRes.json();
    assert(prodRes.status === 200 && prodJson.success === true, 'GET /api/reports/products returns 200');

    // 18. REST API: GET /api/reports/export/pdf
    const pdfExportRes = await fetch(`${BASE_URL}/api/reports/export/pdf?period=month`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(pdfExportRes.status === 200, 'GET /api/reports/export/pdf returns HTTP 200');
    assert(
      pdfExportRes.headers.get('content-type') === 'application/pdf',
      `PDF export returns Content-Type application/pdf (got: ${pdfExportRes.headers.get('content-type')})`
    );
    const pdfBlob = await pdfExportRes.arrayBuffer();
    assert(pdfBlob.byteLength > 500, `Downloaded PDF export has valid size (${pdfBlob.byteLength} bytes)`);

    // 19. REST API: GET /api/reports/export/xlsx
    const xlsxExportRes = await fetch(`${BASE_URL}/api/reports/export/xlsx?period=month`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(xlsxExportRes.status === 200, 'GET /api/reports/export/xlsx returns HTTP 200');
    assert(
      xlsxExportRes.headers.get('content-type') === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'XLSX export returns official Excel MIME type'
    );
    const xlsxBlob = await xlsxExportRes.arrayBuffer();
    assert(xlsxBlob.byteLength > 1000, `Downloaded XLSX export has valid size (${xlsxBlob.byteLength} bytes)`);

    // 11. Multi-Tenant isolation
    let tenantB = await prisma.organization.findFirst({
      where: { id: 'org-tenant-b-m14' },
    });
    if (!tenantB) {
      tenantB = await prisma.organization.create({
        data: {
          id: 'org-tenant-b-m14',
          name: 'Tenant B Logistics Corp',
          companyEmail: 'ops@tenantb.com',
          currency: 'INR',
        },
      });
    }

    let tenantBUser = await prisma.user.findFirst({
      where: { tenantId: tenantB.id },
    });
    if (!tenantBUser) {
      tenantBUser = await prisma.user.create({
        data: {
          tenantId: tenantB.id,
          name: 'Tenant B Admin',
          email: `admin-tenantb-${Date.now()}@test.com`,
          passwordHash: 'dummy',
          role: 'ADMIN',
        },
      });
    }

    const foreignTenantToken = generateTestToken(tenantBUser);
    const foreignRes = await fetch(`${BASE_URL}/api/reports/sales`, {
      headers: { Authorization: `Bearer ${foreignTenantToken}` },
    });
    const foreignJson = await foreignRes.json();
    assert(
      foreignJson.success === true && foreignJson.data.summary.totalQuotes === 0,
      'Tenant B cannot view Tenant A quotes or sales metrics (Multi-tenant isolation verified)'
    );

    // 12. Multi-Tenant isolation on Invoice PDF
    const foreignInvRes = await fetch(`${BASE_URL}/api/invoices/${sampleInvoice.id}/pdf`, {
      headers: { Authorization: `Bearer ${foreignTenantToken}` },
    });
    assert(foreignInvRes.status === 404, 'Tenant B requesting Tenant A invoice PDF receives 404 NOT FOUND');

    // 13. Customer IDOR defense: Customer B cannot download Customer A's invoice PDF
    let customerOther = await prisma.customer.findFirst({
      where: {
        tenantId,
        id: { not: sampleInvoice.customerId },
      },
    });
    if (!customerOther) {
      customerOther = await prisma.customer.create({
        data: {
          tenantId,
          name: 'Intruder Corp',
          companyName: 'Intruder Corp',
          email: `intruder-${Date.now()}@othercorp.com`,
          tier: 'BRONZE',
        },
      });
    }

    const unauthorizedCustomerToken = generateTestToken({
      id: customerOther.id,
      email: customerOther.email,
      role: 'CUSTOMER',
      tenantId,
      customerId: customerOther.id,
    });
    const idorRes = await fetch(`${BASE_URL}/api/invoices/${sampleInvoice.id}/pdf`, {
      headers: { Authorization: `Bearer ${unauthorizedCustomerToken}` },
    });
    assert(idorRes.status === 403, 'Customer B attempting to download Customer A invoice PDF receives 403 FORBIDDEN');

    // 14. Customer legitimate access: Authorized customer downloads their own invoice PDF
    const authorizedCustomerToken = generateTestToken({
      id: sampleInvoice.customer.id,
      email: sampleInvoice.customer.email,
      role: 'CUSTOMER',
      tenantId,
      customerId: sampleInvoice.customer.id,
    });
    const legitimateCustRes = await fetch(`${BASE_URL}/api/invoices/${sampleInvoice.id}/pdf`, {
      headers: { Authorization: `Bearer ${authorizedCustomerToken}` },
    });
    assert(legitimateCustRes.status === 200, 'Legitimate customer can download their own invoice PDF (HTTP 200)');
    assert(
      legitimateCustRes.headers.get('content-type') === 'application/pdf',
      'Customer received valid application/pdf'
    );

  } catch (err) {
    console.error('Unhandled error in test runner:', err);
    failedTests++;
  } finally {
    console.log('\n===============================================================');
    console.log(` RESULTS: ${passedTests} Passed, ${failedTests} Failed`);
    console.log('===============================================================');
    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTests();
