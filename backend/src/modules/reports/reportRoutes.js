/**
 * reportRoutes.js — REST APIs for Management Reporting, PDF and XLSX Exports
 *
 * Implements:
 * - GET /api/reports/sales: Full executive sales report with KPIs & breakdowns
 * - GET /api/reports/approvals: Governance & approval audit stream
 * - GET /api/reports/products: Product & category performance analytics
 * - GET /api/reports/financial: Hybrid billing & settlement cashflow
 * - GET /api/reports/export/pdf: Downloadable high-fidelity PDF report
 * - GET /api/reports/export/xlsx: Downloadable multi-sheet Excel spreadsheet
 */

import express from 'express';
import prisma from '../../db/prisma.js';
import redis from '../../config/redis.js';
import { authenticateUser } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { requireRole } from '../../middleware/rbac.js';
import {
  getSalesReportSummary,
  getSalesPerformanceReport,
  getApprovalReport,
  getProductCategoryReport,
  getFinancialReport,
} from '../../services/reportService.js';
import { generatePdfReport } from '../../services/documentRenderers/pdfReportRenderer.js';
import { generateXlsxReport } from '../../services/documentRenderers/xlsxReportRenderer.js';
import { logAudit } from '../../utils/audit.js';

const router = express.Router();

router.use(authenticateUser);
router.use(resolveTenant);
// Restrict to internal staff only (Admin, Sales Manager, Sales Rep, Finance/Ops)
router.use(requireRole('ADMIN', 'SALES_MANAGER', 'SALES_REP', 'FINANCE_OPERATIONS'));

// Short-TTL cache shared between the JSON /sales view and the PDF/XLSX
// exporters, so clicking "export" right after viewing a report doesn't
// recompute the same aggregations from scratch. 45s is long enough to cover
// "view then export" without serving meaningfully stale numbers.
const REPORT_BUNDLE_TTL_SECONDS = 45;

function buildReportCacheKey(tenantId, filters) {
  const normalized = Object.keys(filters || {})
    .sort()
    .reduce((acc, key) => {
      if (filters[key] !== undefined && filters[key] !== '') acc[key] = filters[key];
      return acc;
    }, {});
  return `report-bundle:${tenantId}:${JSON.stringify(normalized)}`;
}

async function getReportBundle(tenantId, filters) {
  const cacheKey = buildReportCacheKey(tenantId, filters);

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return typeof cached === 'string' ? JSON.parse(cached) : cached;
    }
  } catch {
    // Fall through and compute fresh on any cache-read error
  }

  const [summary, salesPerformance, approvals, products, financial] = await Promise.all([
    getSalesReportSummary(tenantId, filters),
    getSalesPerformanceReport(tenantId, filters),
    getApprovalReport(tenantId, filters),
    getProductCategoryReport(tenantId, filters),
    getFinancialReport(tenantId, filters),
  ]);

  const bundle = { summary, salesPerformance, approvals, products, financial };

  try {
    await redis.set(cacheKey, JSON.stringify(bundle), REPORT_BUNDLE_TTL_SECONDS);
  } catch {
    // Non-fatal — just means the next request recomputes
  }

  return bundle;
}

/**
 * GET /api/reports/sales
 * Returns comprehensive sales performance dataset with summary KPIs
 */
router.get('/sales', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const filters = req.query;

    // Scope sales reps to only their own data if they do not have manager/admin privileges
    if (req.user.role === 'SALES_REP') {
      filters.salesRepId = req.user.id;
    }

    const { summary, salesPerformance, approvals, products } = await getReportBundle(tenantId, filters);

    res.json({
      success: true,
      data: {
        summary: summary.kpis,
        appliedFilters: summary.appliedFilters,
        salesPerformance,
        approvals: approvals.slice(0, 20),
        products: products.slice(0, 20),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/approvals
 * Returns detailed approval & risk governance records
 */
router.get('/approvals', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const filters = req.query;

    if (req.user.role === 'SALES_REP') {
      filters.salesRepId = req.user.id;
    }

    const approvals = await getApprovalReport(tenantId, filters);
    res.json({ success: true, data: approvals });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/products
 * Returns product and category sales analytics
 */
router.get('/products', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const filters = req.query;

    if (req.user.role === 'SALES_REP') {
      filters.salesRepId = req.user.id;
    }

    const products = await getProductCategoryReport(tenantId, filters);
    res.json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/financial
 * Returns hybrid billing, invoice status, and payment settlement breakdown
 */
router.get('/financial', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const filters = req.query;

    const financial = await getFinancialReport(tenantId, filters);
    res.json({ success: true, data: financial });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/export/pdf
 * Generates and streams executive report PDF with applied filters
 */
router.get('/export/pdf', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const filters = req.query;

    if (req.user.role === 'SALES_REP') {
      filters.salesRepId = req.user.id;
    }

    const [org, { summary, salesPerformance, approvals, products }] = await Promise.all([
      prisma.organization.findUnique({ where: { id: tenantId } }),
      getReportBundle(tenantId, filters),
    ]);

    const pdfBuffer = await generatePdfReport({
      organization: org || {},
      summary,
      salesPerformance,
      approvals,
      products,
      appliedFilters: summary.appliedFilters,
    });

    const dateStr = new Date().toISOString().substring(0, 10);
    const filename = `DealFlow360_Sales_Report_${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);

    // Audit logging already fails soft and isn't needed by the client —
    // don't make the download wait on one more remote DB write.
    logAudit({
      tenantId,
      userId: req.user.id,
      action: 'REPORT_EXPORTED_PDF',
      entityType: 'REPORT',
      entityId: 'SALES_PERFORMANCE',
      metadata: { filename, filters: summary.appliedFilters },
    }).catch((err) => console.error('[REPORT_EXPORT_AUDIT_ERROR]:', err.message));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/export/xlsx
 * Generates and streams multi-sheet Excel spreadsheet with applied filters
 */
router.get('/export/xlsx', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const filters = req.query;

    if (req.user.role === 'SALES_REP') {
      filters.salesRepId = req.user.id;
    }

    const [org, { summary, salesPerformance, approvals, products, financial }] = await Promise.all([
      prisma.organization.findUnique({ where: { id: tenantId } }),
      getReportBundle(tenantId, filters),
    ]);

    const xlsxBuffer = await generateXlsxReport({
      organization: org || {},
      summary,
      salesPerformance,
      approvals,
      products,
      financial,
      appliedFilters: summary.appliedFilters,
    });

    const dateStr = new Date().toISOString().substring(0, 10);
    const filename = `DealFlow360_Sales_Report_${dateStr}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', xlsxBuffer.length);
    res.end(xlsxBuffer);

    // Audit logging already fails soft and isn't needed by the client —
    // don't make the download wait on one more remote DB write.
    logAudit({
      tenantId,
      userId: req.user.id,
      action: 'REPORT_EXPORTED_XLSX',
      entityType: 'REPORT',
      entityId: 'SALES_PERFORMANCE',
      metadata: { filename, filters: summary.appliedFilters },
    }).catch((err) => console.error('[REPORT_EXPORT_AUDIT_ERROR]:', err.message));
  } catch (err) {
    next(err);
  }
});

export default router;
