// Automated Discount Risk Engine for DealFlow360 (Sections 6 & 7)

export function evaluateQuoteRisk(pricing, rules = {}, inventoryList = []) {
  const hwLimit = Number(rules.hardware_max_discount ?? 15.0);
  const srvLimit = Number(rules.service_max_discount ?? 10.0);
  const subLimit = Number(rules.subscription_max_discount ?? 5.0);
  const minMargin = Number(rules.min_margin_pct ?? 25.0);

  let score = 20; // Baseline safe score
  let hasViolation = false;
  const factors = [];

  // Check each item category against configured limits
  if (Array.isArray(pricing.items)) {
    for (const item of pricing.items) {
      const category = (item.category || '').toUpperCase();
      const disc = Number(item.discount_pct ?? item.discount ?? 0);

      if (category === 'SERVICE' && disc > srvLimit) {
        const excess = disc - srvLimit;
        hasViolation = true;
        score = Math.max(score, 82); // As specified in Section 7 (82/100)
        factors.push({
          rule: 'SERVICE_DISCOUNT_EXCEEDED',
          severity: 'HIGH',
          message: `Service discount (${disc}%) exceeds allowed limit of ${srvLimit}% by ${excess.toFixed(1)}%.`,
          impact: `Excess discount: ${excess.toFixed(1)}%`
        });
      } else if (category === 'HARDWARE' && disc > hwLimit) {
        const excess = disc - hwLimit;
        hasViolation = true;
        score = Math.max(score, 85);
        factors.push({
          rule: 'HARDWARE_DISCOUNT_EXCEEDED',
          severity: 'HIGH',
          message: `Hardware discount (${disc}%) exceeds authorized ceiling of ${hwLimit}% by ${excess.toFixed(1)}%.`,
          impact: `Excess discount: ${excess.toFixed(1)}%`
        });
      } else if (category === 'SUBSCRIPTION' && disc > subLimit) {
        const excess = disc - subLimit;
        hasViolation = true;
        score = Math.max(score, 75);
        factors.push({
          rule: 'SUBSCRIPTION_DISCOUNT_EXCEEDED',
          severity: 'MEDIUM',
          message: `Subscription discount (${disc}%) exceeds allowed limit of ${subLimit}% by ${excess.toFixed(1)}%.`,
          impact: `Excess discount: ${excess.toFixed(1)}%`
        });
      }
    }
  }

  // Margin impact check
  if (pricing.margin_pct < minMargin) {
    score = Math.max(score, 80);
    factors.push({
      rule: 'MARGIN_IMPACT_DETECTED',
      severity: 'HIGH',
      message: `Deal gross margin (${pricing.margin_pct}%) falls below mandatory minimum floor of ${minMargin}%.`,
      impact: 'Profitability compression'
    });
  }

  // Cap score at 100
  score = Math.min(100, Math.max(0, score));

  // Determine Risk Level
  let riskLevel = 'LOW';
  let requiresApproval = false;
  let approvalStatus = 'DRAFT';

  if (score >= 80 || hasViolation) {
    riskLevel = 'HIGH';
    requiresApproval = true;
    approvalStatus = 'PENDING_APPROVAL'; // Section 23 status
  } else if (score >= 50) {
    riskLevel = 'MEDIUM';
    requiresApproval = true;
    approvalStatus = 'PENDING_APPROVAL';
  } else {
    riskLevel = 'LOW';
    requiresApproval = false;
    approvalStatus = 'MANAGER_APPROVED'; // Auto-approved if safe
  }

  return {
    risk_score: score,
    riskScore: score,
    risk_level: riskLevel,
    riskLevel: riskLevel,
    risk_factors: factors,
    riskFactors: factors,
    has_violation: hasViolation,
    requires_approval: requiresApproval,
    approval_status: approvalStatus
  };
}
