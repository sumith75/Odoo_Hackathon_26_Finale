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
import warehouseAdminRoutes from './modules/adminDashboard/warehouseRoutes.js';

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

// Production Multi-Tenant Routes Only - All backed by Neon PostgreSQL & Prisma
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

import prisma from './db/prisma.js';
import redis from './config/redis.js';
import { authRateLimiter } from './middleware/rateLimiter.js';

// ── Liveness Probe (Application running) ────────────────────────────────────
const livenessHandler = (req, res) => {
  res.json({
    status: 'ok',
    service: 'DealFlow360',
    version: '3.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};
app.get('/health', livenessHandler);
app.get('/api/health', livenessHandler);

// ── Readiness Probe (Application ready for traffic: DB & Cache ping) ────────
const readinessHandler = async (req, res) => {
  try {
    // Ping PostgreSQL authoritative source of truth
    await prisma.$queryRaw`SELECT 1`;
    const redisAvailable = redis.isAvailable();

    res.json({
      status: 'ready',
      database: 'connected',
      cache: redisAvailable ? 'redis-cluster' : 'in-memory-fallback',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[READINESS ERROR]:', err.message);
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: 'Primary datastore unreachable',
      timestamp: new Date().toISOString(),
    });
  }
};
app.get('/ready', readinessHandler);
app.get('/api/ready', readinessHandler);

// ── Multi-Tenant Core Routes (Admin Portal & Auth) ──────────────────────────
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/products', productRoutes);
app.use('/api/discount-rules', discountRuleRoutes);
app.use('/api/approval-rules', approvalRuleRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/admin/warehouses', warehouseAdminRoutes);
app.use('/api/admin', dashboardRoutes);
app.use('/api/audit', (req, res, next) => {
  const queryIdx = req.url.indexOf('?');
  const queryPart = queryIdx !== -1 ? req.url.substring(queryIdx) : '';
  req.url = '/audit' + queryPart;
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

// ── Database-backed Aliases for API Compatibility ────────────────────────
app.use('/api/quotes', quotationRoutes);
app.use('/api/customer-legacy', customersRoutes);

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
