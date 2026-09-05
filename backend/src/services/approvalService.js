/**
 * approvalService.js — Authoritative Approval & Governance Engine
 *
 * Enforces:
 * - Multi-tenant isolation
 * - Non-bypassable discount limit and risk checks
 * - Self-approval prevention (Managers cannot approve quotes they authored)
 * - Atomic concurrency locking against double approvals
 * - Telemetry calculations (Item violation details, margin delta, before/after comparison)
 * - Multi-level approval transitions (Manager -> Finance -> Customer Ready)
 * - Full audit trails
 */

import prisma from '../db/prisma.js';
import { logAudit } from '../utils/audit.js';
import { calculateQuotationTotals } from './pricingEngine.js';
import { evaluateQuotationRisk } from './discountRiskService.js';
import { dispatchNotificationAsync } from './notificationService.js';

/**
 * Calculate deep governance telemetry for manager decision support
 */
export function calculateApprovalTelemetry(quote, discountRules = []) {
  const items = quote.items || [];
  const customerTier = quote.customer?.tier || 'BRONZE';

  let baseTotalAmount = 0;
  let totalCost = 0;

  // 1. Analyze each item for governance & violations
  const governanceItems = items.map((item) => {
    const itemDiscount = parseFloat(item.discountPercentage) || 0;
    const itemType = item.productTypeSnapshot || 'HARDWARE';
    const unitPrice = parseFloat(item.unitPrice) || 0;
    const costPrice = parseFloat(item.costPrice) || 0;
    const quantity = item.quantity || 1;

    baseTotalAmount += unitPrice * quantity;
    totalCost += costPrice * quantity;

    // Find matching discount rule
    const matchingRule =
      discountRules.find(
        (r) =>
          r.productType === itemType &&
          (r.customerTier === customerTier || r.customerTier === 'ALL')
      ) ||
      discountRules.find((r) => r.productType === itemType) ||
      discountRules.find((r) => !r.productType);

    const allowedDiscount = matchingRule
      ? parseFloat(matchingRule.maxDiscountPercentage)
      : parseFloat(item.product?.maxDiscountPercentage) || 15.0;

    const variance = Math.round((itemDiscount - allowedDiscount) * 100) / 100;
    const isExceeded = itemDiscount > allowedDiscount;

    let requiredApproval = 'None';
    if (isExceeded) {
      requiredApproval = 'Sales Manager';
    }
    if (
      matchingRule?.requiresFinanceApprovalAbove &&
      itemDiscount > parseFloat(matchingRule.requiresFinanceApprovalAbove)
    ) {
      requiredApproval = 'Finance Operations';
    }

    return {
      id: item.id,
      productId: item.productId,
      productName: item.productNameSnapshot,
      productType: itemType,
      customerTier,
      quantity,
      unitPrice,
      costPrice,
      appliedDiscount: itemDiscount,
      allowedDiscount,
      variance,
      isExceeded,
      excessPercentage: isExceeded ? variance : 0,
      discountAmount: parseFloat(item.discountAmount) || 0,
      lineTotal: parseFloat(item.lineTotal) || 0,
      marginAmount: parseFloat(item.marginAmount) || 0,
      marginPercentage: parseFloat(item.marginPercentage) || 0,
      requiredApproval,
    };
  });

  // 2. Margin Delta Calculations
  const proposedTotalAmount = parseFloat(quote.totalAmount) || 0;
  const proposedMarginAmount = parseFloat(quote.marginAmount) || 0;
  const proposedMarginPercentage = parseFloat(quote.marginPercentage) || 0;

  const baseMarginAmount = Math.max(0, baseTotalAmount - totalCost);
  const baseMarginPercentage =
    baseTotalAmount > 0 ? Math.round((baseMarginAmount / baseTotalAmount) * 10000) / 100 : 0;

  const marginDeltaPercentage =
    Math.round((proposedMarginPercentage - baseMarginPercentage) * 100) / 100;
  const marginImpactAmount = Math.round((proposedMarginAmount - baseMarginAmount) * 100) / 100;

  // 3. Before / After Comparison Terms
  // If quotation has previousTerms recorded (e.g. from prior revision or negotiation), compare with it.
  // Otherwise compare against baseline 0% discount terms.
  const hasPreviousTerms = Boolean(quote.previousTerms && typeof quote.previousTerms === 'object');
  const comparison = {
    isReapproval: Boolean(quote.status === 'PENDING_APPROVAL' && hasPreviousTerms),
    source: hasPreviousTerms ? 'PREVIOUS_TERMS' : 'BASELINE_TERMS',
    baselineTotal: baseTotalAmount,
    baseMarginPercentage,
    baseMarginAmount,
    proposedTotal: proposedTotalAmount,
    proposedMarginPercentage,
    proposedMarginAmount,
    marginDeltaPercentage,
    marginImpactAmount,
    previousTerms: quote.previousTerms || null,
  };

  // 4. Visual Approval Chain
  const chain = [
    {
      role: 'SALES_REP',
      label: 'Sales Representative',
      user: quote.salesRep?.name || 'Sales Rep',
      status: 'SUBMITTED',
      isCurrent: false,
      timestamp: quote.updatedAt || quote.createdAt,
    },
    {
      role: 'SALES_MANAGER',
      label: 'Sales Manager',
      status:
        quote.approvalStatus === 'PENDING_MANAGER'
          ? 'PENDING'
          : quote.approvalStatus === 'APPROVED' || quote.approvalStatus === 'PENDING_FINANCE'
          ? 'APPROVED'
          : quote.approvalStatus === 'REJECTED'
          ? 'REJECTED'
          : quote.approvalStatus === 'RETURNED_FOR_REVISION'
          ? 'RETURNED'
          : 'COMPLETED',
      isCurrent: quote.approvalStatus === 'PENDING_MANAGER',
      timestamp: null,
    },
    {
      role: 'FINANCE_OPERATIONS',
      label: 'Finance & Operations',
      status:
        quote.requiredApproverRole === 'SALES_MANAGER_THEN_FINANCE' ||
        quote.requiredApproverRole === 'FINANCE_OPERATIONS'
          ? quote.approvalStatus === 'PENDING_FINANCE'
            ? 'PENDING'
            : quote.approvalStatus === 'APPROVED'
            ? 'APPROVED'
            : 'UPCOMING'
          : 'NOT_REQUIRED',
      isCurrent: quote.approvalStatus === 'PENDING_FINANCE',
      timestamp: null,
    },
  ];

  return {
    governanceItems,
    violations: governanceItems.filter((i) => i.isExceeded),
    marginDelta: {
      baseMarginPercentage,
      currentMarginPercentage: proposedMarginPercentage,
      marginDeltaPercentage,
      baseMarginAmount,
      currentMarginAmount: proposedMarginAmount,
      marginImpactAmount,
    },
    comparison,
    approvalChain: chain,
  };
}

/**
 * Execute an approval decision (Approve, Reject, Return for Revision)
 */
export async function executeApprovalAction({
  quoteId,
  tenantId,
  userId,
  userRole,
  action,
  reason,
  comment,
  version,
  expectedVersion,
  revisedItems,
}) {
  if (!['APPROVE', 'REJECT', 'RETURN_FOR_REVISION'].includes(action)) {
    throw new Error(`Invalid approval action: ${action}`);
  }

  // 1. Role Authorization check: Only SALES_MANAGER or ADMIN can execute manager approval decisions
  if (userRole !== 'SALES_MANAGER' && userRole !== 'ADMIN') {
    const error = new Error('Unauthorized: Only Sales Managers or Administrators may act on manager approvals.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }

  // 2. Resolve quotation: supports lookup by quotation.id or approval.id with strict tenant scoping
  let quote = await prisma.quotation.findFirst({
    where: { id: quoteId, tenantId },
    include: {
      customer: true,
      items: { include: { product: true } },
      salesRep: true,
      approvals: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });

  let existingApprovalTask = null;
  if (!quote) {
    existingApprovalTask = await prisma.approval.findFirst({
      where: { id: quoteId, tenantId },
    });
    if (existingApprovalTask) {
      quote = await prisma.quotation.findFirst({
        where: { id: existingApprovalTask.quotationId, tenantId },
        include: {
          customer: true,
          items: { include: { product: true } },
          salesRep: true,
          approvals: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });
    }
  }

  if (!quote) {
    const error = new Error('Quotation or approval not found.');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // 3. Self-Approval Restriction (Requirement 13 & 1)
  if (quote.salesRepId === userId) {
    const error = new Error('Self-approval forbidden: You cannot approve or modify a quotation you authored.');
    error.statusCode = 403;
    error.code = 'SELF_APPROVAL_FORBIDDEN';
    throw error;
  }

  // 4. Current State Concurrency Verification (Requirement 6 step 8 & Requirement 16)
  const isPendingApproval =
    (quote.status === 'PENDING_APPROVAL' || quote.status === 'NEGOTIATION') &&
    quote.approvalStatus === 'PENDING_MANAGER';

  if (!isPendingApproval) {
    const error = new Error(
      `Quotation is no longer pending Sales Manager approval. Current status is ${quote.status} (${quote.approvalStatus}).`
    );
    error.statusCode = 409;
    error.code = 'STALE_APPROVAL_STATE';
    throw error;
  }

  // 5. Version-Based Concurrency Check (Requirement 16)
  const expectedVer =
    expectedVersion !== undefined && expectedVersion !== null
      ? parseInt(expectedVersion, 10)
      : version !== undefined && version !== null
      ? parseInt(version, 10)
      : null;

  if (expectedVer !== null && !isNaN(expectedVer) && quote.version !== expectedVer) {
    const error = new Error(
      `Quotation version conflict: Expected version ${expectedVer}, but quotation has been updated to version ${quote.version}. Please refresh and review the updated version.`
    );
    error.statusCode = 409;
    error.code = 'STALE_QUOTATION_VERSION';
    throw error;
  }

  // 6. Mandatory Reason validation for Reject & Return for Revision (Requirements 8 & 9)
  if ((action === 'REJECT' || action === 'RETURN_FOR_REVISION') && (!reason || !reason.trim())) {
    const error = new Error(
      `A clear justification reason is required when ${
        action === 'REJECT' ? 'rejecting a quotation' : 'returning a quotation for revision'
      }.`
    );
    error.statusCode = 400;
    error.code = 'REASON_REQUIRED';
    throw error;
  }

  const cleanReason = reason ? reason.trim() : null;
  const cleanComment = comment ? comment.trim() : null;

  // 7. Authoritative Recalculation & Risk Re-evaluation (Requirement 6 steps 10, 11, 12, 13)
  const enrichedItems = (quote.items || []).map((it) => {
    const revision = revisedItems?.find((r) => r.id === it.id || r.productId === it.productId);
    const discountPercentage =
      revision && revision.discountPercentage !== undefined
        ? parseFloat(revision.discountPercentage)
        : parseFloat(it.discountPercentage || 0);

    return {
      productId: it.productId,
      productNameSnapshot: it.productNameSnapshot,
      productTypeSnapshot: it.productTypeSnapshot,
      quantity: it.quantity,
      unitPrice: parseFloat(it.unitPrice),
      costPrice: parseFloat(it.costPrice || 0),
      taxRate: parseFloat(it.taxAmount > 0 && it.lineTotal > 0 ? (it.taxAmount / (it.lineTotal - it.taxAmount)) * 100 : 18.0),
      discountPercentage,
    };
  });

  const freshPricing = calculateQuotationTotals(enrichedItems);
  const freshRisk = await evaluateQuotationRisk(
    tenantId,
    freshPricing.items,
    quote.customer ? quote.customer.tier : 'BRONZE',
    freshPricing.marginPercentage
  );

  // 8. Execute Atomic State Transition via Database Transaction (Requirement 6 & 16)
  const result = await prisma.$transaction(async (tx) => {
    // Row-level / state concurrency check
    const lockCheck = await tx.quotation.findFirst({
      where: {
        id: quote.id,
        tenantId,
        status: quote.status,
        approvalStatus: 'PENDING_MANAGER',
      },
    });

    if (!lockCheck) {
      const err = new Error('Quotation was modified by another concurrent transaction.');
      err.statusCode = 409;
      err.code = 'CONCURRENT_UPDATE_CONFLICT';
      throw err;
    }

    let newStatus = quote.status;
    let newApprovalStatus = quote.approvalStatus;
    let auditAction = '';
    let responseMessage = '';
    let previousTermsSnapshot = quote.previousTerms;
    let revisionNotes = quote.revisionNotes;

    if (action === 'APPROVE') {
      // Check if multi-level approval is required (Requirement 7 & 12)
      const needsFinance =
        quote.requiredApproverRole === 'SALES_MANAGER_THEN_FINANCE' ||
        quote.requiredApproverRole === 'FINANCE_OPERATIONS' ||
        freshRisk.requiredApproverRole === 'SALES_MANAGER_THEN_FINANCE' ||
        freshRisk.requiredApproverRole === 'FINANCE_OPERATIONS';

      if (needsFinance) {
        newStatus = 'PENDING_APPROVAL';
        newApprovalStatus = 'PENDING_FINANCE';
        auditAction = 'APPROVAL_CHAIN_ADVANCED';
        responseMessage = 'Quotation approved by Sales Manager and routed to Finance queue.';

        // Create pending Finance approval task
        await tx.approval.create({
          data: {
            tenantId,
            quotationId: quote.id,
            approverRole: 'FINANCE_OPERATIONS',
            level: 'FINANCE_OPERATIONS',
            status: 'PENDING_FINANCE',
            riskScoreAtDecision: freshRisk.riskScore,
            marginPercentageAtDecision: freshPricing.marginPercentage,
            discountAmountAtDecision: freshPricing.discountAmount,
          },
        });
      } else {
        newStatus = 'APPROVED';
        newApprovalStatus = 'APPROVED';
        auditAction = 'QUOTE_APPROVED';
        responseMessage = 'Quotation approved successfully. Deal is ready for customer presentation.';
      }

      // If approved, mark all pending proposals & change requests as resolved
      if (newApprovalStatus === 'APPROVED') {
        await tx.negotiationProposal.updateMany({
          where: { quotationId: quote.id, status: { in: ['CUSTOMER_SUBMITTED', 'SELLER_REVIEWING'] } },
          data: { status: 'APPROVED', sellerResponse: cleanComment || 'Approved by manager' },
        });

        await tx.quoteChangeRequest.updateMany({
          where: { quotationId: quote.id, status: { in: ['CUSTOMER_SUBMITTED', 'SELLER_REVIEWING'] } },
          data: { status: 'ACCEPTED', sellerResponse: cleanComment || 'Approved by manager' },
        });
      }

      // If manager revised any items, snapshot previous terms & update line item rows
      if (revisedItems && revisedItems.length > 0) {
        previousTermsSnapshot = {
          subtotal: parseFloat(quote.subtotal),
          discountAmount: parseFloat(quote.discountAmount),
          totalAmount: parseFloat(quote.totalAmount),
          marginPercentage: parseFloat(quote.marginPercentage),
          riskScore: freshRisk.riskScore,
          items: (quote.items || []).map((it) => ({
            id: it.id,
            productName: it.productNameSnapshot,
            quantity: it.quantity,
            unitPrice: parseFloat(it.unitPrice),
            discountPercentage: parseFloat(it.discountPercentage),
            discountAmount: parseFloat(it.discountAmount),
            lineTotal: parseFloat(it.lineTotal),
          })),
          revisedBy: userId,
          revisedAt: new Date().toISOString(),
          comment: cleanComment,
        };
        revisionNotes = cleanComment || 'Manager approved revised commercial terms.';

        // Update database line items
        for (const it of quote.items) {
          const rev = revisedItems.find((r) => r.id === it.id || r.productId === it.productId);
          if (rev && rev.discountPercentage !== undefined) {
            const updatedItemPricing = freshPricing.items.find((i) => i.productId === it.productId);
            if (updatedItemPricing) {
              await tx.quotationItem.update({
                where: { id: it.id },
                data: {
                  discountPercentage: parseFloat(rev.discountPercentage),
                  discountAmount: updatedItemPricing.discountAmount,
                  taxAmount: updatedItemPricing.taxAmount,
                  lineTotal: updatedItemPricing.lineTotal,
                  marginAmount: updatedItemPricing.marginAmount,
                  marginPercentage: updatedItemPricing.marginPercentage,
                },
              });
            }
          }
        }
      }
    } else if (action === 'REJECT') {
      newStatus = 'REJECTED';
      newApprovalStatus = 'REJECTED';
      auditAction = 'QUOTE_REJECTED';
      responseMessage = 'Quotation rejected.';
    } else if (action === 'RETURN_FOR_REVISION') {
      newStatus = 'RETURNED_FOR_REVISION';
      newApprovalStatus = 'RETURNED_FOR_REVISION';
      auditAction = 'QUOTE_RETURNED_FOR_REVISION';
      revisionNotes = cleanReason;
      responseMessage = 'Quotation returned to Sales Representative for revision.';

      // Snapshot terms for before/after comparison upon resubmission
      previousTermsSnapshot = {
        subtotal: parseFloat(quote.subtotal),
        discountAmount: parseFloat(quote.discountAmount),
        totalAmount: parseFloat(quote.totalAmount),
        marginPercentage: parseFloat(quote.marginPercentage),
        riskScore: freshRisk.riskScore,
        items: (quote.items || []).map((it) => ({
          productName: it.productNameSnapshot,
          quantity: it.quantity,
          unitPrice: parseFloat(it.unitPrice),
          discountPercentage: parseFloat(it.discountPercentage),
          discountAmount: parseFloat(it.discountAmount),
          lineTotal: parseFloat(it.lineTotal),
        })),
        returnedBy: userId,
        returnedAt: new Date().toISOString(),
        reason: cleanReason,
      };
    }

    // Update Quotation state & increment version (Requirement 10 & 16)
    const quoteUpdateData = {
      status: newStatus,
      approvalStatus: newApprovalStatus,
      previousTerms: previousTermsSnapshot,
      revisionNotes,
      version: { increment: 1 },
    };

    // If terms were recalculated with revised items, write fresh totals
    if (revisedItems && revisedItems.length > 0) {
      quoteUpdateData.subtotal = freshPricing.subtotal;
      quoteUpdateData.discountAmount = freshPricing.discountAmount;
      quoteUpdateData.taxAmount = freshPricing.taxAmount;
      quoteUpdateData.totalAmount = freshPricing.totalAmount;
      quoteUpdateData.costAmount = freshPricing.costAmount;
      quoteUpdateData.marginAmount = freshPricing.marginAmount;
      quoteUpdateData.marginPercentage = freshPricing.marginPercentage;
      quoteUpdateData.riskScore = freshRisk.riskScore;
      quoteUpdateData.riskLevel = freshRisk.riskLevel;
      quoteUpdateData.riskReasons = freshRisk.reasons;
      quoteUpdateData.requiredApproverRole = freshRisk.requiredApproverRole;
    }

    const updatedQuote = await tx.quotation.update({
      where: { id: quote.id },
      data: quoteUpdateData,
      include: {
        customer: true,
        items: true,
        salesRep: { select: { id: true, name: true, email: true } },
      },
    });

    // Record decision in Approval table
    const decisionApproval = await tx.approval.create({
      data: {
        tenantId,
        quotationId: quote.id,
        approverId: userId,
        approverRole: userRole,
        level: 'SALES_MANAGER',
        status: newApprovalStatus === 'PENDING_FINANCE' ? 'APPROVED' : newApprovalStatus,
        reason: cleanReason,
        comment: cleanComment,
        riskScoreAtDecision: freshRisk.riskScore,
        marginPercentageAtDecision: freshPricing.marginPercentage,
        discountAmountAtDecision: freshPricing.discountAmount,
        actedAt: new Date(),
      },
    });

    // If quotation has customer and is approved, notify customer
    if (newApprovalStatus === 'APPROVED' && quote.customerId) {
      await tx.customerNotification.create({
        data: {
          tenantId,
          customerId: quote.customerId,
          title: `Terms Approved: Quote #${quote.quoteNumber}`,
          message: `The seller has approved the negotiated terms for quotation #${quote.quoteNumber}. You may now review and confirm your order.`,
          link: `/customer/quotes/${quote.id}`,
        },
      });
    }

    // Append-only Audit Trail (Requirement 17)
    await logAudit({
      tenantId,
      userId,
      action: auditAction,
      entityType: 'QUOTATION',
      entityId: quote.id,
      metadata: {
        quotationId: quote.id,
        approvalId: decisionApproval.id,
        quoteNumber: quote.quoteNumber,
        previousState: quote.status,
        newState: newStatus,
        action,
        reason: cleanReason,
        comment: cleanComment,
        riskScore: freshRisk.riskScore,
        marginPercentage: parseFloat(freshPricing.marginPercentage),
        timestamp: new Date().toISOString(),
      },
    });

    return { updatedQuote, responseMessage };
  });

  // Async notification dispatch
  try {
    const { updatedQuote } = result;
    if (updatedQuote.approvalStatus === 'APPROVED') {
      // Notify Sales Rep
      if (updatedQuote.salesRepId) {
        dispatchNotificationAsync({
          tenantId,
          recipientUserId: updatedQuote.salesRepId,
          recipientRole: 'SALES_REP',
          type: 'QUOTE_APPROVED',
          title: `Quotation #${updatedQuote.quoteNumber} Approved`,
          message: `Manager approved quotation #${updatedQuote.quoteNumber}. Total: ₹${updatedQuote.totalAmount}.`,
          entityType: 'QUOTATION',
          entityId: updatedQuote.id,
        });
      }
      // Notify Customer
      if (updatedQuote.customerId) {
        dispatchNotificationAsync({
          tenantId,
          recipientCustomerId: updatedQuote.customerId,
          recipientRole: 'CUSTOMER',
          type: 'QUOTE_APPROVED',
          title: `Terms Approved: Quote #${updatedQuote.quoteNumber}`,
          message: `The seller has approved the negotiated terms for quotation #${updatedQuote.quoteNumber}. You may now review and confirm your order.`,
          entityType: 'QUOTATION',
          entityId: updatedQuote.id,
        });
      }
    } else if (updatedQuote.approvalStatus === 'REJECTED') {
      if (updatedQuote.salesRepId) {
        dispatchNotificationAsync({
          tenantId,
          recipientUserId: updatedQuote.salesRepId,
          recipientRole: 'SALES_REP',
          type: 'QUOTE_REJECTED',
          title: `Quotation #${updatedQuote.quoteNumber} Rejected`,
          message: `Manager rejected quotation #${updatedQuote.quoteNumber}. Reason: ${cleanReason || 'No reason provided.'}`,
          entityType: 'QUOTATION',
          entityId: updatedQuote.id,
        });
      }
    } else if (updatedQuote.approvalStatus === 'RETURNED_FOR_REVISION') {
      if (updatedQuote.salesRepId) {
        dispatchNotificationAsync({
          tenantId,
          recipientUserId: updatedQuote.salesRepId,
          recipientRole: 'SALES_REP',
          type: 'QUOTE_RETURNED',
          title: `Quotation #${updatedQuote.quoteNumber} Returned for Revision`,
          message: `Manager requested revision for quotation #${updatedQuote.quoteNumber}. Reason: ${cleanReason || 'No reason provided.'}`,
          entityType: 'QUOTATION',
          entityId: updatedQuote.id,
        });
      }
    }
  } catch (err) {
    console.error('[APPROVAL_NOTIF_ERROR]:', err);
  }

  console.log(
    `⚖️ [APPROVAL] Action '${action}' executed on ${result.updatedQuote.quoteNumber} by User ${userId} -> New Status: ${result.updatedQuote.status} (${result.updatedQuote.approvalStatus})`
  );

  return result;
}

