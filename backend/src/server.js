import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

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
import paymentRoutes, { invoicePaymentsRouter } from './modules/payments/paymentRoutes.js';
import reportRoutes from './modules/reports/reportRoutes.js';

// Production Multi-Tenant Routes Only - All backed by Neon PostgreSQL & Prisma
import { requestCorrelationMiddleware } from './middleware/requestCorrelation.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Production Middleware & Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

const corsOptions = {
  origin: process.env.CLIENT_URL || true,
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
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

import notificationRoutes from './modules/notifications/notificationRoutes.js';
import auditRoutes from './modules/audit/auditRoutes.js';

// Multi-Tenant Core Routes (Admin Portal & Auth)
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/products', productRoutes);
app.use('/api/discount-rules', discountRuleRoutes);
app.use('/api/approval-rules', approvalRuleRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/admin/warehouses', warehouseAdminRoutes);
app.use('/api/admin', dashboardRoutes);

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

// ── Multi-Tenant Payments & Billing Settlement Module ─────────────────────────
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', invoicePaymentsRouter);

// ── Multi-Tenant Management Reporting & Document Generation Module ─────────
app.use('/api/reports', reportRoutes);

// ── Database-backed Aliases for API Compatibility ────────────────────────
app.use('/api/quotes', quotationRoutes);
app.use('/api/customer-legacy', customersRoutes);

// Consistent Global Error Handler (Section 42 & Security Hardening)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  console.error(`[SERVER_ERROR ${statusCode}]:`, err.message);
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR'),
      message: err.message || 'An unexpected server error occurred.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
  });
});

// Verify the authoritative Prisma/PostgreSQL connection before accepting traffic
async function verifyDatabaseConnection() {
  const safeUrl = (process.env.DATABASE_URL || '').replace(/:[^:@]+@/, ':****@');
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ [DATABASE] Successfully connected to PostgreSQL at:', safeUrl);
    console.log('✅ [DATABASE] PostgreSQL active via Neon & Prisma.');
  } catch (err) {
    console.error('❌ [DATABASE] Failed to connect to PostgreSQL:', err.message);
    throw err;
  }
}

// Initialize Database & Start Server
async function startServer() {
  await verifyDatabaseConnection();

  const server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 DealFlow360 Multi-Tenant Engine running on port ${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📡 Ready Check:  http://localhost:${PORT}/api/ready`);
    console.log(`====================================================`);
  });

  // ── Graceful Shutdown (SIGTERM from Docker/K8s, SIGINT from Ctrl+C) ──────
  const shutdown = async (signal) => {
    console.log(`\n[SHUTDOWN] Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      console.log('[SHUTDOWN] HTTP server closed. Closing database connections...');
      try {
        await prisma.$disconnect();
        console.log('[SHUTDOWN] Prisma disconnected.');
      } catch (err) {
        console.warn('[SHUTDOWN] Prisma disconnect error (non-fatal):', err.message);
      }

      try {
        if (redis && typeof redis.quit === 'function') {
          await redis.quit();
          console.log('[SHUTDOWN] Redis disconnected.');
        }
      } catch (err) {
        console.warn('[SHUTDOWN] Redis disconnect error (non-fatal):', err.message);
      }

      console.log('[SHUTDOWN] Graceful shutdown complete. Exiting.');
      process.exit(0);
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      console.error('[SHUTDOWN] Forced exit after 10s timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  return server;
}

startServer();

export default app;
