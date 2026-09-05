import express from 'express';
import { memStore } from '../config/db.js';
import {
  initialProducts,
  initialSubscriptionPlans,
  initialDiscountRules,
  initialWarehouses,
  initialInventory
} from '../db/seedData.js';

const router = express.Router();

// Get all products
router.get('/products', (req, res) => {
  res.json({ success: true, products: memStore.products });
});

// Add a new product
router.post('/products', (req, res) => {
  const { name, sku, category, base_price, unit_cost, is_subscription, billing_frequency, description } = req.body;
  const newProduct = {
    id: `prod-${Math.random().toString(36).substr(2, 9)}`,
    name: name || 'Custom Product',
    sku: sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
    category: category || 'hardware',
    base_price: Number(base_price) || 0,
    unit_cost: Number(unit_cost) || 0,
    is_subscription: Boolean(is_subscription),
    billing_frequency: billing_frequency || 'one_time',
    description: description || ''
  };
  memStore.products.push(newProduct);
  res.json({ success: true, product: newProduct });
});

// Update product
router.put('/products/:id', (req, res) => {
  const idx = memStore.products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Product not found' });

  memStore.products[idx] = {
    ...memStore.products[idx],
    ...req.body,
    base_price: Number(req.body.base_price ?? memStore.products[idx].base_price),
    unit_cost: Number(req.body.unit_cost ?? memStore.products[idx].unit_cost)
  };
  res.json({ success: true, product: memStore.products[idx] });
});

// Get discount & governance rules
router.get('/rules', (req, res) => {
  const rules = memStore.discount_rules[0] || initialDiscountRules[0];
  res.json({ success: true, rules });
});

// Update discount rules
router.put('/rules', (req, res) => {
  const { hardware_max_discount, service_max_discount, subscription_max_discount, min_margin_pct, name } = req.body;
  const current = memStore.discount_rules[0] || initialDiscountRules[0];
  const updated = {
    ...current,
    name: name || current.name,
    hardware_max_discount: Number(hardware_max_discount ?? current.hardware_max_discount ?? 15.0),
    service_max_discount: Number(service_max_discount ?? current.service_max_discount ?? 10.0),
    subscription_max_discount: Number(subscription_max_discount ?? current.subscription_max_discount ?? 5.0),
    min_margin_pct: Number(min_margin_pct ?? current.min_margin_pct ?? 25.0)
  };
  memStore.discount_rules[0] = updated;

  // Log in audit log
  memStore.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    quote_id: null,
    actor: 'Admin',
    step_number: 1,
    action: 'CONFIGURED_RULES',
    details: `Updated rules: Hardware max = ${updated.hardware_max_discount}%, Service max = ${updated.service_max_discount}%, Subscription max = ${updated.subscription_max_discount}%, Min margin = ${updated.min_margin_pct}%`,
    created_at: new Date().toISOString()
  });

  res.json({ success: true, rules: updated });
});

// Get warehouses and current stock levels
router.get('/warehouses', (req, res) => {
  const warehousesWithStock = memStore.warehouses.map(wh => {
    const whInventory = memStore.inventory
      .filter(inv => inv.warehouse_id === wh.id)
      .map(inv => {
        const prod = memStore.products.find(p => p.id === inv.product_id);
        return {
          ...inv,
          product_name: prod ? prod.name : 'Unknown Product',
          sku: prod ? prod.sku : ''
        };
      });
    return {
      ...wh,
      inventory: whInventory
    };
  });
  res.json({ success: true, warehouses: warehousesWithStock });
});

// Update inventory stock
router.put('/inventory', (req, res) => {
  const { warehouse_id, product_id, available_stock } = req.body;
  const item = memStore.inventory.find(i => i.warehouse_id === warehouse_id && i.product_id === product_id);
  if (item) {
    item.available_stock = Number(available_stock);
  } else {
    memStore.inventory.push({
      id: `inv-${Date.now()}`,
      warehouse_id,
      product_id,
      available_stock: Number(available_stock),
      reserved_stock: 0
    });
  }
  res.json({ success: true, message: 'Stock updated successfully' });
});

// Get subscription plans
router.get('/plans', (req, res) => {
  res.json({ success: true, plans: memStore.subscription_plans });
});

// Reset demo state
router.post('/reset', (req, res) => {
  memStore.products = [...initialProducts];
  memStore.subscription_plans = [...initialSubscriptionPlans];
  memStore.discount_rules = [...initialDiscountRules];
  memStore.warehouses = [...initialWarehouses];
  memStore.inventory = [...initialInventory];
  memStore.quotes = [];
  memStore.quote_items = [];
  memStore.quote_approvals = [];
  memStore.negotiation_history = [];
  memStore.warehouse_allocations = [];
  memStore.invoices = [];
  memStore.audit_logs = [];
  res.json({ success: true, message: 'Master state reset to fresh defaults.' });
});

export default router;
