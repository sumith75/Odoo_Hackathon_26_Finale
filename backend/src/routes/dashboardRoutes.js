import express from 'express';
import { memStore } from '../config/db.js';

const router = express.Router();

// Step 15: Executive Dashboard & Deal Health Analytics
router.get('/metrics', (req, res) => {
  const quotes = memStore.quotes;
  const paidQuotes = quotes.filter(q => q.payment_status === 'PAID');
  const pendingApprovals = quotes.filter(q => q.approval_status === 'PENDING_MANAGER' || q.approval_status === 'PENDING_FINANCE');
  const approvedQuotes = quotes.filter(q => q.approval_status === 'APPROVED' || q.approval_status === 'CONFIRMED' || q.payment_status === 'PAID');

  // Financial aggregates
  const totalPipelineValue = quotes.reduce((acc, q) => acc + (Number(q.final_total) || 0), 0);
  const totalClosedWonValue = paidQuotes.reduce((acc, q) => acc + (Number(q.final_total) || 0), 0);
  const totalCapexClosed = paidQuotes.reduce((acc, q) => acc + (Number(q.capex_one_time) || 0), 0);
  const totalMrrContracted = paidQuotes.reduce((acc, q) => acc + (Number(q.opex_recurring_mrr) || 0), 0);
  const totalArrContracted = totalMrrContracted * 12;

  // Average deal margin
  const avgMargin = quotes.length > 0
    ? Math.round((quotes.reduce((acc, q) => acc + (Number(q.margin_pct) || 0), 0) / quotes.length) * 10) / 10
    : 32.5;

  // Risk distribution
  const riskDistribution = {
    safe: quotes.filter(q => q.risk_level === 'SAFE').length,
    medium: quotes.filter(q => q.risk_level === 'MEDIUM_RISK').length,
    high: quotes.filter(q => q.risk_level === 'HIGH_RISK').length
  };

  // Warehouse inventory summary
  const warehouseStats = memStore.warehouses.map(wh => {
    const inv = memStore.inventory.filter(i => i.warehouse_id === wh.id);
    const totalStock = inv.reduce((acc, i) => acc + i.available_stock, 0);
    return {
      warehouse_id: wh.id,
      name: wh.name,
      location: wh.location,
      total_units: totalStock
    };
  });

  // Recent audit trail (Full 15-step event stream)
  const recentAudit = memStore.audit_logs.slice(0, 20);

  res.json({
    success: true,
    metrics: {
      total_quotes: quotes.length,
      deals_won: paidQuotes.length,
      pending_approvals: pendingApprovals.length,
      total_pipeline_value: totalPipelineValue,
      total_closed_won_value: totalClosedWonValue,
      total_capex_closed: totalCapexClosed,
      total_mrr_contracted: totalMrrContracted,
      total_arr_contracted: totalArrContracted,
      average_deal_margin_pct: avgMargin,
      win_rate_pct: quotes.length > 0 ? Math.round((paidQuotes.length / quotes.length) * 100) : 0,
      risk_distribution: riskDistribution,
      warehouses: warehouseStats
    },
    audit_timeline: recentAudit
  });
});

export default router;
