# 🚀 DealFlow360 — Autonomous Deal Lifecycle & Governance Engine
> **Odoo Hackathon Finale Project**  
> *A smart, self-governing CPQ and Order-to-Cash engine that actively evaluates risk, governs approvals, splits multi-warehouse fulfillment, handles customer negotiation counter-offers with closed-loop re-evaluation, and manages hybrid billing.*

---

## 🌟 Architecture Overview

DealFlow360 manages the complete lifecycle of enterprise deals around a **Canonical Quotation Single Source of Truth**:

```
Admin Rules Config ➔ Sales Rep CPQ ➔ Discount Risk Analysis ➔ Manager Approval ➔ Smart Upsell
         ➔ Multi-Warehouse Allocation ➔ Customer Portal ➔ Negotiation Counter-Offer
         ➔ Closed-Loop Re-Risk Check ➔ Manager Re-Approval ➔ Customer Confirmation
         ➔ Warehouse Fulfillment ➔ Hybrid Capex/Opex Billing ➔ Payment ➔ Deal Health
```

---

## 👥 Five User Roles & Demo Credentials

| Role | Name | Email | Password | Primary Responsibilities |
|---|---|---|---|---|
| **Admin** | Sarah Admin | `admin@dealflow360.com` | *1-Click Demo Login* | Configures products, tier discount ceilings (Hardware 15%, Service 10%, Sub 5%), margins, and warehouses |
| **Sales Rep** | Alex Morgan | `sales@dealflow360.com` | *1-Click Demo Login* | Creates quotes, configures products & quantities, views live margin meter, flags risk |
| **Sales Manager** | Vikram Mehta | `manager@dealflow360.com` | *1-Click Demo Login* | Reviews approval queue, examines risk scores (e.g. 82/100), reviews reasons, approves/rejects |
| **Finance / Operations** | Priya Sharma | `finance@dealflow360.com` | *1-Click Demo Login* | Manages multi-warehouse split inventory, generates hybrid invoices, captures payments, tracks ARR |
| **Customer** | Rajesh Kumar (Acme) | `customer@acme.com` | *1-Click Demo Login* | Reviews quotation, submits negotiation counter-offers, observes automated governance, confirms deal |

---

## 📦 Master Seed Catalog & Scenario Data

- **Customer**: **Acme Corporation** (`GOLD` Tier)
- **Products**:
  - `Laptop X`: ₹80,000 (Hardware, One-time, Max Allowed Discount: 15%)
  - `Installation Service`: ₹20,000 (Service, One-time, Max Allowed Discount: 10%)
  - `Premium Support`: ₹3,000/mo (Subscription, Recurring MRR, Max Allowed Discount: 5%)
- **Warehouses**:
  - `Bangalore Central Warehouse`: 8 units available
  - `Hyderabad Logistics Hub`: 4 units available
- **Automatic Stock Split**: Ordering 10 Laptops automatically allocates **8 from Bangalore + 2 from Hyderabad** without negative inventory.

---

## ⚡ Quick Start

### 1. Prerequisites
- Node.js 18+
- npm

### 2. Backend Setup
```bash
cd backend
npm install
npm start
# Express server runs on http://localhost:5000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Vite dev server runs on http://localhost:5173
```

### 4. Run the 13-Step Automated Verification Suite
```bash
cd backend
node tests/test-flow.js
```

---

## 🏆 25-Step Judge Acceptance Checklist

1. **Admin Login**: Log in as `admin@dealflow360.com`.
2. **Catalog Inspection**: View Products (Laptop X, Installation Service, Premium Support).
3. **Discount Rules**: Review Gold Tier discount limits: Hardware 15%, Service 10%, Sub 5%.
4. **Warehouse Stock**: Check Bangalore (8 units) and Hyderabad (4 units).
5. **Sales Rep Switch**: Switch to `sales@dealflow360.com` via top bar.
6. **Create Quote**: Add 10 Laptop X (12% disc), 1 Installation Service (18% disc), 10 Premium Support (5% disc).
7. **Automated Risk Flag**: Risk engine flags **HIGH RISK (Score: 82/100)** because 18% > 10% limit.
8. **Submit Quote**: Status locks to `PENDING_APPROVAL`.
9. **Manager Login**: Switch to `manager@dealflow360.com`.
10. **Approval Inbox**: Inspect exact reason: *Service discount 18% exceeds allowed 10% by 8%*.
11. **Approve Deal**: Manager approves; status transitions to `SENT_TO_CUSTOMER`.
12. **Smart Upsell**: System suggests add-on services based on cart contents.
13. **Warehouse Split**: Inventory engine automatically assigns 8 from Bangalore + 2 from Hyderabad.
14. **Customer Login**: Switch to `customer@acme.com`.
15. **Customer Deal Room**: Review the official quotation lines and totals.
16. **Negotiate Counter-Offer**: Customer requests 20% discount on Laptops.
17. **Closed-Loop Re-Risk**: System recalculates: 20% > 15% limit ➔ flags **HIGH RISK (85/100)**.
18. **Re-Approval Queue**: Quote returns to Manager with diff comparison.
19. **Manager Concession**: Manager approves the negotiated discount.
20. **Customer Digital Signature**: Customer confirms the final quote (`CUSTOMER_CONFIRMED`).
21. **Fulfillment**: Warehouse dispatch triggers (`FULFILLED`).
22. **Hybrid Invoice**: System generates invoice splitting Capex (₹6,56,400) and Recurring MRR (₹28,500/mo).
23. **Simulated Payment**: Instant payment settlement captures transaction (`PAID`).
24. **Active Subscription**: Premium Support activated on monthly recurring billing.
25. **Deal Health Dashboard**: Shows Deal #DF360-1042 as **HEALTHY** with audit timeline.

---

## 🛡️ Engineering Guarantees
- **Single Source of Truth**: Centrally stored `quotations` & `quotation_items`.
- **Closed-Loop Governance**: Customer negotiation triggers automated risk re-evaluation.
- **Zero Negative Inventory**: Multi-warehouse allocation algorithm guarantees stock safety.
- **High-Fidelity Database Engine**: Supports real PostgreSQL with graceful in-memory relational fallback.
- **Stateless Horizontal Scalability**: Request correlation ID tracing (`x-request-id`) & Multi-tenancy (`x-tenant-id`).
- **Idempotency Keys**: Enforced on payment settlement and stock allocation (`Idempotency-Key` header).

---

## 🏛️ Production Architecture & Scalability Roadmap
Full architectural blueprint documented in [`PRODUCTION_ARCHITECTURE.md`](./PRODUCTION_ARCHITECTURE.md).

```bash
# Run the local concurrency benchmark (400+ RPS sustained)
cd backend
node tests/load-test.js

# Launch full production container stack (PostgreSQL + Redis + Backend + Frontend)
docker compose up -d
```

