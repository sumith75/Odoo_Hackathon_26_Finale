-- DealFlow360 Master Seed Data (PostgreSQL SQL)

-- Users (5 Roles)
INSERT INTO users (id, name, email, role) VALUES
  ('user-admin', 'Admin', 'admin@dealflow360.com', 'ADMIN'),
  ('user-sales', 'Sales Rep', 'sales@dealflow360.com', 'SALES_REP'),
  ('user-manager', 'Sales Manager', 'manager@dealflow360.com', 'SALES_MANAGER'),
  ('user-finance', 'Finance / Operations', 'finance@dealflow360.com', 'FINANCE_OPERATIONS'),
  ('user-customer', 'Customer', 'customer@acme.com', 'CUSTOMER')
ON CONFLICT (id) DO NOTHING;

-- Customers
INSERT INTO customers (id, name, email, company_name, customer_tier, phone) VALUES
  ('cust-acme', 'Acme Corporation', 'customer@acme.com', 'Acme Corporation', 'GOLD', '+91 98765 43210')
ON CONFLICT (id) DO NOTHING;

-- Products (Hardware, Service, Subscription)
INSERT INTO products (id, sku, name, description, category, type, price, unit_cost, billing_type) VALUES
  ('prod-laptop-x', 'LAPTOP-X', 'Laptop X', 'Enterprise ultrabook, Intel i7, 32GB RAM, 1TB SSD', 'HARDWARE', 'HARDWARE', 80000.00, 55000.00, 'ONE_TIME'),
  ('prod-install', 'SERV-INSTALL', 'Installation Service', 'On-site enterprise device staging, OS imaging, asset tagging', 'SERVICE', 'SERVICE', 20000.00, 8000.00, 'ONE_TIME'),
  ('prod-support', 'SUB-SUPPORT', 'Premium Support', '24/7 dedicated enterprise technical support, 1-hour SLA', 'SUBSCRIPTION', 'SUBSCRIPTION', 3000.00, 500.00, 'RECURRING')
ON CONFLICT (id) DO NOTHING;

-- Discount Governance Rules
INSERT INTO discount_rules (id, customer_tier, name, hardware_max_discount, service_max_discount, subscription_max_discount, min_margin_pct) VALUES
  ('rule-gold', 'GOLD', 'Gold Tier CPQ Governance Policy', 15.00, 10.00, 5.00, 25.00)
ON CONFLICT (id) DO NOTHING;

-- Warehouses
INSERT INTO warehouses (id, code, name, location, transit_days) VALUES
  ('wh-blr', 'WH-BLR', 'Bangalore Central Warehouse', 'Bangalore, Karnataka', 2),
  ('wh-hyd', 'WH-HYD', 'Hyderabad Logistics Hub', 'Hyderabad, Telangana', 3)
ON CONFLICT (id) DO NOTHING;

-- Inventory (Bangalore: 8, Hyderabad: 4)
INSERT INTO inventory (id, warehouse_id, product_id, available_quantity, reserved_quantity) VALUES
  ('inv-blr-1', 'wh-blr', 'prod-laptop-x', 8, 0),
  ('inv-hyd-1', 'wh-hyd', 'prod-laptop-x', 4, 0)
ON CONFLICT (id) DO NOTHING;
