// Category-aware Pricing Engine for DealFlow360

export function calculateQuotePricing(items = [], globalDiscountPct = 0) {
  let subtotal = 0;
  let totalCost = 0;
  let capexOneTime = 0;
  let opexRecurringMrr = 0;
  let totalDiscountAmount = 0;

  const processedItems = items.map(item => {
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unit_price || item.base_price) || 0;
    const unitCost = Number(item.unit_cost) || 0;
    
    // Per-item discount percent (fallback to global discount if item discount not explicitly set)
    const itemDiscountPct = Number(item.discount_pct ?? item.discount ?? globalDiscountPct) || 0;

    const lineListTotal = unitPrice * qty;
    const lineDiscountAmt = lineListTotal * (itemDiscountPct / 100);
    const lineNetTotal = lineListTotal - lineDiscountAmt;
    const lineCost = unitCost * qty;
    const lineProfit = lineNetTotal - lineCost;
    const lineMarginPct = lineNetTotal > 0 ? (lineProfit / lineNetTotal) * 100 : 0;

    subtotal += lineListTotal;
    totalDiscountAmount += lineDiscountAmt;
    totalCost += lineCost;

    const isRecurring = item.is_subscription || item.category === 'SUBSCRIPTION' || item.billing_frequency === 'monthly';

    if (isRecurring) {
      opexRecurringMrr += lineNetTotal;
    } else {
      capexOneTime += lineNetTotal;
    }

    return {
      ...item,
      quantity: qty,
      unit_price: unitPrice,
      unit_cost: unitCost,
      discount_pct: itemDiscountPct,
      discount: itemDiscountPct,
      discount_amount: Math.round(lineDiscountAmt),
      line_total: Math.round(lineNetTotal),
      line_cost: Math.round(lineCost),
      line_margin_pct: Math.round(lineMarginPct * 10) / 10,
      margin: Math.round(lineMarginPct * 10) / 10,
      is_subscription: isRecurring,
      category: item.category || (isRecurring ? 'SUBSCRIPTION' : 'HARDWARE')
    };
  });

  const finalTotal = capexOneTime + opexRecurringMrr; // Base net total (Capex + 1st month recurring)
  const annualArr = opexRecurringMrr * 12;
  const totalContractValue = capexOneTime + annualArr;
  const profitAmount = finalTotal - totalCost;
  const overallMarginPct = finalTotal > 0 ? (profitAmount / finalTotal) * 100 : 0;
  const overallDiscountPct = subtotal > 0 ? (totalDiscountAmount / subtotal) * 100 : 0;

  return {
    items: processedItems,
    subtotal: Math.round(subtotal),
    discount_amount: Math.round(totalDiscountAmount),
    discount: Math.round(totalDiscountAmount),
    discount_pct: Math.round(overallDiscountPct * 10) / 10,
    final_total: Math.round(finalTotal),
    total: Math.round(finalTotal),
    total_cost: Math.round(totalCost),
    profit_amount: Math.round(profitAmount),
    margin_pct: Math.round(overallMarginPct * 10) / 10,
    margin: Math.round(overallMarginPct * 10) / 10,
    capex_one_time: Math.round(capexOneTime),
    opex_recurring_mrr: Math.round(opexRecurringMrr),
    opex_recurring_arr: Math.round(annualArr),
    total_contract_value: Math.round(totalContractValue)
  };
}
