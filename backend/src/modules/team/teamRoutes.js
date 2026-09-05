import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../db/prisma.js';
import { authenticateUser } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { logAudit } from '../../utils/audit.js';

const router = express.Router();

router.use(authenticateUser);
router.use(requireRole('ADMIN'));
router.use(resolveTenant);

const ALLOWED_ROLES = ['SALES_REP', 'SALES_MANAGER', 'FINANCE_OPERATIONS'];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/team
// Section 11: View Team Members with Search and Filters
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { role, status, search } = req.query;

    const where = {
      tenantId: req.tenantId,
    };

    if (role && role !== 'ALL') {
      where.role = role;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const members = await prisma.user.findMany({
      where,
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: members,
    });
  } catch (err) {
    console.error('[TEAM] List error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve team members.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/team/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const member = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        error: { code: 'MEMBER_NOT_FOUND', message: 'Team member not found in your organization.' },
      });
    }

    res.json({ success: true, data: member });
  } catch (err) {
    console.error('[TEAM] Fetch member error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve team member.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/team
// Section 2 & 12: Add Team Member (Instant Active, Bcrypt Hashed, Direct Login)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name, email, password, and role are required.' },
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'PASSWORD_MISMATCH', message: 'Password and confirm password do not match.' },
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: `Role must be one of: ${ALLOWED_ROLES.join(', ')}. Customers cannot be added here.`,
        },
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters.' },
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check email uniqueness within tenant
    const existing = await prisma.user.findFirst({
      where: { tenantId: req.tenantId, email: cleanEmail },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'A team member with this email already exists in your organization.' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newMember = await prisma.user.create({
      data: {
        tenantId: req.tenantId,
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        role,
        status: 'ACTIVE',
        phone: phone ? phone.trim() : null,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
      },
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'TEAM_MEMBER_CREATED',
      entityType: 'USER',
      entityId: newMember.id,
      metadata: { name: newMember.name, email: newMember.email, role: newMember.role },
    });

    console.log(`👥 [TEAM] Member added: ${newMember.name} <${newMember.email}> [${newMember.role}]`);

    res.status(201).json({
      success: true,
      data: newMember,
      message: 'Team member created successfully. They can now log in immediately.',
    });
  } catch (err) {
    console.error('[TEAM] Create error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create team member. ' + err.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/team/:id
// Section 11: Edit Team Member
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { name, role, phone, password } = req.body;

    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'MEMBER_NOT_FOUND', message: 'Team member not found in your organization.' },
      });
    }

    const data = {};
    if (name) data.name = name.trim();
    if (phone !== undefined) data.phone = phone ? phone.trim() : null;

    if (role) {
      if (![...ALLOWED_ROLES, 'ADMIN'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ROLE', message: 'Invalid role specified.' },
        });
      }
      data.role = role;
    }

    if (password && password.trim().length >= 6) {
      data.passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        updatedAt: true,
      },
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'TEAM_MEMBER_UPDATED',
      entityType: 'USER',
      entityId: updated.id,
      metadata: { updatedFields: Object.keys(data) },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[TEAM] Update error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update team member.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/team/:id/status
// Section 11: Activate / Deactivate Team Member
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Status must be ACTIVE or INACTIVE.' },
      });
    }

    const member = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        error: { code: 'MEMBER_NOT_FOUND', message: 'Team member not found.' },
      });
    }

    // Safety: Admin cannot deactivate themselves
    if (member.id === req.user.id && status === 'INACTIVE') {
      return res.status(400).json({
        success: false,
        error: { code: 'CANNOT_DEACTIVATE_SELF', message: 'Administrators cannot deactivate their own active account.' },
      });
    }

    const updated = await prisma.user.update({
      where: { id: member.id },
      data: { status },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    const action = status === 'ACTIVE' ? 'TEAM_MEMBER_ACTIVATED' : 'TEAM_MEMBER_DEACTIVATED';
    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action,
      entityType: 'USER',
      entityId: updated.id,
      metadata: { previousStatus: member.status, newStatus: status },
    });

    console.log(`👤 [TEAM] Member status updated: ${updated.name} -> ${status}`);

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[TEAM] Status toggle error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update member status.' },
    });
  }
});

export default router;
