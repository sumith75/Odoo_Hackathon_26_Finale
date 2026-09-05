/**
 * authRoutes.js — JWT Authentication backed by Neon PostgreSQL (Prisma)
 *
 * Registration Rules:
 *   - ADMIN: Self-signup (email, name, password, orgName, businessType)
 *   - CUSTOMER: Self-signup (email, name, password, companyName)
 *   - SALES_REP, SALES_MANAGER, FINANCE_MANAGER: Login ONLY.
 *     Created exclusively by Admin via /api/auth/team/add
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../db/prisma.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dealflow360-secret-key-2025';
const JWT_EXPIRES = '8h';

// Map database enum to frontend normalized role
const DB_TO_FRONTEND_ROLE = {
  admin: 'ADMIN',
  sales_rep: 'SALES_REP',
  sales_manager: 'SALES_MANAGER',
  finance: 'FINANCE_MANAGER',
};

// Map frontend role to database enum
const FRONTEND_TO_DB_ROLE = {
  ADMIN: 'admin',
  SALES_REP: 'sales_rep',
  SALES_MANAGER: 'sales_manager',
  FINANCE_MANAGER: 'finance',
  admin: 'admin',
  sales_rep: 'sales_rep',
  sales_manager: 'sales_manager',
  finance: 'finance',
};

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register/admin
// Admin self-registers with organization details
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register/admin', async (req, res) => {
  try {
    const { name, email, password, orgName, businessType } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        role: 'admin',
        organization: orgName ? orgName.trim() : 'DealFlow360 Inc.',
        companyName: orgName ? orgName.trim() : 'DealFlow360 Inc.',
      },
    });

    const safeUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: 'ADMIN',
      organization: newUser.organization,
      companyName: newUser.companyName,
      orgName: newUser.organization,
      businessType: businessType || 'Technology',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=16a34a&color=fff`,
      createdAt: newUser.createdAt,
    };

    const token = generateToken(safeUser);
    console.log(`✅ [AUTH] Admin registered: ${safeUser.name} <${safeUser.email}>`);

    res.status(201).json({ success: true, token, user: safeUser });
  } catch (err) {
    console.error('[AUTH] Admin register error:', err);
    res.status(500).json({ success: false, message: 'Registration failed. ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register/customer
// Customer self-registers
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register/customer', async (req, res) => {
  try {
    const { name, email, password, companyName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if customer already exists
    const existing = await prisma.customer.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A customer account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newCustomer = await prisma.customer.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        companyName: companyName?.trim() || name.trim(),
        tier: 'bronze',
        currency: 'USD',
      },
    });

    const safeUser = {
      id: newCustomer.id,
      name: newCustomer.name,
      email: newCustomer.email,
      role: 'CUSTOMER',
      companyName: newCustomer.companyName,
      organization: newCustomer.companyName,
      tier: newCustomer.tier,
      currency: newCustomer.currency,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff`,
      createdAt: newCustomer.createdAt,
    };

    const token = generateToken(safeUser);
    console.log(`✅ [AUTH] Customer registered: ${safeUser.name} <${safeUser.email}>`);

    res.status(201).json({ success: true, token, user: safeUser });
  } catch (err) {
    console.error('[AUTH] Customer register error:', err);
    res.status(500).json({ success: false, message: 'Customer registration failed. ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Supports all 5 roles:
// - Internal Users: admin, sales_rep, sales_manager, finance (from User table)
// - Customers: customer (from Customer table)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check internal User table (admin, sales_rep, sales_manager, finance)
    const dbUser = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (dbUser) {
      const isMatch = await bcrypt.compare(password, dbUser.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Incorrect password.' });
      }

      const frontendRole = DB_TO_FRONTEND_ROLE[dbUser.role] || 'SALES_REP';
      const safeUser = {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: frontendRole,
        organization: dbUser.organization || dbUser.companyName || 'DealFlow360 Inc.',
        companyName: dbUser.companyName || dbUser.organization || 'DealFlow360 Inc.',
        orgName: dbUser.organization || dbUser.companyName || 'DealFlow360 Inc.',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(dbUser.name)}&background=16a34a&color=fff`,
        createdAt: dbUser.createdAt,
      };

      const token = generateToken(safeUser);
      console.log(`🔑 [AUTH] Internal login: ${safeUser.name} <${safeUser.email}> [${safeUser.role}] — ${safeUser.organization}`);

      return res.json({ success: true, token, user: safeUser });
    }

    // 2. Check Customer table
    const dbCustomer = await prisma.customer.findUnique({ where: { email: cleanEmail } });

    if (dbCustomer) {
      if (dbCustomer.passwordHash) {
        const isMatch = await bcrypt.compare(password, dbCustomer.passwordHash);
        if (!isMatch) {
          return res.status(401).json({ success: false, message: 'Incorrect password.' });
        }
      }

      const safeUser = {
        id: dbCustomer.id,
        name: dbCustomer.name,
        email: dbCustomer.email,
        role: 'CUSTOMER',
        companyName: dbCustomer.companyName || dbCustomer.name,
        organization: dbCustomer.companyName || dbCustomer.name,
        tier: dbCustomer.tier,
        currency: dbCustomer.currency,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(dbCustomer.name)}&background=2563eb&color=fff`,
        createdAt: dbCustomer.createdAt,
      };

      const token = generateToken(safeUser);
      console.log(`🔑 [AUTH] Customer login: ${safeUser.name} <${safeUser.email}> [CUSTOMER]`);

      return res.json({ success: true, token, user: safeUser });
    }

    return res.status(401).json({ success: false, message: 'No account found with this email address.' });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed. ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/team/add (ADMIN ONLY)
// Admin creates accounts for: Sales Rep, Sales Manager, Finance Manager
// These roles CANNOT self-register — they only log in.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/team/add', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Authorization required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
    }

    if (decoded.role !== 'ADMIN' && decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Only administrators can add team members.' });
    }

    const { name, email, role, password, team } = req.body;
    const ALLOWED_ROLES = ['SALES_REP', 'SALES_MANAGER', 'FINANCE_MANAGER', 'sales_rep', 'sales_manager', 'finance'];

    if (!name || !email || !role || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, role, and temporary password are required.' });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Permitted team roles: SALES_REP, SALES_MANAGER, FINANCE_MANAGER',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const dbRole = FRONTEND_TO_DB_ROLE[role] || 'sales_rep';

    const newMember = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        role: dbRole,
        organization: 'DealFlow360 Inc.',
        companyName: 'DealFlow360 Inc.',
      },
    });

    const safeMember = {
      id: newMember.id,
      name: newMember.name,
      email: newMember.email,
      role: DB_TO_FRONTEND_ROLE[newMember.role] || role,
      organization: newMember.organization,
      companyName: newMember.companyName,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newMember.name)}&background=3b82f6&color=fff`,
      createdAt: newMember.createdAt,
    };

    console.log(`👥 [AUTH] Team member added by Admin: ${safeMember.name} <${safeMember.email}> [${safeMember.role}]`);

    res.status(201).json({ success: true, member: safeMember });
  } catch (err) {
    console.error('[AUTH] Add team error:', err);
    res.status(500).json({ success: false, message: 'Failed to add team member. ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/team (ADMIN ONLY)
// List all team members created by admin
// ─────────────────────────────────────────────────────────────────────────────
router.get('/team', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Authorization required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
    }

    if (decoded.role !== 'ADMIN' && decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
    }

    const members = await prisma.user.findMany({
      where: {
        role: { in: ['sales_rep', 'sales_manager', 'finance'] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organization: true,
        companyName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = members.map((m) => ({
      ...m,
      role: DB_TO_FRONTEND_ROLE[m.role] || m.role,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=3b82f6&color=fff`,
    }));

    res.json({ success: true, team: formatted });
  } catch (err) {
    console.error('[AUTH] Get team error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch team members.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// Get profile of authenticated user
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: 'Not authenticated.' });

  try {
    const decoded = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET);
    
    // Check user table
    const dbUser = await prisma.user.findUnique({
      where: { email: decoded.email },
      select: { id: true, name: true, email: true, role: true, organization: true, companyName: true, createdAt: true },
    });

    if (dbUser) {
      return res.json({
        success: true,
        user: {
          ...dbUser,
          role: DB_TO_FRONTEND_ROLE[dbUser.role] || dbUser.role,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(dbUser.name)}&background=16a34a&color=fff`,
        },
      });
    }

    // Check customer table
    const dbCustomer = await prisma.customer.findUnique({
      where: { email: decoded.email },
      select: { id: true, name: true, email: true, companyName: true, tier: true, currency: true, createdAt: true },
    });

    if (dbCustomer) {
      return res.json({
        success: true,
        user: {
          ...dbCustomer,
          role: 'CUSTOMER',
          organization: dbCustomer.companyName || dbCustomer.name,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(dbCustomer.name)}&background=2563eb&color=fff`,
        },
      });
    }

    res.status(404).json({ success: false, message: 'User not found.' });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

export default router;
