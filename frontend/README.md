# DealFlow360 — Frontend

React + Vite single-page app for DealFlow360, a self-governing B2B sales operations platform. Five role-based workspaces (Admin, Sales Rep, Sales Manager, Finance & Operations, Customer) share one authenticated shell, route-gated by role.

See the repository root [README.md](../README.md) for the full project overview, setup instructions, demo credentials, and architecture notes. This file covers frontend-specific details only.

## Structure

- `src/components/admin/*` — backend configuration (products, discount/approval rules, warehouses, team, org)
- `src/components/sales/*` — CPQ Studio (quote builder, live margin, risk engine, upsell panel)
- `src/components/manager/*` — approval inbox/dossier, deal health, team pipeline
- `src/components/finance/*` — fulfillment & warehouse allocation, subscriptions/proration, invoices, payments
- `src/components/customer/*` — customer deal room (negotiation, counter-offers, confirmation)
- `src/context/AuthContext.jsx` — shared auth/session state
- `src/utils/api.js` — `fetchWithAuth()`, the single API client used across the app; handles bearer-token attachment and session-expiry (401) redirect to `/login`

## Local development

```bash
npm install
npm run dev       # starts Vite dev server (proxies /api to the backend)
npm run build     # production build
npm run lint      # oxlint
```

Requires the backend (`../backend`) running separately — see the root README for the full setup flow (env, `prisma db push`, seed, `npm run dev`).
