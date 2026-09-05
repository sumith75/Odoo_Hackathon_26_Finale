import express from 'express';
import prisma from '../../db/prisma.js';
import { authenticateUser } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { logAudit } from '../../utils/audit.js';

const router = express.Router();

router.use(authenticateUser);
router.use(resolveTenant);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/customers
// Section 7 & 31: Customer Directory for CPQ Studio & Sales Reps
import { parsePaginationParams, buildPaginationMeta } from '../../utils/pagination.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/customers
// Section 7 & 31: Customer Directory with Server-Side Pagination
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { page, limit, skip, take } = parsePaginationParams(req.query);

    const where = {
      tenantId: req.tenantId,
      status: 'ACTIVE',
    };

    if (req.query.tier && req.query.tier !== 'ALL') {
      where.tier = req.query.tier;
    }

    if (req.query.search) {
      const search = req.query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [totalCount, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
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
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      success: true,
      data: customers,
      pagination: buildPaginationMeta(totalCount, page, limit),
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
    const { name, companyName, email, tier = 'BRONZE', currency = 'INR' } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer name and email are required.' },
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const validTier = ['BRONZE', 'SILVER', 'GOLD'].includes(tier) ? tier : 'BRONZE';

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
        tier: validTier,
        currency: currency || 'INR',
        status: 'ACTIVE',
      },
    });

    // Audit log
    await logAudit({
      tenantId: req.tenantId,
      userId: req.user?.id,
      action: 'CUSTOMER_CREATED',
      entityType: 'CUSTOMER',
      entityId: customer.id,
      metadata: {
        customerId: customer.id,
        customerName: customer.companyName || customer.name,
        email: customer.email,
        tier: customer.tier,
        createdBy: req.user?.name || req.user?.email || 'SYSTEM',
        timestamp: new Date().toISOString(),
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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/customers/:id/tier
// Commercial Tier Governance: Admin changes customer tier (BRONZE, SILVER, GOLD)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/tier', async (req, res) => {
  try {
    const { tier } = req.body;

    if (!tier || !['BRONZE', 'SILVER', 'GOLD'].includes(tier)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TIER', message: 'Tier must be BRONZE, SILVER, or GOLD.' },
      });
    }

    // Role check: Only ADMIN and authorized managers can assign commercial tiers
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SALES_MANAGER') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only administrators can update commercial tiers.' },
      });
    }

    // Tenant-isolated lookup
    const customer = await prisma.customer.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId,
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found in this organization.' },
      });
    }

    const previousTier = customer.tier;

    if (previousTier === tier) {
      return res.json({
        success: true,
        data: customer,
        message: `Customer is already at ${tier} tier.`,
      });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: { tier },
    });

    // Append-only AuditLog entry
    await logAudit({
      tenantId: req.tenantId,
      userId: req.user?.id,
      action: 'CUSTOMER_TIER_UPDATED',
      entityType: 'CUSTOMER',
      entityId: customer.id,
      metadata: {
        customerId: customer.id,
        customerName: customer.companyName || customer.name,
        previousTier,
        newTier: tier,
        changedBy: req.user?.name || req.user?.email || 'Admin',
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      success: true,
      data: updatedCustomer,
      message: `Commercial tier for ${customer.companyName || customer.name} changed from ${previousTier} to ${tier}.`,
    });
  } catch (err) {
    console.error('[CUSTOMERS] Tier update error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update customer tier.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/customers/:id
// Admin edits customer profile (Name, Company Name, Email, Tier, Status)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { name, companyName, email, tier, currency, status } = req.body;

    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SALES_MANAGER') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only administrators can modify customer accounts.' },
      });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId,
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found in this organization.' },
      });
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (companyName !== undefined) updateData.companyName = companyName ? companyName.trim() : customer.name;
    if (email) updateData.email = email.trim().toLowerCase();
    if (currency) updateData.currency = currency;
    if (status && ['ACTIVE', 'INACTIVE'].includes(status)) updateData.status = status;

    const previousTier = customer.tier;
    const tierChanged = tier && ['BRONZE', 'SILVER', 'GOLD'].includes(tier) && tier !== previousTier;
    if (tier && ['BRONZE', 'SILVER', 'GOLD'].includes(tier)) {
      updateData.tier = tier;
    }

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: updateData,
    });

    if (tierChanged) {
      await logAudit({
        tenantId: req.tenantId,
        userId: req.user?.id,
        action: 'CUSTOMER_TIER_UPDATED',
        entityType: 'CUSTOMER',
        entityId: customer.id,
        metadata: {
          customerId: customer.id,
          customerName: updated.companyName || updated.name,
          previousTier,
          newTier: tier,
          changedBy: req.user?.name || req.user?.email || 'Admin',
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error('[CUSTOMERS] Update error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update customer.' },
    });
  }
});

export default router;
