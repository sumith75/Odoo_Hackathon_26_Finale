import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../db/prisma.js';
import { authenticateUser } from '../../middleware/auth.js';
import { logAudit } from '../../utils/audit.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dealflow360-secret-key-2025';
const JWT_EXPIRES = '24h';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register-organization
// Section 9: The Admin is the first account. Creates Org + Admin User + Logs in
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register-organization', async (req, res) => {
  try {
    const { organizationName, adminName, email, password, industry, country, currency } = req.body;

    if (!organizationName || !adminName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Organization name, admin name, email, and password are required.' },
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters long.' },
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if an account with this email already exists
    const existing = await prisma.user.findFirst({
      where: { email: cleanEmail },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email address already exists.' },
      });
    }

    // 1. Create Organization
    const org = await prisma.organization.create({
      data: {
        name: organizationName.trim(),
        companyEmail: cleanEmail,
        industry: industry?.trim() || 'Technology',
        country: country?.trim() || 'India',
        currency: currency?.trim() || 'INR',
      },
    });

    // 2. Hash Password & Create Admin User
    const passwordHash = await bcrypt.hash(password, 10);
    const adminUser = await prisma.user.create({
      data: {
        tenantId: org.id,
        name: adminName.trim(),
        email: cleanEmail,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        lastLogin: new Date(),
      },
    });

    // 3. Log Audit
    await logAudit({
      tenantId: org.id,
      userId: adminUser.id,
      action: 'ORGANIZATION_CREATED',
      entityType: 'ORGANIZATION',
      entityId: org.id,
      metadata: { orgName: org.name, adminEmail: cleanEmail },
    });

    // 4. Generate Token & Return Response
    const safeUser = {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: 'ADMIN',
      status: 'ACTIVE',
      tenantId: org.id,
      organizationName: org.name,
      currency: org.currency,
      createdAt: adminUser.createdAt,
    };

    const token = generateToken(safeUser);
    console.log(`🏢 [AUTH] New Organization Registered: ${org.name} | Admin: ${adminUser.name}`);

    res.status(201).json({
      success: true,
      token,
      user: safeUser,
      data: { token, user: safeUser },
    });
  } catch (err) {
    console.error('[AUTH] Register Organization error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Registration failed. ' + err.message },
      message: 'Registration failed. ' + err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/organizations
// Public: Returns list of active organizations for customer signup selection
// ─────────────────────────────────────────────────────────────────────────────
router.get('/organizations', async (req, res) => {
  try {
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        industry: true,
        currency: true,
        country: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: orgs });
  } catch (err) {
    console.error('[AUTH] List organizations error:', err);
    res.status(500).json({ success: false, message: 'Failed to list organizations: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register-customer (and /register/customer)
// Section 6 & 13: Customer self-registration
// ─────────────────────────────────────────────────────────────────────────────
async function handleCustomerRegistration(req, res) {
  try {
    const { name, email, password, companyName, tenantId, phone } = req.body;

    if (!name || !email || !password || !companyName) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Full name, email address, password, and company name are required.' },
        message: 'Full name, email address, password, and company name are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters long.' },
        message: 'Password must be at least 6 characters long.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Resolve tenant: use provided tenantId or fallback to the primary organization
    let org = null;
    if (tenantId) {
      org = await prisma.organization.findUnique({ where: { id: tenantId } });
    }
    if (!org) {
      org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    }

    if (!org) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_ORGANIZATION', message: 'No registered organization found to associate with customer.' },
        message: 'No registered organization found to associate with customer.',
      });
    }

    // 2. Check if a customer account with this email already exists in this tenant
    const existingCustomer = await prisma.customer.findFirst({
      where: { email: cleanEmail, tenantId: org.id },
    });

    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'A customer account with this email already exists.' },
        message: 'A customer account with this email already exists.',
      });
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Create customer record
    const newCustomer = await prisma.customer.create({
      data: {
        tenantId: org.id,
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        companyName: companyName.trim(),
        tier: 'BRONZE',
        currency: org.currency || 'INR',
        status: 'ACTIVE',
      },
      include: { tenant: true },
    });

    // 5. Log audit trail
    await logAudit({
      tenantId: org.id,
      userId: newCustomer.id,
      action: 'CUSTOMER_REGISTERED',
      entityType: 'CUSTOMER',
      entityId: newCustomer.id,
      metadata: { customerName: newCustomer.name, email: cleanEmail, companyName: newCustomer.companyName },
    });

    // 6. Generate JWT and return safe user
    const safeCustomer = {
      id: newCustomer.id,
      name: newCustomer.name,
      email: newCustomer.email,
      role: 'CUSTOMER',
      status: newCustomer.status,
      companyName: newCustomer.companyName,
      tier: newCustomer.tier,
      tenantId: newCustomer.tenantId,
      organizationName: org.name,
      currency: newCustomer.currency,
      createdAt: newCustomer.createdAt,
    };

    const token = generateToken(safeCustomer);
    console.log(`👤 [AUTH] Customer Registered: ${safeCustomer.name} <${safeCustomer.email}> (${safeCustomer.companyName}) -> Tenant: ${org.name}`);

    res.status(201).json({
      success: true,
      token,
      user: safeCustomer,
      data: { token, user: safeCustomer },
    });
  } catch (err) {
    console.error('[AUTH] Customer registration error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Customer registration failed: ' + err.message },
      message: 'Customer registration failed: ' + err.message,
    });
  }
}

router.post('/register-customer', handleCustomerRegistration);
router.post('/register/customer', handleCustomerRegistration);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Section 13 & 37: Unified employee login supporting all 5 roles
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' },
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Search in User table (Admin, Sales Rep, Sales Manager, Finance/Ops)
    const user = await prisma.user.findFirst({
      where: { email: cleanEmail },
      include: { tenant: true },
    });

    if (user) {
      if (user.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCOUNT_DEACTIVATED', message: 'Your account has been deactivated. Please contact your administrator.' },
        });
      }

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' },
        });
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone,
        tenantId: user.tenantId,
        organizationName: user.tenant?.name || 'DealFlow360 Enterprise',
        currency: user.tenant?.currency || 'INR',
        lastLogin: new Date(),
        createdAt: user.createdAt,
      };

      const token = generateToken(safeUser);
      console.log(`🔑 [AUTH] Login success: ${safeUser.name} <${safeUser.email}> [${safeUser.role}] — ${safeUser.organizationName}`);

      return res.json({
        success: true,
        token,
        user: safeUser,
        data: { token, user: safeUser },
      });
    }

    // 2. Search in Customer table
    const customer = await prisma.customer.findFirst({
      where: { email: cleanEmail },
      include: { tenant: true },
    });

    if (customer) {
      if (customer.passwordHash) {
        const match = await bcrypt.compare(password, customer.passwordHash);
        if (!match) {
          return res.status(401).json({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' },
          });
        }
      }

      const safeCustomer = {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        role: 'CUSTOMER',
        status: customer.status,
        companyName: customer.companyName,
        tier: customer.tier,
        tenantId: customer.tenantId,
        organizationName: customer.tenant?.name || 'DealFlow360',
        currency: customer.currency,
        createdAt: customer.createdAt,
      };

      const token = generateToken(safeCustomer);
      console.log(`🔑 [AUTH] Customer login: ${safeCustomer.name} <${safeCustomer.email}> [CUSTOMER]`);

      return res.json({
        success: true,
        token,
        user: safeCustomer,
        data: { token, user: safeCustomer },
      });
    }

    return res.status(401).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'No account found with this email address.' },
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Login failed. ' + err.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', authenticateUser, async (req, res) => {
  res.json({
    success: true,
    user: req.user,
    data: { user: req.user },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

export default router;
