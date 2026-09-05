// Intelligent Upsell & Cross-Sell Recommendation Engine

export function generateUpsellRecommendations(items = [], allProducts = []) {
  const itemProductIds = new Set(items.map(i => i.product_id || i.id));
  const hasLaptops = items.some(i => (i.name || i.product_name || '').toLowerCase().includes('laptop') || i.product_id === 'prod-lap-100');
  const hasHardware = items.some(i => i.category === 'hardware');
  const recommendations = [];

  // 1. Cloud Fleet Device Management SaaS (for Laptops)
  if (hasLaptops && !itemProductIds.has('prod-sub-mdm')) {
    const mdmProduct = allProducts.find(p => p.id === 'prod-sub-mdm');
    if (mdmProduct) {
      recommendations.push({
        id: 'rec-mdm',
        product: mdmProduct,
        headline: 'Cloud Fleet Device Management & Security SaaS',
        badge: 'High-Margin MRR (85% Margin)',
        description: 'Provide zero-touch MDM, remote wipe, and endpoint security telemetry for all laptops.',
        financial_impact: '+$35/mo per laptop Recurring MRR',
        margin_impact: '+5.4% Deal Margin Uplift',
        recommended_quantity: items.find(i => i.product_id === 'prod-lap-100')?.quantity || 10
      });
    }
  }

  // 2. 24/7 Mission-Critical Hardware SLA
  if (!itemProductIds.has('prod-sla-platinum')) {
    const slaProduct = allProducts.find(p => p.id === 'prod-sla-platinum');
    if (slaProduct) {
      recommendations.push({
        id: 'rec-sla',
        product: slaProduct,
        headline: '24/7 Mission-Critical SLA & Replacement',
        badge: 'Fleet Assurance',
        description: '4-hour on-site courier laptop swap guarantee and priority escalation.',
        financial_impact: '+$150/mo Recurring MRR',
        margin_impact: '+4.2% Deal Margin Uplift',
        recommended_quantity: 1
      });
    }
  }

  // 3. White-Glove Deployment Service
  if (hasHardware && !itemProductIds.has('prod-serv-deploy')) {
    const deployProduct = allProducts.find(p => p.id === 'prod-serv-deploy');
    if (deployProduct) {
      recommendations.push({
        id: 'rec-deploy',
        product: deployProduct,
        headline: 'White-Glove Deployment & Configuration Service',
        badge: 'Setup Assurance',
        description: 'Zero-touch packaging, custom disk imaging, and enterprise asset tagging.',
        financial_impact: '+$2,500 One-time Capex',
        margin_impact: '+3.1% Deal Margin Uplift',
        recommended_quantity: 1
      });
    }
  }

  return recommendations;
}
