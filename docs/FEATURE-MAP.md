# DealFlow360 — Feature Requirement Map

Maps each hackathon requirement to the specific implementation in DealFlow360.

---

## Core Business Requirements

### Configurable Discount Governance

| Requirement | Implementation |
|---|---|
| Configurable discount ceilings per customer tier | Admin → Discount Rules (`/api/discount-rules`) |
| Per-product-type discount limits (hardware / service / subscription) | `DiscountRule` model: `hardwareMaxPct`, `serviceMaxPct`, `subscriptionMaxPct` |
| Enforced server-side (cannot be bypassed by frontend) | `discountRiskService.js` evaluates on every quote save |
| Admin can add / modify / delete rules | Full CRUD in `discountRuleRoutes.js` |

---

### Risk Engine

| Requirement | Implementation |
|---|---|
| Blended risk score (0–100) | `riskEngine.js` — composite score from discount ceiling violations, margin, deal size |
| Server-side evaluation (cannot be manipulated by client) | Risk computed in backend service before response |
| Risk re-evaluated on negotiation | `customerRoutes.js` calls risk engine on every counter-offer |
| Approval required when risk exceeds threshold | Configurable `ApprovalRule` thresholds in database |

---

### Approval Workflow

| Requirement | Implementation |
|---|---|
| Configurable multi-level approval chains | `ApprovalRule` model with `riskScoreThreshold` and `approverRole` |
| Automatic approval routing based on risk | `approvalService.js` determines required approver level |
| Manager cannot self-approve own quotes | `SELF_APPROVAL_FORBIDDEN` check in approval service |
| Full approval history per quote | `QuoteApproval` records linked to quotation |
| Approval detail shows risk reasons | `approvalService.js` returns `riskReasons[]` array |

---

### Customer Deal Room

| Requirement | Implementation |
|---|---|
| Isolated customer portal — no internal data | `/api/customer/*` routes strip costPrice, margin, risk score, approval rules |
| Customer can only see their own deals | `customerId` scoping on every query |
| Secure access | JWT auth with `CUSTOMER` role enforcement |
| Customer-readable deal timeline | Timeline built from public audit events |
| Itemized pricing with discounts | Line items from `QuotationItem` with discount amounts |

---

### Customer Negotiation

| Requirement | Implementation |
|---|---|
| Customer can submit counter-offer | `POST /api/customer/quotes/:id/negotiate` |
| Negotiation triggers risk re-evaluation | `discountRiskService.js` called on negotiation submission |
| Re-evaluation routes to approval queue | `approvalService.js` called; status set to `NEGOTIATION` |
| Manager sees negotiation history in approval detail | `NegotiationProposal` records included in approval response |
| Closed-loop: re-approval required if risk still high | State machine enforces `NEGOTIATION → PENDING_APPROVAL → APPROVED` |

---

### Multi-Warehouse Inventory Allocation

| Requirement | Implementation |
|---|---|
| Multiple warehouses per tenant | `Warehouse` + `Inventory` models; Admin warehouse management |
| Automatic allocation across warehouses | `inventoryAllocationService.js` — priority-based greedy allocation |
| Zero negative inventory guaranteed | Atomic `updateMany` with floor check + `409 INSUFFICIENT_INVENTORY` |
| Split allocation tracking | `WarehouseAllocation` records per quotation |
| Allocation visible to Finance/Ops | Finance dashboard shows warehouse split detail |

---

### Hybrid Billing

| Requirement | Implementation |
|---|---|
| One-time invoice for hardware/services | `billingService.js → generateOneTimeInvoice()` |
| Recurring subscription activation | `billingService.js → generateRecurringInvoice()` |
| Both triggered from same fulfilled quote | Finance route calls both billing functions on fulfillment |
| Invoice idempotency (no duplicates) | `billingService.js` checks existing invoice by `quotationId` |
| ARR / MRR calculation | `salesDashboardRoutes.js` aggregates from active subscription invoices |

---

### Payment Processing & Settlement Ledger (Module 14)

| Requirement | Implementation |
|---|---|
| Extensible payment gateway abstraction | `PaymentProvider.js` base class + `SimulatedPaymentProvider.js` |
| Multiple payment methods | `SIMULATED`, `CARD`, `BANK_TRANSFER`, `UPI`, `CASH` |
| Payment recording against invoice | `POST /api/invoices/:id/payments` & `paymentService.js → recordPayment()` |
| Idempotency key protection | Client-supplied `Idempotency-Key` or `transactionReference` prevents duplicate charges |
| Idempotency payload conflict detection | Reused key with differing amount or invoice returns `409 IDEMPOTENCY_CONFLICT` |
| Partial payment & sequential settlement | Invoice transitions `ISSUED → PARTIALLY_PAID → PAID` as payments accrue |
| Overpayment defense | Payments exceeding `amountDue` rejected with `400 PAYMENT_EXCEEDS_DUE` |
| Simulated gateway decline handling | Deterministic decline simulation returns `402 PAYMENT_FAILED` with zero invoice mutation |
| Refund processing & balance restoration | `POST /api/payments/:id/refund` restores `amountPaid` and `amountDue` on invoice |
| Quotation billing status sync | Quotation `billingStatus` transitions `PENDING → PARTIALLY_PAID → PAID` |
| Deal health telemetry integration | Payment invalidates deal health cache; transitions deals to healthy |
| Audit trail & notifications | `PAYMENT_SUCCEEDED`, `INVOICE_PAID`, `PAYMENT_REFUNDED` logged & notified |
| Finance Portal Settlement UI | Dedicated Payments tab (`PaymentsView.jsx`), quick settlement buttons, refund controls |
| Customer Deal Room Settlement Card | Customer safe invoice & payment ledger in `CustomerDealRoom.jsx` |

---

### Deal Health

| Requirement | Implementation |
|---|---|
| Real-time deal health score | `dealHealthService.js → computeDealHealth()` |
| Health signals (PENDING_APPROVAL, PAYMENT_OVERDUE, etc.) | Signal evaluation per deal state |
| Recommended next action | `recommendedAction` field computed per signal combination |
| Health status (HEALTHY / AT_RISK / CRITICAL) | Threshold-based from composite score |
| Manager dashboard health overview | Manager dashboard shows team deal health |

---

### Audit Trail

| Requirement | Implementation |
|---|---|
| Every state transition logged | `logAudit()` called at every major event |
| Actor (userId) and timestamp recorded | `AuditLog` model has `userId`, `createdAt`, `action` |
| Sensitive data redacted | `auditLogger.js` masks `password`, `token`, `secret` → `[REDACTED]` |
| Immutable (no delete, no edit) | Audit table has no DELETE endpoint; append-only |
| Tenant-scoped | Every audit log has `tenantId` |

---

### Notifications

| Requirement | Implementation |
|---|---|
| In-app notifications | `notificationService.js` + `Notification` model |
| Per-user and per-customer notifications | Separate user and customer notification delivery |
| Mark as read / mark all as read | `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/mark-all-read` |
| Unread count | `GET /api/notifications/unread-count` |
| Notification for every major deal event | Triggered in quote routes, approval service, deal room routes |

---

## Security Requirements

| Requirement | Implementation | Test |
|---|---|---|
| Tenant isolation (cross-tenant blocked) | Every query includes `tenantId` filter | Test 1, 2 (Module 12) |
| IDOR protection (customer can't see other deals) | `customerId` + `tenantId` scoping | Test 3 |
| RBAC enforcement | `requireRole()` middleware on all internal routes | Test 4 |
| Self-approval prevention | `approvalService.js` SELF_APPROVAL_FORBIDDEN | Test 5 |
| Price manipulation defense | Server re-prices from DB catalog, ignores client values | Test 6 |
| Discount ceiling enforcement | Server-side risk engine | Test 7 |
| Concurrent confirmation safety | CAS via `updateMany` with version check | Test 8 |
| Zero overselling | Atomic inventory decrement with floor check | Tests 9, 10, 11 |
| Payment idempotency | `transactionReference` dedup before billing | Tests 12, 13 |
| Invoice idempotency | Quote-scoped invoice dedup | Tests 14, 15 |
| State machine enforcement | Status-gated service handlers | Test 16 |
| Pagination abuse prevention | `parsePaginationParams` clamps to MAX 100 | Test 17 |
| Audit secret redaction | Sensitive key masking in `logAudit` | Test 18 |
| XSS input sanitization | `sanitizeInputText` strips script tags | Test 19 |
| Redis graceful fallback | In-memory fallback if Redis unavailable | Test 20 |

---

## Admin Capabilities

| Capability | Implementation |
|---|---|
| Organization profile management | `organizationRoutes.js` |
| Team member management (CRUD + role assignment) | `teamRoutes.js` |
| Customer management | `customerRoutes.js` (internal) |
| Customer tier assignment (BRONZE/SILVER/GOLD) | `Customer.tier` field + CPQ pricing application |
| Product catalog (CRUD + costPrice) | `productRoutes.js` |
| Discount rules (CRUD) | `discountRuleRoutes.js` |
| Approval rules (CRUD) | `approvalRuleRoutes.js` |
| Warehouse management (CRUD) | `warehouseRoutes.js` |
| Admin dashboard metrics | `dashboardRoutes.js` |
| Audit activity center | `auditRoutes.js` |
