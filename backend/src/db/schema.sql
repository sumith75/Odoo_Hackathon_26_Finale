-- PostgreSQL Schema for Enterprise CPQ (Canonical Single Source of Truth)

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  base_price NUMERIC(12, 2) NOT NULL,
  unit_cost NUMERIC(12, 2) NOT NULL,
  is_subscription BOOLEAN DEFAULT FALSE,
  billing_frequency TEXT DEFAULT 'one_time',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  monthly_rate NUMERIC(12, 2) NOT NULL,
  annual_rate NUMERIC(12, 2) NOT NULL,
  discount_annual_pct NUMERIC(5, 2) DEFAULT 15.00,
  features TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discount_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  min_quantity INTEGER DEFAULT 1,
  min_deal_value NUMERIC(12, 2) DEFAULT 0,
  max_rep_discount_pct NUMERIC(5, 2) DEFAULT 15.00,
  min_margin_pct NUMERIC(5, 2) DEFAULT 25.00,
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
  available_stock INTEGER DEFAULT 0,
  reserved_stock INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Canonical Single Source of Truth: Quotation
CREATE TABLE IF NOT EXISTS quotations (
  id TEXT PRIMARY KEY,
  quote_number TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_company TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  sales_rep_id TEXT NOT NULL,
  sales_rep_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',            -- DRAFT, PENDING_APPROVAL, APPROVED, NEGOTIATING, CONFIRMED, REJECTED
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,    -- Discount amount $
  discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00, -- Discount rate %
  tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,       -- Final Total
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  margin NUMERIC(5, 2) NOT NULL DEFAULT 0.00,       -- Gross Margin %
  profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  risk_score INTEGER NOT NULL DEFAULT 0,            -- 0 to 100
  risk_level TEXT NOT NULL DEFAULT 'SAFE',          -- SAFE, MEDIUM_RISK, HIGH_RISK
  risk_factors TEXT DEFAULT '[]',
  approval_status TEXT NOT NULL DEFAULT 'DRAFT',    -- DRAFT, PENDING_MANAGER, PENDING_FINANCE, APPROVED, REJECTED
  customer_response TEXT,                           -- Customer notes, counter-offer details, or acceptance signature
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

-- Canonical QuotationItems
CREATE TABLE IF NOT EXISTS quotation_items (
  id TEXT PRIMARY KEY,
  quotation_id TEXT REFERENCES quotations(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL,
  unit_cost NUMERIC(12, 2) NOT NULL,
  discount NUMERIC(5, 2) NOT NULL DEFAULT 0.00,     -- Discount % on item
  margin NUMERIC(5, 2) NOT NULL DEFAULT 0.00,       -- Margin % on line item
  line_total NUMERIC(12, 2) NOT NULL,
  is_subscription BOOLEAN DEFAULT FALSE,
  billing_frequency TEXT DEFAULT 'one_time'
);

CREATE TABLE IF NOT EXISTS quote_approvals (
  id TEXT PRIMARY KEY,
  quote_id TEXT REFERENCES quotations(id) ON DELETE CASCADE,
  step_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  reviewer_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS negotiation_history (
  id TEXT PRIMARY KEY,
  quote_id TEXT REFERENCES quotations(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  requested_discount_pct NUMERIC(5, 2) NOT NULL,
  counter_offer_total NUMERIC(12, 2) NOT NULL,
  customer_notes TEXT,
  risk_level_before TEXT,
  risk_level_after TEXT,
  auto_detected_variance TEXT,
  status TEXT DEFAULT 'SUBMITTED',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_allocations (
  id TEXT PRIMARY KEY,
  quote_id TEXT REFERENCES quotations(id) ON DELETE CASCADE,
  warehouse_id TEXT REFERENCES warehouses(id),
  warehouse_name TEXT NOT NULL,
  product_id TEXT REFERENCES products(id),
  product_name TEXT NOT NULL,
  allocated_quantity INTEGER NOT NULL,
  tracking_number TEXT,
  transit_days INTEGER DEFAULT 2,
  status TEXT DEFAULT 'ALLOCATED',
  fulfillment_type TEXT DEFAULT 'PHYSICAL',
  dispatch_date TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  quote_id TEXT REFERENCES quotations(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  capex_total NUMERIC(12, 2) NOT NULL,
  opex_recurring_mrr NUMERIC(12, 2) NOT NULL,
  opex_recurring_arr NUMERIC(12, 2) NOT NULL,
  tax_amount NUMERIC(12, 2) DEFAULT 0.00,
  grand_total NUMERIC(12, 2) NOT NULL,
  amount_due_today NUMERIC(12, 2) NOT NULL,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'UNPAID',
  transaction_id TEXT,
  receipt_number TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  quote_id TEXT,
  actor TEXT NOT NULL,
  step_number INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Production Performance Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_sales_rep ON quotations(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotations(created_at);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_inv_lookup ON inventory(warehouse_id, product_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at);

