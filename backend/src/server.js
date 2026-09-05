import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initDb, getDbStatus } from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import quoteRoutes from './routes/quoteRoutes.js';
import approvalRoutes from './routes/approvalRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import executionRoutes from './routes/executionRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

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
    service: 'DealFlow360 — Smart Self-Governing Deal Management Engine',
    version: '2.0.0',
    database: getDbStatus(),
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/execution', executionRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize Database & Start Server
async function startServer() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 CPQ & Order-to-Cash Backend API running on port ${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`====================================================`);
  });
}

startServer();

export default app;
