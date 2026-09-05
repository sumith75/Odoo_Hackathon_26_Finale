import express from 'express';
import prisma from '../../db/prisma.js';
import { authenticateUser } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';

const router = express.Router();

router.use(authenticateUser);
router.use(resolveTenant);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/customers
// Section 7 & 31: Customer Directory for CPQ Studio & Sales Reps
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: {
        tenantId: req.tenantId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        tier: true,
        currency: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: customers,
    });
  } catch (err) {
    console.error('[CUSTOMERS] Fetch error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve customers.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/customers/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId,
      },
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        tier: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found in this organization.' },
      });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (err) {
    console.error('[CUSTOMERS] Detail fetch error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve customer details.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/customers
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, companyName, email, tier = 'BRONZE' } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer name and email are required.' },
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check duplicate within tenant
    const existing = await prisma.customer.findFirst({
      where: {
        tenantId: req.tenantId,
        email: cleanEmail,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_EMAIL', message: 'A customer with this email already exists.' },
      });
    }

    const customer = await prisma.customer.create({
      data: {
        tenantId: req.tenantId,
        name: name.trim(),
        companyName: companyName ? companyName.trim() : name.trim(),
        email: cleanEmail,
        tier,
        status: 'ACTIVE',
      },
    });

    res.status(201).json({
      success: true,
      data: customer,
    });
  } catch (err) {
    console.error('[CUSTOMERS] Create error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create customer.' },
    });
  }
});

export default router;
