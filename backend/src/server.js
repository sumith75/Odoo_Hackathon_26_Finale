import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initDb, getDbStatus } from './config/db.js';

// Multi-Tenant Admin Modules
import authRoutes from './modules/auth/authRoutes.js';
import organizationRoutes from './modules/organization/organizationRoutes.js';
import teamRoutes from './modules/team/teamRoutes.js';
import productRoutes from './modules/products/productRoutes.js';
import discountRuleRoutes from './modules/discountRules/discountRuleRoutes.js';
import approvalRuleRoutes from './modules/approvalRules/approvalRuleRoutes.js';
import dashboardRoutes from './modules/adminDashboard/dashboardRoutes.js';

// Multi-Tenant Sales Rep & CPQ Modules
import customersRoutes from './modules/customers/customerRoutes.js';
import quotationRoutes from './modules/quotations/quotationRoutes.js';
import salesDashboardRoutes from './modules/salesDashboard/salesDashboardRoutes.js';

// Multi-Tenant Sales Manager & Approval Governance Module
import managerRoutes from './modules/manager/managerRoutes.js';

// Multi-Tenant Customer Deal Room & Negotiation Module
import customerDealRoomRoutes from './modules/customerDealRoom/customerRoutes.js';

// Multi-Tenant Finance & Operations Module
import financeRoutes from './modules/finance/financeRoutes.js';

// Legacy / Future Integration Modules
import quoteRoutes from './routes/quoteRoutes.js';
import approvalRoutes from './routes/approvalRoutes.js';
import legacyCustomerRoutes from './routes/customerRoutes.js';
import executionRoutes from './routes/executionRoutes.js';

import { requestCorrelationMiddleware } from './middleware/requestCorrelation.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Production Middleware
app.use(cors());
app.use(express.json());
app.use(requestCorrelationMiddleware);
app.use(idempotencyMiddleware);
app.use(morgan('dev'));

// Health & Status endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'DealFlow360 — Multi-Tenant Autonomous Deal Management Engine',
    version: '3.0.0',
    database: getDbStatus(),
    timestamp: new Date().toISOString(),
  });
});

// ── Multi-Tenant Core Routes (Admin Portal & Auth) ──────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/products', productRoutes);
app.use('/api/discount-rules', discountRuleRoutes);
app.use('/api/approval-rules', approvalRuleRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/admin', dashboardRoutes);
app.use('/api/audit', (req, res, next) => {
  req.url = '/audit';
  dashboardRoutes(req, res, next);
});

// ── Multi-Tenant Sales Representative & CPQ Studio Routes ───────────────────
app.use('/api/customers', customersRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/sales/dashboard', salesDashboardRoutes);

// ── Multi-Tenant Sales Manager & Approval Governance Routes ─────────────────
app.use('/api/manager', managerRoutes);
app.use('/api/approvals', managerRoutes);

// ── Multi-Tenant Customer Deal Room & Negotiation Module ────────────────────
app.use('/api/customer', customerDealRoomRoutes);

// ── Multi-Tenant Finance & Operations Module ─────────────────────────────────
app.use('/api/finance', financeRoutes);

// ── Future Workflows (Preserved for Next Phases) ──────────────────────────
app.use('/api/quotes', quoteRoutes);
app.use('/api/customer-legacy', legacyCustomerRoutes);
app.use('/api/execution', executionRoutes);

// Consistent Global Error Handler (Section 42)
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
  });
});

// Initialize Database & Start Server
async function startServer() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 DealFlow360 Multi-Tenant Engine running on port ${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`====================================================`);
  });
}

startServer();

export default app;
