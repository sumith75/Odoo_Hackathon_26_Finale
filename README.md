# DealFlow360 — Smart B2B Deal Governance & Fulfillment Engine

> **Odoo Hackathon Finale 2026**
>
> A production-grade, multi-tenant B2B deal lifecycle engine covering everything from risk-based CPQ quotation to multi-warehouse fulfillment, hybrid billing, and customer negotiation — all governed by configurable discount rules and approval chains backed by PostgreSQL.

---

## Overview

B2B enterprise deals break down when pricing governance, approval workflows, customer negotiation, inventory allocation, and billing operate as disconnected silos. DealFlow360 connects the entire lifecycle into one coherent, auditable, real-time system.

```
Configure → Quote → Risk → Approve → Negotiate → Re-Approve → Confirm → Fulfill → Bill → Pay → Monitor → Audit
```

---

## Key Features

| Feature | Description |
|---|---|
| **Multi-Tenant RBAC** | Five isolated roles per tenant — Admin, Sales Rep, Manager, Finance/Ops, Customer |
| **CPQ Studio** | Visual quote builder with live margin meter, real-time pricing, and product catalog |
| **Configurable Discount Governance** | Per-tier, per-product-type discount ceilings configured by Admin |
| **Risk Engine** | Server-side deal risk scoring (0–100) triggered on every quote action |
| **Multi-Level Approval Chain** | Configurable approval rules; escalates automatically when risk thresholds exceeded |
| **Customer Deal Room** | Isolated customer portal — customers see only their own deals, never internal data |
| **Customer Negotiation** | Customers submit counter-offers; system re-evaluates risk and re-routes for approval |
| **Multi-Warehouse Allocation** | Atomic inventory allocation across warehouses; zero negative stock guaranteed |
| **Order Fulfillment** | Warehouse dispatch tracking with partial fulfillment support |
| **Hybrid Billing** | One-time invoices (hardware/services) + recurring subscription billing in one deal |
| **Payment & Settlement** | Extensible simulated gateway, idempotent multi-method settlement (Card, UPI, Bank Transfer, Cash), partial payments, full/partial refunds, and Customer Deal Room ledger |
| **Deal Health Telemetry** | Real-time deal health score (0–100) with recommended actions |
| **Notification Center** | In-app notifications for every deal event, per user and per customer |
| **Immutable Audit Trail** | Every state transition logged with actor, timestamp, and redacted metadata |
| **Security Hardening** | Tenant isolation, IDOR protection, RBAC enforcement, XSS sanitization, CAS concurrency |

---

## Architecture

```
┌─────────────────────────────────────────┐
│         React + Vite Frontend           │
│   (SPA: Admin / Sales / Manager /       │
│    Finance / Customer Deal Room)        │
└──────────────────┬──────────────────────┘
                   │ HTTP / REST (/api/*)
                   ▼
┌─────────────────────────────────────────┐
│        Node.js / Express API            │
│   ┌─────────────────────────────────┐   │
│   │   Auth · RBAC · Multi-Tenant    │   │
│   │   Middleware · Rate Limiting    │   │
│   └─────────────────────────────────┘   │
│   ┌──────────┐  ┌──────────────────┐   │
│   │  Risk    │  │  Approval Chain  │   │
│   │  Engine  │  │  Service         │   │
│   └──────────┘  └──────────────────┘   │
│   ┌──────────┐  ┌──────────────────┐   │
│   │ Billing  │  │  Inventory &     │   │
│   │ Service  │  │  Fulfillment     │   │
│   └──────────┘  └──────────────────┘   │
│   ┌──────────┐  ┌──────────────────┐   │
│   │  Deal    │  │  Notifications   │   │
│   │  Health  │  │  & Audit Trail   │   │
│   └──────────┘  └──────────────────┘   │
└──────┬──────────────────┬───────────────┘
       │                  │
       ▼                  ▼
┌────────────┐    ┌───────────────┐
│ PostgreSQL │    │ Redis         │
│ (Neon/PG)  │    │ (Cache /      │
│            │    │  Rate Limit / │
│ SOURCE OF  │    │  Idempotency) │
│   TRUTH    │    └───────────────┘
└────────────┘
```

**PostgreSQL is the authoritative source of truth** for all business data. Redis provides caching, distributed rate limiting, and idempotency with automatic in-memory fallback if unavailable.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + React Router 7 + Tailwind CSS + Lucide Icons |
| Build | Vite 8 |
| Backend | Node.js + Express 5 |
| ORM | Prisma 7 with PostgreSQL adapter |
| Database | PostgreSQL 16 (Neon cloud or local) |
| Cache / Coordination | Redis 7 (ioredis) with in-memory fallback |
| Document Generation | PDFKit (Tax Invoices & Executive Reports) + ExcelJS (Spreadsheets) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Containerization | Docker + Docker Compose |

---

## Five Roles

| Role | Email (Demo) | Password | Responsibilities |
|---|---|---|---|
| **Admin** | `admin@techworld.com` | `Admin@123` | Org setup, product catalog, discount rules, approval rules, warehouses, audit |
| **Sales Rep** | `rahul@techworld.com` | `Rahul@123` | Create quotes, CPQ pricing, submit for approval, send to customer |
| **Sales Manager** | `arjun@techworld.com` | `Arjun@123` | Review approval inbox, inspect risk scores, approve/reject, negotiate re-approval |
| **Finance / Ops** | `priya@techworld.com` | `Priya@123` | Warehouse allocation, fulfillment, invoice generation, payment recording |
| **Customer** | `customer@acme.com` | `Customer@123` | View deal room, submit counter-offers, confirm order |

> ⚠️ **These are demo credentials only.** Never use in production.

Alternative credentials also work:
- `sales@techworld.com` / `Sales@123`
- `manager@techworld.com` / `Manager@123`
- `finance@techworld.com` / `Finance@123`

---

## Demo Data Story

| Entity | Details |
|---|---|
| **Organization** | TechWorld Solutions |
| **Customer** | Acme Corporation (GOLD Tier) |
| **Products** | Laptop X (₹80,000 hardware), Installation Service (₹20,000 service), Premium Support (₹3,000/mo subscription) |
| **Warehouses** | Bangalore Fulfillment Center (8 Laptop X), Hyderabad Central Logistics (4 Laptop X) |
| **Scenario** | 10 Laptop X order → auto-splits 8 from Bangalore + 2 from Hyderabad |
| **Risk Trigger** | 18% service discount exceeds 10% ceiling → HIGH RISK → Manager Approval |
| **Negotiation** | Customer requests deeper discount → re-evaluation → re-approval loop |

---

## Local Setup

### Prerequisites
- **Node.js 18+**
- **npm**
- **PostgreSQL** (local or cloud — see Neon.tech for free hosted PostgreSQL)
- **Redis** (optional — application falls back to in-memory coordination if unavailable)

### 1. Clone & Install

```bash
git clone <repo-url>
cd Odoo_Hackathon_26_Finale

# Install all dependencies
npm run install:all
# OR manually:
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
# Edit .env and set your DATABASE_URL and JWT_SECRET
```

Required variables:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://username:password@localhost:5432/dealflow360
JWT_SECRET=your-minimum-32-character-secret-key
CLIENT_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379   # optional — in-memory fallback if unavailable
```

### 3. Apply Database Schema

```bash
cd backend
npx prisma db push
```

### 4. Seed Demo Data

```bash
cd backend
npm run seed:demo
```

### 5. Start Backend

```bash
cd backend
npm start        # production
# OR
npm run dev      # development with hot-reload (node --watch)
```

Backend runs on: **http://localhost:5000**

### 6. Start Frontend

```bash
cd frontend
npm run dev
```

Frontend runs on: **http://localhost:5173**

### 7. Verify Everything Works

```bash
cd backend
npm run test:payment   # 39 payment & billing integration tests
npm run test:e2e       # 14-step end-to-end deal lifecycle
npm run test:security  # 20 security & concurrency tests
npm run test:all       # Run all verification suites
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default: 5000) | HTTP server port |
| `NODE_ENV` | No (default: development) | `development` or `production` |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | JWT signing secret (min 32 chars in production) |
| `CLIENT_URL` | No | Allowed CORS origin for frontend (default: all) |
| `REDIS_URL` | No | Redis connection URL (falls back to in-memory) |
| `LOG_FORMAT` | No | `text` (default) or `json` (for log aggregators) |

---

## Testing

```bash
cd backend

# Individual suites
npm run test                   # Foundation & schema verification
npm run test:payment           # Payment & billing integration (39 tests)
npm run test:health            # Deal health engine (15 tests)
npm run test:notifications     # Notifications & audit (5 tests)
npm run test:e2e               # Full 14-step E2E deal lifecycle
npm run test:security          # 20 security & concurrency hardening tests
npm run test:payment           # 39 dedicated payment & billing integration tests
npm run test:reports           # 34 reporting, PDF/XLS export & tax invoice tests

# Run everything
npm run test:all
```

---

## Docker Deployment

```bash
# 1. Configure environment (backend/.env must exist)
cp backend/.env.example backend/.env
# Edit backend/.env with your DATABASE_URL and JWT_SECRET

# 2. Start full stack
docker compose up -d

# 3. Apply schema & seed (first run only)
docker compose exec backend npx prisma db push
docker compose exec backend npm run seed:demo

# 4. Access
# Frontend: http://localhost
# Backend API: http://localhost:5000/api
# Health: http://localhost/health
```

### Services
| Service | Port | Description |
|---|---|---|
| `frontend` | 80 | React SPA + nginx (proxies /api to backend) |
| `backend` | 5000 | Node.js/Express API |
| `postgres` | 5432 | PostgreSQL 16 |
| `redis` | 6379 | Redis 7 |

---

## Core Business Workflow

```
Admin configures:
  → Customer tiers (BRONZE / SILVER / GOLD)
  → Discount ceilings (per tier, per product type)
  → Approval rules (risk score thresholds)
  → Product catalog (hardware / service / subscription)
  → Warehouses & inventory

Sales Rep creates quote:
  → Select customer + products + quantities
  → Apply discounts
  → Risk engine evaluates automatically (0–100 score)
  → If approval required → submit for manager review

Manager approves/rejects:
  → Sees risk score, discount amounts, margin impact
  → Approve → quote sent to Customer Deal Room

Customer receives quote:
  → Reviews itemized pricing (no internal cost/margin shown)
  → Can submit counter-offer (negotiation)
  → Negotiation triggers risk re-evaluation → re-approval loop
  → Customer confirms accepted terms → digital confirmation

Finance/Ops executes:
  → Auto-allocates inventory across warehouses (atomic, zero overselling)
  → Executes fulfillment
  → Generates hybrid invoice (one-time + recurring)
  → Records payment (idempotent)

System monitors:
  → Deal Health telemetry updates continuously
  → Notifications sent at every state transition
  → Immutable audit trail records every actor + action
```

---

## Security Guarantees

- **Tenant Isolation**: Every query scoped to `tenantId`. Cross-tenant access is impossible.
- **IDOR Protection**: Customers can only access their own quotations.
- **Atomic Concurrency**: Inventory allocation uses atomic decrements. Customer confirmation uses Compare-And-Swap (CAS). Zero race conditions.
- **Payment Idempotency**: Duplicate payment references return existing payment without double-billing.
- **Input Sanitization**: XSS payloads in customer comments are stripped server-side.
- **Audit Redaction**: Sensitive fields (`password`, `token`, `secret`) are masked to `[REDACTED]` in audit logs.
- **Pagination Clamping**: Query limits capped at 100 to prevent memory exhaustion.

---

## API Documentation

See [`docs/API.md`](./docs/API.md) for endpoint reference.

## Architecture Diagrams

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for system and flow diagrams.

## Demo Script

See [`docs/DEMO.md`](./docs/DEMO.md) for the 5-minute hackathon presentation flow.

## Feature Map

See [`docs/FEATURE-MAP.md`](./docs/FEATURE-MAP.md) for requirement-to-implementation mapping.

---

## Future Work

- Real email/SMS notification delivery (currently in-app only)
- Real payment gateway integration (Razorpay / Stripe)
- ML-based risk prediction and deal scoring
- Automated customer tier progression based on deal history
- CRM / ERP integration (Salesforce, SAP)
- Advanced demand forecasting for inventory management
- Multi-region database deployment (Neon branching)
- Advanced PDF quote generation with digital signatures

---

## Production Architecture

See [`PRODUCTION_ARCHITECTURE.md`](./PRODUCTION_ARCHITECTURE.md) for the full deployment blueprint.
