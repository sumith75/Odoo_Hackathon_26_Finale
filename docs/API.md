# DealFlow360 — API Reference

This document covers major API endpoints by module. All endpoints require a valid JWT Bearer token unless noted.

Base URL (development): `http://localhost:5000`

---

## Authentication

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/api/auth/login` | Login — returns JWT token | Public |
| `POST` | `/api/auth/register-organization` | Register new tenant + admin | Public |
| `POST` | `/api/auth/register-customer` | Register customer account | Public |
| `GET` | `/api/auth/me` | Get current user profile | JWT |
| `POST` | `/api/auth/logout` | Invalidate session | JWT |

**Login example:**
```json
POST /api/auth/login
{
  "email": "admin@techworld.com",
  "password": "Admin@123"
}
```

---

## Health & Readiness

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `GET` | `/health` | Liveness probe — app is running | Public |
| `GET` | `/ready` | Readiness probe — DB + cache connected | Public |
| `GET` | `/api/health` | Same as /health (API prefix alias) | Public |
| `GET` | `/api/ready` | Same as /ready (API prefix alias) | Public |

---

## Organization & Admin

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/organization` | Get organization profile | Admin |
| `PUT` | `/api/organization` | Update organization profile | Admin |
| `GET` | `/api/team` | List team members | Admin |
| `POST` | `/api/team` | Create team member | Admin |
| `PUT` | `/api/team/:id` | Update team member | Admin |
| `DELETE` | `/api/team/:id` | Deactivate team member | Admin |
| `GET` | `/api/admin/dashboard` | Admin metrics overview | Admin |

---

## Customers

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/customers` | List customers | Internal staff |
| `POST` | `/api/customers` | Create customer | Admin / Sales Rep |
| `GET` | `/api/customers/:id` | Get customer detail | Internal staff |
| `PUT` | `/api/customers/:id` | Update customer | Admin / Sales Rep |

---

## Product Catalog

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/products` | List products | Internal staff |
| `POST` | `/api/products` | Create product | Admin |
| `GET` | `/api/products/:id` | Get product | Internal staff |
| `PUT` | `/api/products/:id` | Update product | Admin |
| `DELETE` | `/api/products/:id` | Delete product | Admin |

> `costPrice` is only included in responses for internal roles; stripped for customers.

---

## Discount Rules

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/discount-rules` | List discount rules | Admin |
| `POST` | `/api/discount-rules` | Create rule | Admin |
| `PUT` | `/api/discount-rules/:id` | Update rule | Admin |
| `DELETE` | `/api/discount-rules/:id` | Delete rule | Admin |

---

## Approval Rules

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/approval-rules` | List approval rules | Admin |
| `POST` | `/api/approval-rules` | Create rule | Admin |
| `PUT` | `/api/approval-rules/:id` | Update rule | Admin |
| `DELETE` | `/api/approval-rules/:id` | Delete rule | Admin |

---

## Quotations / CPQ

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/quotations` | List quotes | Internal staff |
| `POST` | `/api/quotations` | Create quote | Sales Rep |
| `GET` | `/api/quotations/:id` | Get quote detail | Internal staff |
| `PUT` | `/api/quotations/:id` | Update quote (DRAFT only) | Sales Rep |
| `DELETE` | `/api/quotations/:id` | Delete quote (DRAFT only) | Sales Rep |
| `POST` | `/api/quotations/:id/submit` | Submit for approval | Sales Rep |
| `POST` | `/api/quotations/:id/send` | Send to customer deal room | Sales Rep |
| `GET` | `/api/quotations/:id/risk` | Get risk evaluation | Internal staff |
| `GET` | `/api/quotations/:id/health` | Get deal health | Internal staff |
| `GET` | `/api/sales/dashboard` | Sales rep metrics | Sales Rep / Manager |

---

## Manager Approval

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/manager/pending` | List pending approvals | Manager |
| `GET` | `/api/manager/approvals` | Full approval history | Manager |
| `POST` | `/api/manager/approve` | Approve or reject quote | Manager |
| `GET` | `/api/manager/dashboard` | Manager dashboard metrics | Manager |
| `GET` | `/api/manager/team-deals` | Team deal pipeline | Manager |

**Approve example:**
```json
POST /api/manager/approve
{
  "quotationId": "quo-xxx",
  "action": "APPROVE",
  "reason": "Discount within acceptable range for this customer"
}
```

---

## Customer Deal Room

All `/api/customer/*` routes require `CUSTOMER` role JWT.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/customer/dashboard` | Customer dashboard summary |
| `GET` | `/api/customer/quotes` | List customer's quotes |
| `GET` | `/api/customer/quotes/:id` | Get quote (customer-safe view) |
| `POST` | `/api/customer/quotes/:id/confirm` | Confirm and accept quote |
| `POST` | `/api/customer/quotes/:id/negotiate` | Submit counter-offer |
| `GET` | `/api/customer/quotes/:id/comments` | Get deal comments |
| `POST` | `/api/customer/quotes/:id/comments` | Add comment |
| `POST` | `/api/customer/quotes/:id/delivery-request` | Request delivery date |

---

## Finance & Operations

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/finance/dashboard` | Finance dashboard overview | Finance/Ops |
| `GET` | `/api/finance/confirmed-orders` | Orders ready for fulfillment | Finance/Ops |
| `POST` | `/api/finance/allocate-inventory` | Auto-allocate warehouse inventory | Finance/Ops |
| `POST` | `/api/finance/fulfill` | Execute order fulfillment | Finance/Ops |
| `POST` | `/api/finance/generate-invoice` | Generate hybrid invoice | Finance/Ops |
| `POST` | `/api/finance/record-payment` | Record payment against invoice (legacy) | Finance/Ops |
| `POST` | `/api/finance/invoices/:id/payments/simulate` | Simulate invoice payment | Finance/Ops |
| `GET` | `/api/finance/invoices` | List invoices | Finance/Ops |
| `GET` | `/api/finance/subscriptions` | List active subscriptions | Finance/Ops |
| `GET` | `/api/admin/warehouses` | List warehouses | Admin / Finance |
| `PUT` | `/api/admin/warehouses/:id` | Update warehouse | Admin |

---

## Payments & Settlement Ledger (Module 14)

Dedicated payment management system with extensible simulated payment gateway, multi-tenant isolation, idempotency, and refund support.

| Method | Path | Purpose | Role |
|---|---|---|---|
| `POST` | `/api/invoices/:id/payments` | Record payment against invoice | Finance/Ops / Admin |
| `GET` | `/api/invoices/:id/payments` | Get payment ledger & summary for invoice | Internal staff |
| `GET` | `/api/payments` | List payments with filters & pagination | Finance/Ops / Admin |
| `GET` | `/api/payments/:id` | Get specific payment record details | Internal staff |
| `POST` | `/api/payments/:id/refund` | Process partial or full refund on payment | Finance/Ops / Admin |

**Record Payment Request Example:**
```json
POST /api/invoices/inv-uuid-123/payments
Headers:
  Authorization: Bearer <jwt>
  Idempotency-Key: pay-key-xyz-789 (optional)
{
  "amount": 25000.00,
  "paymentMethod": "CARD",
  "notes": "Corporate visa settlement",
  "simulateFailure": false
}
```

**Refund Payment Request Example:**
```json
POST /api/payments/pay-uuid-456/refund
Headers:
  Authorization: Bearer <jwt>
{
  "amount": 5000.00,
  "reason": "Damaged goods return credit adjustment"
}
```

---

## Notifications

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/notifications` | Get user notifications | Any authenticated |
| `GET` | `/api/notifications/unread-count` | Get unread count | Any authenticated |
| `PATCH` | `/api/notifications/:id/read` | Mark single as read | Any authenticated |
| `PATCH` | `/api/notifications/mark-all-read` | Mark all as read | Any authenticated |

---

## Audit Trail

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/audit` | List audit events (paginated) | Internal staff |
| `GET` | `/api/audit?entityId=:id` | Filter by entity | Internal staff |
| `GET` | `/api/audit?action=:action` | Filter by action | Internal staff |

---

## Common Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

**Pagination:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

---

## Error Codes

| Code | Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Insufficient role permissions |
| `NOT_FOUND` | 404 | Entity not found (tenant-scoped) |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `CONCURRENT_UPDATE_CONFLICT` | 409 | Optimistic lock failure (version mismatch) |
| `INSUFFICIENT_INVENTORY` | 409 | Not enough stock across warehouses |
| `INVOICE_ALREADY_PAID` | 400 | Invoice fully paid — no further action needed |
| `PAYMENT_EXCEEDS_DUE` | 400 | Payment amount exceeds invoice outstanding balance |
| `PAYMENT_FAILED` | 402 | Gateway payment decline or processing failure |
| `REFUND_EXCEEDS_PAYMENT` | 400 | Refund amount exceeds available payment balance |
| `IDEMPOTENCY_CONFLICT` | 409 | Reused idempotency key with differing payload |
| `SELF_APPROVAL_FORBIDDEN` | 400 | Manager cannot approve own quote |
| `QUOTE_NOT_CONFIRMED` | 400 | Quote not in CUSTOMER_CONFIRMED state |
| `NOT_CONFIRMABLE` | 400 | Quote status does not allow confirmation |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |
