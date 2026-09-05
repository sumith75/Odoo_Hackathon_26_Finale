// Master seed dataset for DealFlow360

export const initialUsers = [
  {
    id: 'user-admin',
    name: 'Sarah Admin (Systems Admin)',
    email: 'admin@dealflow360.com',
    role: 'ADMIN'
  },
  {
    id: 'user-sales',
    name: 'Alex Morgan (Enterprise AE)',
    email: 'sales@dealflow360.com',
    role: 'SALES_REP'
  },
  {
    id: 'user-manager',
    name: 'Vikram Mehta (VP Sales / Approver)',
    email: 'manager@dealflow360.com',
    role: 'SALES_MANAGER'
  },
  {
    id: 'user-finance',
    name: 'Priya Sharma (Finance & Operations Controller)',
    email: 'finance@dealflow360.com',
    role: 'FINANCE_OPERATIONS'
  },
  {
    id: 'user-customer',
    name: 'Rajesh Kumar (Procurement Lead, Acme Corp)',
    email: 'customer@acme.com',
    role: 'CUSTOMER'
  }
];

export const initialCustomers = [
  {
    id: 'cust-acme',
    name: 'Acme Corporation',
    companyName: 'Acme Corporation',
    email: 'customer@acme.com',
    customerTier: 'GOLD',
    phone: '+91 98765 43210'
  }
];

export const initialProducts = [
  {
    id: 'prod-laptop-x',
    sku: 'LAPTOP-X',
    name: 'Laptop X',
    description: 'High-performance commercial ultrabook with Intel i7, 32GB RAM, 1TB SSD',
    category: 'HARDWARE',
    type: 'HARDWARE',
    base_price: 80000,
    unit_cost: 55000,
    is_subscription: false,
    billing_frequency: 'one_time'
  },
  {
    id: 'prod-install',
    sku: 'SERV-INSTALL',
    name: 'Installation Service',
    description: 'On-site enterprise device staging, domain joining, custom OS imaging, and asset tagging',
    category: 'SERVICE',
    type: 'SERVICE',
    base_price: 20000,
    unit_cost: 8000,
    is_subscription: false,
    billing_frequency: 'one_time'
  },
  {
    id: 'prod-support',
    sku: 'SUB-SUPPORT',
    name: 'Premium Support',
    description: '24/7 dedicated enterprise technical support, 1-hour SLA, and quarterly health reviews',
    category: 'SUBSCRIPTION',
    type: 'SUBSCRIPTION',
    base_price: 3000,
    unit_cost: 500,
    is_subscription: true,
    billing_frequency: 'monthly'
  }
];

export const initialSubscriptionPlans = [
  {
    id: 'plan-support',
    code: 'PREMIUM-SUPPORT',
    name: 'Enterprise Premium Support',
    monthly_rate: 3000,
    annual_rate: 30000,
    discount_annual_pct: 16.7,
    features: '24/7 dedicated enterprise support, 1-hour SLA, quarterly health reviews'
  }
];

export const initialDiscountRules = [
  {
    id: 'rule-gold',
    customerTier: 'GOLD',
    name: 'Gold Tier CPQ Governance Policy',
    hardware_max_discount: 15.0,    // Hardware max 15%
    service_max_discount: 10.0,     // Service max 10% (18% triggers risk 🚨)
    subscription_max_discount: 5.0, // Subscription max 5%
    min_margin_pct: 25.0
  }
];

export const initialWarehouses = [
  {
    id: 'wh-blr',
    code: 'WH-BLR',
    name: 'Bangalore Central Warehouse',
    location: 'Bangalore, Karnataka',
    transit_days: 2
  },
  {
    id: 'wh-hyd',
    code: 'WH-HYD',
    name: 'Hyderabad Logistics Hub',
    location: 'Hyderabad, Telangana',
    transit_days: 3
  }
];

export const initialInventory = [
  // 10 Laptops required: Bangalore has 8, Hyderabad has 4 -> Auto-allocates 8 from Bangalore + 2 from Hyderabad!
  { id: 'inv-blr-1', warehouse_id: 'wh-blr', product_id: 'prod-laptop-x', available_stock: 8, reserved_stock: 0 },
  { id: 'inv-hyd-1', warehouse_id: 'wh-hyd', product_id: 'prod-laptop-x', available_stock: 4, reserved_stock: 0 }
];
