import express from 'express';
import prisma from '../../db/prisma.js';
import { authenticateUser } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { logAudit } from '../../utils/audit.js';

const router = express.Router();

router.use(authenticateUser);
router.use(requireRole('ADMIN'));
router.use(resolveTenant);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/organization
// Section 10: View Organization Profile
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.tenantId },
    });

    if (!org) {
      return res.status(404).json({
        success: false,
        error: { code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' },
      });
    }

    res.json({
      success: true,
      data: org,
    });
  } catch (err) {
    console.error('[ORG] Fetch error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve organization profile.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/organization
// Section 10: Edit Organization Profile
// ─────────────────────────────────────────────────────────────────────────────
router.put('/', async (req, res) => {
  try {
    const existing = await prisma.organization.findUnique({
      where: { id: req.tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Organization not found.' },
      });
    }

    const { name, companyEmail, phone, industry, country, currency, timezone, address } = req.body;

    const updated = await prisma.organization.update({
      where: { id: req.tenantId },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        companyEmail: companyEmail !== undefined ? (companyEmail ? companyEmail.trim() : null) : existing.companyEmail,
        phone: phone !== undefined ? (phone ? phone.trim() : null) : existing.phone,
        industry: industry !== undefined ? (industry ? industry.trim() : null) : existing.industry,
        country: country !== undefined ? (country ? country.trim() : null) : existing.country,
        currency: currency !== undefined ? (currency ? currency.trim() : 'INR') : existing.currency,
        timezone: timezone !== undefined ? (timezone ? timezone.trim() : 'Asia/Kolkata') : existing.timezone,
        address: address !== undefined ? (address ? address.trim() : null) : existing.address,
      },
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'ORGANIZATION_UPDATED',
      entityType: 'ORGANIZATION',
      entityId: req.tenantId,
      metadata: { updatedFields: Object.keys(req.body) },
    });

    console.log(`🏢 [ORG] Profile updated: ${updated.name}`);

    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error('[ORG] Update error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update organization profile.' },
    });
  }
});

export default router;
