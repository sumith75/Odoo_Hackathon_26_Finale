# DealFlow360 — Architecture Reference

---

## System Architecture Diagram

```
                    ┌──────────────────────────────────────────────┐
                    │           Browser (User Agent)               │
                    └───────────────────┬──────────────────────────┘
                                        │ HTTPS
                    ┌───────────────────▼──────────────────────────┐
                    │         React + Vite SPA (Frontend)          │
                    │                                              │
                    │  ┌───────────┐  ┌──────────┐  ┌──────────┐  │
                    │  │   Admin   │  │  Sales   │  │ Manager  │  │
                    │  │  Portal   │  │  Studio  │  │ Approval │  │
                    │  └───────────┘  └──────────┘  └──────────┘  │
                    │  ┌───────────┐  ┌──────────┐                │
                    │  │ Customer  │  │ Finance  │                 │
                    │  │ Deal Room │  │  / Ops   │                 │
                    │  └───────────┘  └──────────┘                │
                    └───────────────────┬──────────────────────────┘
                                        │ REST /api/* (relative URL, Vite proxy in dev)
                    ┌───────────────────▼──────────────────────────┐
                    │         Node.js + Express API Server         │
                    │                                              │
                    │  ┌─────────────────────────────────────────┐ │
                    │  │  Middleware Stack                        │ │
                    │  │  Auth (JWT) · RBAC · Multi-Tenant        │ │
                    │  │  Rate Limiting · Request Correlation     │ │
                    │  │  Idempotency · Security Headers          │ │
                    │  └─────────────────────────────────────────┘ │
                    │                                              │
                    │  ┌──────────────┐   ┌──────────────────────┐ │
                    │  │  Risk Engine │   │  Approval Service    │ │
                    │  │  (0-100 score│   │  (Multi-level chains)│ │
                    │  │  server-side)│   │                      │ │
                    │  └──────────────┘   └──────────────────────┘ │
                    │                                              │
                    │  ┌──────────────┐   ┌──────────────────────┐ │
                    │  │  Inventory   │   │  Billing Service     │ │
                    │  │  Allocation  │   │  (One-time +         │ │
                    │  │  (Atomic CAS)│   │   Recurring)         │ │
                    │  └──────────────┘   └──────────────────────┘ │
                    │                                              │
                    │  ┌──────────────┐   ┌──────────────────────┐ │
                    │  │  Deal Health │   │  Notification &      │ │
                    │  │  Telemetry   │   │  Audit Trail         │ │
                    │  └──────────────┘   └──────────────────────┘ │
                    └───────┬──────────────────────────┬────────────┘
                            │                          │
               ┌────────────▼──────────┐   ┌──────────▼────────────┐
               │    PostgreSQL          │   │    Redis              │
               │    (Neon / Local)      │   │    (ioredis)          │
               │                        │   │                       │
               │  ✓ Quotations          │   │  ✓ Session Cache      │
               │  ✓ Customers           │   │  ✓ Rate Limiting      │
               │  ✓ Products            │   │  ✓ Idempotency Keys   │
               │  ✓ Approval Rules      │   │  ✓ Job Coordination   │
               │  ✓ Discount Rules      │   │                       │
               │  ✓ Warehouses          │   │  ⚠️  Falls back to    │
               │  ✓ Inventory           │   │     in-memory if      │
               │  ✓ Invoices            │   │     unavailable       │
               │  ✓ Payments            │   └───────────────────────┘
               │  ✓ Subscriptions       │
               │  ✓ Notifications       │
               │  ✓ Audit Logs          │
               │                        │
               │  SOURCE OF TRUTH       │
               └────────────────────────┘
```

---

## Business Lifecycle Flow Diagram

```
┌──────────────────────────────────────────────────────┐
│                   ADMIN CONFIGURATION                │
│  Products · Tiers · Discount Rules · Approval Rules  │
│              Warehouses · Inventory                  │
└────────────────────────┬─────────────────────────────┘
                         │
                         ▼
              ┌───────────────────────┐
              │   SALES REP QUOTE     │
              │  Select Customer      │
              │  Add Products         │
              │  Apply Discounts      │
              └──────────┬────────────┘
                         │
                         ▼
              ┌───────────────────────┐
              │   RISK ENGINE         │◄──── Server-side evaluation
              │  Score: 0–100         │      Margin · Discount Ceiling
              │  Approval Required?   │      Customer Tier
              └──────────┬────────────┘
                         │
               ┌─────────┴──────────┐
               │                    │
        Score Low                Score High
        (No Approval)          (Approval Required)
               │                    │
               │          ┌─────────▼────────────┐
               │          │  MANAGER APPROVAL     │
               │          │  Review Risk Reasons  │
               │          │  Approve / Reject      │
               │          └─────────┬────────────┘
               │                    │
               └─────────┬──────────┘
                         │ APPROVED
                         ▼
              ┌───────────────────────┐
              │  CUSTOMER DEAL ROOM   │
              │  (Isolated Portal)    │
              │  No internal data     │
              └──────────┬────────────┘
                         │
               ┌─────────┴──────────┐
               │                    │
        ACCEPT TERMS         NEGOTIATE
               │                    │
               │          ┌─────────▼────────────┐
               │          │  COUNTER-OFFER        │
               │          │  Customer submits     │
               │          │  discount request     │
               │          └─────────┬────────────┘
               │                    │
               │          ┌─────────▼────────────┐
               │          │  RISK RE-EVALUATION   │
               │          │  New discount scored  │
               │          │  Re-routes approval   │
               │          └─────────┬────────────┘
               │                    │
               │          ┌─────────▼────────────┐
               │          │  MANAGER RE-APPROVAL  │
               │          │  Reviews negotiation  │
               │          └─────────┬────────────┘
               │                    │ APPROVED
               └─────────┬──────────┘
                         │
                         ▼
              ┌───────────────────────┐
              │  CUSTOMER CONFIRMS    │
              │  Digital Acceptance   │
              │  (Atomic CAS)         │
              └──────────┬────────────┘
                         │
                         ▼
              ┌───────────────────────┐
              │  WAREHOUSE ALLOCATION │
              │  Auto-split across    │
              │  multiple warehouses  │
              │  (Zero overselling)   │
              └──────────┬────────────┘
                         │
                         ▼
              ┌───────────────────────┐
              │  FULFILLMENT          │
              │  Dispatch & tracking  │
              └──────────┬────────────┘
                         │
                         ▼
              ┌───────────────────────┐
              │  HYBRID BILLING       │
              ├───────────┬───────────┤
              │ ONE-TIME  │ RECURRING │
              │ Invoice   │ Subscription│
              │ (Hardware/│ (SaaS/    │
              │  Service) │  Support) │
              └──────────┬────────────┘
                         │
                         ▼
              ┌───────────────────────┐
              │  PAYMENT RECORDED     │
              │  (Idempotent)         │
              └──────────┬────────────┘
                         │
                         ▼
              ┌───────────────────────┐
              │  DEAL HEALTH          │
              │  Score: 0–100         │
              │  Status: HEALTHY /    │
              │  AT_RISK / CRITICAL   │
              └──────────┬────────────┘
                         │
                         ▼
              ┌───────────────────────┐
              │  AUDIT + NOTIFICATIONS│
              │  Every event logged   │
              │  Sensitive data masked│
              │  Immutable trail      │
              └───────────────────────┘
```

---

## Module Map

| Module | Backend Path | Key Service |
|---|---|---|
| Auth & RBAC | `src/modules/auth/` | JWT, bcrypt, role middleware |
| Organization | `src/modules/organization/` | Multi-tenant config |
| Team Management | `src/modules/team/` | User CRUD per tenant |
| Product Catalog | `src/modules/products/` | Product CRUD + costPrice protection |
| Discount Rules | `src/modules/discountRules/` | Per-tier, per-type ceilings |
| Approval Rules | `src/modules/approvalRules/` | Threshold-based chains |
| Quotations / CPQ | `src/modules/quotations/` | Quote state machine + pricing engine |
| Risk Engine | `src/services/riskEngine.js` | Score 0–100, server-side |
| Approval Engine | `src/services/approvalService.js` | Multi-level approval + self-approval block |
| Customer Deal Room | `src/modules/customerDealRoom/` | Isolated portal + negotiation |
| Finance / Ops | `src/modules/finance/` | Fulfillment + invoicing |
| Inventory Allocation | `src/services/inventoryAllocationService.js` | Atomic multi-warehouse |
| Billing | `src/services/billingService.js` | One-time + recurring |
| Payment | `src/services/paymentService.js` | Idempotent by txn reference |
| Deal Health | `src/services/dealHealthService.js` | Telemetry score + signals |
| Notifications | `src/modules/notifications/` | Per-user + per-customer |
| Audit Trail | `src/modules/audit/` | Immutable log + redaction |
| Admin Dashboard | `src/modules/adminDashboard/` | Org-wide metrics |
| Sales Dashboard | `src/modules/salesDashboard/` | Rep performance |
| Manager Dashboard | `src/modules/manager/` | Approval queue + team health |
