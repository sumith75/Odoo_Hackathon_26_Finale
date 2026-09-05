# DealFlow360 — 5-Minute Hackathon Demo Script

---

## Prerequisites (Before the Demo)

```bash
# Reset to a clean demo state
cd backend
npm run seed:demo

# Start backend (if not running)
npm start

# Start frontend (if not running)
cd ../frontend
npm run dev
```

Open: **http://localhost:5173**

---

## Demo Flow

---

### 00:00 — Problem Statement (30 seconds)

> *"In B2B enterprise sales, deals break down when pricing, approvals, negotiation, inventory, and billing are disconnected. A sales rep gives an unauthorized discount. No one catches it. A customer negotiates. The system has no memory. Inventory is promised to two orders. Nobody knows until it's too late."*
>
> *"DealFlow360 connects the entire deal lifecycle — from governed quotation to fulfillment and payment — in one auditable system."*

---

### 00:30 — Admin Configuration (30 seconds)

**Login as Admin**: `admin@techworld.com` / `Admin@123`

Show the judge:
1. **Organization** → TechWorld Solutions setup
2. **Product Catalog** → Laptop X (₹80,000), Installation Service (₹20,000), Premium Support (₹3,000/mo)
3. **Discount Rules** → Gold Tier: Hardware max 15%, Service max 10%, Subscription max 5%
4. **Approval Rules** → Risk score > 60 requires manager approval
5. **Warehouses** → Bangalore Fulfillment Center (8 units), Hyderabad Central Logistics (4 units)

> *"Every rule you see is configurable by the admin — no hardcoded business logic."*

---

### 01:00 — Sales Rep Quote Creation (45 seconds)

**Switch to Sales Rep**: `rahul@techworld.com` / `Rahul@123`

1. Click **Create New Quote** → Select **Acme Corporation (GOLD Tier)**
2. Add products:
   - **10 × Laptop X** (Hardware) — apply 18% discount
   - **1 × Installation Service** — apply 18% discount
   - **1 × Premium Support** (Subscription)
3. **Show the live margin meter** — updates in real time as discounts are applied
4. Point out the risk meter climbing: **"18% exceeds the 10% service ceiling — risk score hits HIGH"**
5. Click **Submit for Approval** → status locks to `Pending Approval`

> *"The risk engine caught the policy violation instantly, server-side, before the quote reached the customer."*

---

### 01:45 — Manager Approval (30 seconds)

**Switch to Manager**: `arjun@techworld.com` / `Arjun@123`

1. Open **Approval Inbox** → see the pending quote
2. Click the quote → show the risk breakdown:
   - Risk Score: HIGH (82+/100)
   - Reason: *"Service discount 18% exceeds allowed ceiling of 10%"*
   - Customer: Acme Corporation (GOLD)
   - Total Deal Value: ₹7.9L+
3. Click **Approve Deal**

> *"The manager sees exactly why approval was required, with margin and risk data, not just a number."*

**Switch back to Sales Rep** → Click **Send to Customer Deal Room**

---

### 02:15 — Customer Deal Room (30 seconds)

**Login as Customer**: `customer@acme.com` / `Customer@123`

1. Show the **Customer Deal Room** — itemized quote with pricing
2. Point out what is **NOT shown**: no internal cost price, no margin %, no risk score, no approval rules
3. Show the **deal timeline** at the bottom — events visible to the customer
4. Click **Propose Counter-Offer**

> *"The customer sees a professional, clean deal room — not an internal ERP screen."*

---

### 02:45 — Customer Negotiation & Automatic Re-Evaluation (45 seconds)

In the counter-offer dialog:
1. Request: *"Requesting an additional 5% discount on the Installation Service"*
2. Click **Submit Counter-Offer**

Watch the system respond:
- Quote transitions to `NEGOTIATION`
- Risk engine re-evaluates the new discount combination
- Quote re-routes to Manager approval queue automatically

**Switch back to Manager** → Show the negotiation entry in the approval inbox → **Approve**

> *"The closed-loop works: customer negotiates → system re-evaluates risk → manager re-approves → no human coordination needed."*

---

### 03:30 — Customer Order Confirmation (15 seconds)

**As Customer** → Click **Confirm & Accept Order**

- Status transitions to `Customer Confirmed`
- Show the confirmation timestamp on the deal timeline

---

### 03:45 — Multi-Warehouse Inventory Allocation (30 seconds)

**Login as Finance/Ops**: `priya@techworld.com` / `Priya@123`

1. Open **Fulfillment Hub** → find the confirmed order
2. Click **Auto-Allocate Inventory**

Show the split:
- **Bangalore Fulfillment Center**: 8 units allocated
- **Hyderabad Central Logistics**: 2 units allocated
- Stock levels updated — no negative inventory

3. Click **Execute Fulfillment** → status becomes `Fulfilled`

> *"The system intelligently splits the order across warehouses based on available stock. Zero overselling — guaranteed atomically."*

---

### 04:15 — Hybrid Billing & Payment Settlement (30 seconds)

In Finance Hub:
1. Click **Generate Invoice**
2. Show the hybrid invoice:
   - **One-Time Invoice** (Hardware + Service): ₹~7.9L
   - **Subscription activated**: Premium Support at ₹3,000/mo recurring
3. Go to **Payments & Settlement** (or click **Record Payment** on invoice):
   - Choose payment method: `UPI`, `CARD`, `BANK_TRANSFER`, or `CASH`
   - Click quick action: **"Full Balance"** (or **"50% Partial"** to demonstrate sequential settlement)
   - Click **Record Payment** → status clears to `PAID`, `amountDue` becomes ₹0
4. Switch to **Customer Deal Room**:
   - Refresh or view **Invoices & Settlement Ledger** card
   - Customer sees invoice status `PAID` with transaction reference and payment date
5. *(Optional Polish)*: Click **Refund ₹5,000** in Finance Portal → show payment updated to `PARTIALLY_REFUNDED` and invoice balance reopened to `PARTIALLY_PAID`!

> *"One deal, two billing types — hardware paid upfront, support billed monthly. Full payment recording, idempotency, and refund adjustments built right into the platform."*

---

### 04:45 — Deal Health & Audit Trail (15 seconds)

1. Open **Deal Health Dashboard** → show score **HEALTHY**
2. Open **Audit Activity Center** → show the full chronological timeline:
   - Quote submitted
   - Manager approved
   - Sent to customer
   - Customer negotiated
   - Re-approved
   - Customer confirmed
   - Inventory allocated
   - Fulfilled
   - Payment recorded

> *"Every action, every actor, every timestamp — immutable. This is the audit trail that compliance teams require."*

---

---

### 05:00 — Sales Performance Reports & Document Generation (30 seconds)

1. Open **Reports** in Manager or Admin navigation:
   - Filter by **Period**: `This Month` / `This Week` / `Custom Date Range`
   - Filter by **Sales Rep**: Rahul Sharma
   - Filter by **Approval Status**: `APPROVED`
   - Filter by **Product Category**: `HARDWARE`
   - Review live aggregated KPIs: Win Rate %, Total Quoted vs Won Value, Total Discounts, Collection Ratio.
2. Click **Export PDF Report** → instantaneous download of high-fidelity executive briefing PDF with dark header, KPI summary grid, and rep breakdowns.
3. Click **Export Excel (XLSX)** → multi-sheet spreadsheet workbook (Executive Summary, Sales Performance, Governance & Approvals, Product Analytics, Invoices & Settlement).
4. Go to **Finance Invoices** or **Customer Deal Room**:
   - Click **Download Invoice PDF**
   - Customer receives clean, authoritative B2B Tax Invoice PDF with itemized line breakdown (Capex vs Recurring SLA), taxes, and official transaction ledger.

> *"Real reporting with applied filters, real PDF exports via PDFKit, real XLSX workbooks via ExcelJS, and customer-safe B2B tax invoices — all backed authoritatively by PostgreSQL."*

---

### 05:30 — Closing (10 seconds)

> *"DealFlow360 connects Configure → Quote → Risk → Approve → Negotiate → Re-Approve → Confirm → Fulfill → Bill → Pay → Report & Export → Monitor → Audit — all in one governed, multi-tenant, production-grade system."*

---

## Key Talking Points for Judges

| What to Highlight | Where to Show It |
|---|---|
| **Configurable governance** (not hardcoded rules) | Admin → Discount Rules, Approval Rules |
| **Server-side risk engine** (can't be bypassed) | Quote builder — try changing discount, watch score |
| **Atomic concurrency** (zero overselling) | Warehouse allocation |
| **Customer isolation** (no internal data leaked) | Customer Deal Room |
| **Idempotent payments** (zero double billing) | Payment service — submit twice, same result |
| **Authoritative Reports & Exports** (PDF & XLS) | Reports Dashboard (`/manager/reports`, `/admin/reports`) |
| **B2B Tax Invoice PDF Generation** | Customer Deal Room & Finance Invoices (`GET /api/invoices/:id/pdf`) |
| **Immutable audit trail** | Audit Activity Center |
| **Full deal health** | Deal Health Dashboard |
| **Security hardening** | Module 12 test suite: `npm run test:security` |
| **Reporting test suite** | Module 15 test suite: `npm run test:reports` |

