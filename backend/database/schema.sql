-- DealFlow360 Master Relational Schema (PostgreSQL DDL)
-- Single Source of Truth for Autonomous Deal Management

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL, -- 'ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE_OPERATIONS', 'CUSTOMER'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  customer_tier TEXT NOT NULL DEFAULT 'BRONZE', -- 'GOLD', 'SILVER', 'BRONZE'
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'HARDWARE', 'SERVICE', 'SUBSCRIPTION'
  type TEXT NOT NULL,     -- 'HARDWARE', 'SERVICE', 'SUBSCRIPTION'
  price NUMERIC(12, 2) NOT NULL,
  unit_cost NUMERIC(12, 2) NOT NULL,
  billing_type TEXT DEFAULT 'ONE_TIME', -- 'ONE_TIME', 'RECURRING'
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discount_rules (
  id TEXT PRIMARY KEY,
  customer_tier TEXT NOT NULL,
  name TEXT NOT NULL,
  hardware_max_discount NUMERIC(5, 2) DEFAULT 15.00,
  service_max_discount NUMERIC(5, 2) DEFAULT 10.00,
  subscription_max_discount NUMERIC(5, 2) DEFAULT 5.00,
  min_margin_pct NUMERIC(5, 2) DEFAULT 25.00,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  transit_days INTEGER DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  warehouse_id TEXT REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  available_quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Canonical Single Source of Truth: Quotation
CREATE TABLE IF NOT EXISTS quotations (
  id TEXT PRIMARY KEY,
  quote_number TEXT UNIQUE NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  sales_rep_id TEXT REFERENCES users(id),
  customer_name TEXT NOT NULL,
  customer_company TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  sales_rep_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- 14 canonical statuses
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  margin NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  risk_score INTEGER NOT NULL DEFAULT 0, -- 0 to 100
  risk_level TEXT NOT NULL DEFAULT 'LOW', -- 'LOW', 'MEDIUM', 'HIGH'
  risk_factors TEXT DEFAULT '[]',
  approval_status TEXT NOT NULL DEFAULT 'DRAFT',
  customer_response TEXT,
  capex_one_time NUMERIC(12, 2) DEFAULT 0.00,
  opex_recurring_mrr NUMERIC(12, 2) DEFAULT 0.00,
  opex_recurring_arr NUMERIC(12, 2) DEFAULT 0.00,
  manager_note TEXT,
  finance_note TEXT,
  warehouse_status TEXT DEFAULT 'UNASSIGNED',
  payment_status TEXT DEFAULT 'UNPAID',
  current_step INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id TEXT PRIMARY KEY,
  quotation_id TEXT REFERENCES quotations(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL,
  unit_cost NUMERIC(12, 2) NOT NULL,
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  margin NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  line_total NUMERIC(12, 2) NOT NULL,
  billing_type TEXT DEFAULT 'ONE_TIME'
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  quotation_id TEXT REFERENCES quotations(id) ON DELETE CASCADE,
  approver_id TEXT REFERENCES users(id),
  approval_type TEXT NOT NULL, -- 'MANAGER', 'FINANCE'
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'RETURNED'
  reason TEXT,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS negotiations (
  id TEXT PRIMARY KEY,
  quotation_id TEXT REFERENCES quotations(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1,
  initiated_by TEXT NOT NULL, -- 'CUSTOMER', 'SALES_REP'
  previous_discount NUMERIC(5, 2) NOT NULL,
  requested_discount NUMERIC(5, 2) NOT NULL,
  previous_total NUMERIC(12, 2) NOT NULL,
  requested_total NUMERIC(12, 2) NOT NULL,
  message TEXT,
  risk_level_before TEXT,
  risk_level_after TEXT,
  status TEXT DEFAULT 'SUBMITTED',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_allocations (
  id TEXT PRIMARY KEY,
  quotation_id TEXT REFERENCES quotations(id) ON DELETE CASCADE,
  quotation_item_id TEXT,
  warehouse_id TEXT REFERENCES warehouses(id),
  warehouse_name TEXT NOT NULL,
  product_id TEXT REFERENCES products(id),
  quantity INTEGER NOT NULL,
  tracking_number TEXT,
  transit_days INTEGER DEFAULT 2,
  status TEXT DEFAULT 'ALLOCATED', -- 'ALLOCATED', 'DISPATCHED'
  fulfillment_type TEXT DEFAULT 'PHYSICAL',
  dispatch_date TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  quotation_id TEXT REFERENCES quotations(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id),
  product_id TEXT REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(12, 2) NOT NULL,
  billing_cycle TEXT DEFAULT 'MONTHLY',
  status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'PAUSED', 'CANCELLED'
  start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  next_billing_date TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  quotation_id TEXT REFERENCES quotations(id) ON DELETE CASCADE,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total NUMERIC(12, 2) NOT NULL,
  amount_due_today NUMERIC(12, 2) NOT NULL,
  status TEXT DEFAULT 'DRAFT', -- 'DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  due_date TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  method TEXT NOT NULL,
  status TEXT DEFAULT 'PAID',
  transaction_reference TEXT NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PRODUCTION PERFORMANCE INDEXES (Based on query patterns & workload)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_sales_rep ON quotations(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotations(created_at);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lookup ON inventory(warehouse_id, product_id);
CREATE INDEX IF NOT EXISTS idx_approvals_quote ON approvals(quotation_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_quote ON negotiations(quotation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quote ON invoices(quotation_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at);

-- ============================================================================
-- ENTERPRISE PARTITIONING BLUEPRINT (For high-volume audit logs & quotations)
-- Example for PostgreSQL time-based range partitioning:
-- CREATE TABLE audit_logs_partitioned (
--   id TEXT,
--   actor TEXT NOT NULL,
--   action TEXT NOT NULL,
--   entity_id TEXT NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE NOT NULL,
--   PRIMARY KEY (id, created_at)
-- ) PARTITION BY RANGE (created_at);
-- CREATE TABLE audit_logs_y2026 PARTITION OF audit_logs_partitioned
--   FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
-- ============================================================================

