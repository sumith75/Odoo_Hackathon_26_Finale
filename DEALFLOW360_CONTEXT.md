# DEALFLOW360 — COMPLETE MASTER CONTEXT & ARCHITECTURE SPECIFICATION

## 1. PROJECT OVERVIEW
**DealFlow360** is a smart, self-governing deal management engine that goes beyond a basic Quote-to-Cash system.
The application manages the complete lifecycle of a business deal:
```
Product & Pricing Configuration → Quotation → Discount Risk Analysis → Approval → Upsell/Cross-sell → Warehouse Allocation → Customer Portal → Negotiation → Re-evaluation → Re-approval → Customer Confirmation → Fulfillment → Hybrid Billing → Payment → Deal Health
```
The goal is to demonstrate that the system is not just storing quotes and invoices, but is actively making business decisions based on rules, risk, approvals, inventory, negotiation, and billing.

---

## 2. FIVE USER ROLES
1. **ROLE 1 — SALES REPRESENTATIVE** (`sales@dealflow360.com`): Creates & configures quotes, adds products/services, sets quantities & discounts, views calculated totals, sees automated risk & approval status, views & responds to negotiations.
2. **ROLE 2 — SALES MANAGER / APPROVER** (`manager@dealflow360.com`): Protects margins, views approval queue with risk scores, sees exact discount violations, approves/rejects/returns deals with reasons.
3. **ROLE 3 — FINANCE / OPERATIONS USER** (`finance@dealflow360.com`): Manages warehouse inventory, allocates split stock across hubs, views fulfillment, generates hybrid capex/recurring invoices, processes payments, activates subscriptions, views deal health.
4. **ROLE 4 — CUSTOMER** (`customer@acme.com`): Logs into customer portal/deal room, reviews quote lines, submits negotiation counter-offers, observes automated risk recalculation, confirms final deals digitally.
5. **ROLE 5 — ADMIN** (`admin@dealflow360.com`): Configures master catalog, tier discount caps, minimum gross margin thresholds, warehouses, and users.

---

## 3. CANONICAL SINGLE SOURCE OF TRUTH — QUOTATION
The central object of DealFlow360 is the **Quotation** (`quotations` table).
All child operations connect through this canonical record:
```
Customer ➔ Sales Rep ➔ Quotation ➔ Quotation Items ➔ Pricing ➔ Discount ➔ Risk ➔ Approval ➔ Negotiation ➔ Warehouse Allocation ➔ Fulfillment ➔ Billing ➔ Payment
```

---

## 4. 14 UNIFIED QUOTATION STATUSES
1. `DRAFT`
2. `SUBMITTED`
3. `PENDING_APPROVAL`
4. `MANAGER_APPROVED`
5. `FINANCE_APPROVED`
6. `SENT_TO_CUSTOMER`
7. `NEGOTIATION`
8. `CUSTOMER_CONFIRMED`
9. `FULFILLMENT`
10. `PARTIALLY_FULFILLED`
11. `FULFILLED`
12. `INVOICED`
13. `PAID`
14. `REJECTED`

---

## 5. PRIMARY DEMO SCENARIO (THE 25-STEP GOLD STANDARD)
- **Customer**: Acme Corporation (Tier: `GOLD`)
- **Products**:
  - `Laptop X`: ₹80,000 (Hardware, One-time, Max Allowed Discount: 15%)
  - `Installation Service`: ₹20,000 (Service, One-time, Max Allowed Discount: 10%)
  - `Premium Support`: ₹3,000/month (Subscription, Recurring MRR, Max Allowed Discount: 5%)
- **Warehouses**:
  - `Bangalore Central Warehouse`: 8 units available
  - `Hyderabad Logistics Hub`: 4 units available
- **Scenario**:
  1. Sales Rep orders 10 Laptops (12% disc), 1 Installation Service (**18% disc > 10% limit 🚨**), 10 Premium Support (5% disc).
  2. System detects violation: **HIGH RISK (Score: 82/100)**, locks status to `PENDING_APPROVAL`.
  3. Manager reviews reason and approves.
  4. Upsell engine recommends related services.
  5. Multi-warehouse engine splits 10 laptops into: **Bangalore = 8, Hyderabad = 2**.
  6. Customer receives quote and submits counter-offer: **20% discount on Laptops**.
  7. System recalculates risk: **20% > 15% allowed ➔ HIGH RISK (Score: 85/100)**, automatically triggers re-approval loop.
  8. Manager reviews counter-offer diff and approves concession.
  9. Customer confirms deal (`CUSTOMER_CONFIRMED`).
  10. Order fulfilled (`FULFILLED`).
  11. Hybrid invoice generated (One-time Capex ₹6,56,400 + Recurring MRR ₹28,500/mo).
  12. Payment simulated (`PAID`).
  13. Deal Health displays **HEALTHY (Deal #DF360-1042)**.

---

## 6. PROJECT DIRECTORY STRUCTURE
```
dealflow360/
├── backend/
│   ├── src/
│   │   ├── config/      (PostgreSQL & in-memory fallback store)
│   │   ├── db/          (SQL Schema & Seed data)
│   │   ├── routes/      (Admin, Auth, Quotes, Approvals, Customer, Execution, Dashboard)
│   │   ├── services/    (Pricing, Risk, Upsell, Inventory, Billing Engines)
│   │   └── server.js    (Express server on port 5000)
│   ├── tests/           (test-flow.js 13-step automated test suite)
│   └── package.json
├── database/
│   ├── schema.sql       (PostgreSQL DDL schema)
│   └── seed.sql         (Master seed data)
├── frontend/
│   ├── src/
│   │   ├── components/  (Admin, CPQ Studio, Approvals, Deal Room, Warehouses, Billing, Dashboard, Stepper)
│   │   ├── App.jsx      (Navigation, role switcher, judge stepper)
│   │   └── index.css    (Modern Enterprise SaaS styling)
│   └── package.json
├── DEALFLOW360_CONTEXT.md
└── README.md
```
