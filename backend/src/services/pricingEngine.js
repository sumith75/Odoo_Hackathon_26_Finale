/**
 * pricingEngine.js — Deterministic Financial & Margin Calculation Engine
 *
 * Implements authoritative mathematical formulas for DealFlow360:
 * Line Item:
 *   grossAmount = quantity * unitPrice
 *   discountAmount = grossAmount * (discountPercentage / 100)
 *   netAmount = grossAmount - discountAmount
 *   taxAmount = netAmount * (taxRate / 100)
 *   lineTotal = netAmount + taxAmount
 *   costAmount = quantity * costPrice
 *   marginAmount = netAmount - costAmount
 *   marginPercentage = netAmount > 0 ? (marginAmount / netAmount) * 100 : 0
 *
 * Quotation Total:
 *   subtotal = sum(netAmount)
 *   discountAmount = sum(discountAmount)
 *   taxAmount = sum(taxAmount)
 *   totalAmount = subtotal + taxAmount
 *   costAmount = sum(costAmount)
 *   marginAmount = subtotal - costAmount
 *   marginPercentage = subtotal > 0 ? (marginAmount / subtotal) * 100 : 0
 */

export function calculateLineItemPricing(item) {
  const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
  const unitPrice = Math.max(0, parseFloat(item.unitPrice ?? item.unit_price) || 0);
  const costPrice = Math.max(0, parseFloat(item.costPrice ?? item.cost_price) || 0);
  const discountPercentage = Math.min(
    100,
    Math.max(0, parseFloat(item.discountPercentage ?? item.discount_pct) || 0)
  );
  const taxRate = Math.max(0, parseFloat(item.taxRate ?? item.tax_rate) || 0);

  const grossAmount = Math.round(quantity * unitPrice * 100) / 100;
  const discountAmount = Math.round(grossAmount * (discountPercentage / 100) * 100) / 100;
  const netAmount = Math.round((grossAmount - discountAmount) * 100) / 100;
  const taxAmount = Math.round(netAmount * (taxRate / 100) * 100) / 100;
  const lineTotal = Math.round((netAmount + taxAmount) * 100) / 100;

  const costAmount = Math.round(quantity * costPrice * 100) / 100;
  const marginAmount = Math.round((netAmount - costAmount) * 100) / 100;
  const marginPercentage = netAmount > 0 ? Math.round((marginAmount / netAmount) * 10000) / 100 : 0;

  return {
    quantity,
    unitPrice,
    costPrice,
    discountPercentage,
    taxRate,
    grossAmount,
    discountAmount,
    netAmount,
    taxAmount,
    lineTotal,
    costAmount,
    marginAmount,
    marginPercentage,
  };
}

export function calculateQuotationTotals(items = []) {
  const calculatedItems = items.map((item) => ({
    ...item,
    ...calculateLineItemPricing(item),
  }));

  let grossTotal = 0;
  let discountAmount = 0;
  let subtotal = 0;
  let taxAmount = 0;
  let totalAmount = 0;
  let costAmount = 0;

  for (const item of calculatedItems) {
    grossTotal += item.grossAmount;
    discountAmount += item.discountAmount;
    subtotal += item.netAmount;
    taxAmount += item.taxAmount;
    totalAmount += item.lineTotal;
    costAmount += item.costAmount;
  }

  grossTotal = Math.round(grossTotal * 100) / 100;
  discountAmount = Math.round(discountAmount * 100) / 100;
  subtotal = Math.round(subtotal * 100) / 100;
  taxAmount = Math.round(taxAmount * 100) / 100;
  totalAmount = Math.round(totalAmount * 100) / 100;
  costAmount = Math.round(costAmount * 100) / 100;

  const marginAmount = Math.round((subtotal - costAmount) * 100) / 100;
  const marginPercentage = subtotal > 0 ? Math.round((marginAmount / subtotal) * 10000) / 100 : 0;

  // Determine visual margin health status
  let marginHealth = 'HEALTHY';
  if (marginPercentage < 10) {
    marginHealth = 'LOW';
  } else if (marginPercentage < 20) {
    marginHealth = 'WATCH';
  }

  return {
    items: calculatedItems,
    grossTotal,
    discountAmount,
    subtotal,
    taxAmount,
    totalAmount,
    costAmount,
    marginAmount,
    marginPercentage,
    marginHealth,
  };
}

// Backward compatibility alias for legacy quoteRoutes.js
export function calculateQuotePricing(items = [], requestedDiscount = null) {
  const adjustedItems = items.map((item) => ({
    ...item,
    unitPrice: item.unitPrice ?? item.unit_price ?? 0,
    costPrice: item.costPrice ?? item.cost_price ?? 0,
    quantity: item.quantity || 1,
    taxRate: item.taxRate ?? item.tax_rate ?? 18,
    discountPercentage:
      requestedDiscount !== null
        ? requestedDiscount
        : item.discountPercentage ?? item.discount_pct ?? 0,
  }));

  const res = calculateQuotationTotals(adjustedItems);
  return {
    ...res,
    subtotal: res.subtotal,
    discount_amount: res.discountAmount,
    tax_amount: res.taxAmount,
    total_amount: res.totalAmount,
    margin_pct: res.marginPercentage,
    items: res.items,
  };
}
