/**
 * discountRiskService.js — Corporate Discount Risk & Approval Trigger Engine
 *
 * Evaluates commercial terms against Admin-configured Discount & Approval rules.
 * Strictly prevents Sales Reps from bypassing corporate discount policies.
 */

import prisma from '../db/prisma.js';

export async function evaluateQuotationRisk(tenantId, items = [], customerTier = 'BRONZE', overallMargin = 25) {
  if (!items || items.length === 0) {
    return {
      riskScore: 0,
      riskLevel: 'LOW',
      reasons: ['No products in quotation yet.'],
      approvalRequired: false,
      requiredApproverRole: null,
      violations: [],
    };
  }

  // 1. Fetch active Admin Discount and Approval rules for this tenant
  const [discountRules, approvalRules] = await Promise.all([
    prisma.discountRule.findMany({
      where: { tenantId, isActive: true },
    }),
    prisma.approvalRule.findMany({
      where: { tenantId, isActive: true },
      orderBy: { priority: 'asc' },
    }),
  ]);

  const reasons = [];
  const violations = [];
  let approvalRequired = false;
  let highestApproverRole = null; // 'SALES_MANAGER' or 'FINANCE_OPERATIONS' or 'SALES_MANAGER_THEN_FINANCE'
  let ceilingViolationCount = 0;

  // 2. Evaluate each item against discount rules
  for (const item of items) {
    const itemDiscount = parseFloat(item.discountPercentage) || 0;
    const itemType = item.productTypeSnapshot || item.type || 'HARDWARE';
    const itemName = item.productNameSnapshot || item.name || 'Product';

    // Find matching discount rule for productType & customerTier
    const matchingRule =
      discountRules.find(
        (r) =>
          r.productType === itemType &&
          (r.customerTier === customerTier || r.customerTier === 'ALL')
      ) ||
      discountRules.find((r) => r.productType === itemType) ||
      discountRules.find((r) => !r.productType);

    // Baseline ceiling from rule or product default
    const maxAllowedCeiling = matchingRule
      ? parseFloat(matchingRule.maxDiscountPercentage)
      : parseFloat(item.maxDiscountPercentage) || 15.0;

    // Check discount ceiling violation
    if (itemDiscount > maxAllowedCeiling) {
      ceilingViolationCount++;
      const reasonText = `${itemName}: Requested discount is ${itemDiscount}%, which exceeds the allowed ceiling of ${maxAllowedCeiling}%.`;
      reasons.push(reasonText);
      violations.push({
        productName: itemName,
        productType: itemType,
        requestedDiscount: itemDiscount,
        maxAllowed: maxAllowedCeiling,
        excess: Math.round((itemDiscount - maxAllowedCeiling) * 100) / 100,
        severity: 'HIGH',
      });
      approvalRequired = true;
      highestApproverRole = 'SALES_MANAGER';
    }

    // Check Approval Rules ladder
    const matchingApprovalTier = approvalRules.find((ar) => {
      const typeMatch = !ar.productType || ar.productType === itemType;
      const minMatch = itemDiscount >= parseFloat(ar.minDiscountPercentage);
      const maxMatch =
        ar.maxDiscountPercentage === null ||
        itemDiscount <= parseFloat(ar.maxDiscountPercentage);
      return typeMatch && minMatch && maxMatch;
    });

    if (matchingApprovalTier) {
      approvalRequired = true;
      const tierRole = matchingApprovalTier.requiredRole;
      if (
        tierRole === 'SALES_MANAGER_THEN_FINANCE' ||
        tierRole === 'FINANCE_OPERATIONS'
      ) {
        highestApproverRole = tierRole;
      } else if (!highestApproverRole) {
        highestApproverRole = 'SALES_MANAGER';
      }
    }

    // Also check DiscountRule specific approval thresholds
    if (matchingRule) {
      const mgrThreshold = parseFloat(matchingRule.requiresApprovalAbove);
      const finThreshold = matchingRule.requiresFinanceApprovalAbove
        ? parseFloat(matchingRule.requiresFinanceApprovalAbove)
        : null;

      if (finThreshold && itemDiscount > finThreshold) {
        approvalRequired = true;
        highestApproverRole = 'FINANCE_OPERATIONS';
      } else if (mgrThreshold && itemDiscount > mgrThreshold) {
        approvalRequired = true;
        if (highestApproverRole !== 'FINANCE_OPERATIONS' && highestApproverRole !== 'SALES_MANAGER_THEN_FINANCE') {
          highestApproverRole = 'SALES_MANAGER';
        }
      }
    }
  }

  // 3. Margin risk evaluation
  if (overallMargin < 10) {
    reasons.push(`Deal gross margin is critically low (${overallMargin}% < 10%). Financial risk detected.`);
  } else if (overallMargin < 18) {
    reasons.push(`Deal gross margin is below target baseline (${overallMargin}% < 18%).`);
  }

  // 4. Deterministic Risk Scoring (0 - 100)
  let riskScore = 10; // Baseline healthy score

  if (ceilingViolationCount > 0) {
    riskScore += ceilingViolationCount * 35;
  }
  if (approvalRequired) {
    riskScore += 25;
  }
  if (highestApproverRole === 'FINANCE_OPERATIONS' || highestApproverRole === 'SALES_MANAGER_THEN_FINANCE') {
    riskScore += 20;
  }
  if (overallMargin < 10) {
    riskScore += 25;
  } else if (overallMargin < 18) {
    riskScore += 10;
  }

  riskScore = Math.min(100, Math.max(5, riskScore));

  let riskLevel = 'LOW';
  if (riskScore >= 60 || ceilingViolationCount > 0) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 30) {
    riskLevel = 'MEDIUM';
  }

  if (approvalRequired && !reasons.some((r) => r.includes('approval required'))) {
    reasons.push(
      `${highestApproverRole === 'SALES_MANAGER' ? 'Sales Manager' : 'Finance'} approval required before this deal can be sent to the customer.`
    );
  }

  return {
    riskScore,
    riskLevel,
    reasons,
    approvalRequired,
    requiredApproverRole: highestApproverRole,
    violations,
  };
}
