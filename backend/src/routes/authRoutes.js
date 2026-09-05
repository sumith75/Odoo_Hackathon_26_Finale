/**
 * authRoutes.js — JWT-based authentication
 *
 * Roles & who can register:
 *   ADMIN            → self-register (email, name, org name, business type, password)
 *   CUSTOMER         → self-register (email, name, company, password)
 *   SALES_MANAGER    → login only  (Admin creates their account)
 *   SALES_REP        → login only  (Admin creates their account)
 *   FINANCE_MANAGER  → login only  (Admin creates their account)
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dealflow360-secret-key-2025';
const JWT_EXPIRES = '8h';

// ── In-memory user store (replace with DB in production) ──────────────────────
// Map: email → user record
const users = new Map();

// Seed a default admin for demo purposes
const demoAdminPassword = bcrypt.hashSync('admin123', 10);
users.set('admin@dealflow360.com', {
  id: 'user-admin-001',
  name: 'Sarah Admin',
  email: 'admin@dealflow360.com',
  password: demoAdminPassword,
  role: 'ADMIN',
  orgName: 'DealFlow360 Inc.',
  businessType: 'Technology',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  createdAt: new Date().toISOString(),
});

// Seed demo internal users for demo purposes (added by admin)
const demoPw = bcrypt.hashSync('password123', 10);
users.set('sales@dealflow360.com', {
  id: 'user-sales-001',
  name: 'Alex Morgan',
  email: 'sales@dealflow360.com',
  password: demoPw,
  role: 'SALES_REP',
  adminId: 'user-admin-001',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  createdAt: new Date().toISOString(),
});
users.set('manager@dealflow360.com', {
  id: 'user-manager-001',
  name: 'David Chen',
  email: 'manager@dealflow360.com',
  password: demoPw,
  role: 'SALES_MANAGER',
  adminId: 'user-admin-001',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  createdAt: new Date().toISOString(),
});
users.set('finance@dealflow360.com', {
  id: 'user-finance-001',
  name: 'Priya Finance',
  email: 'finance@dealflow360.com',
  password: demoPw,
  role: 'FINANCE_MANAGER',
  adminId: 'user-admin-001',
  avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  createdAt: new Date().toISOString(),
});
users.set('customer@acme.com', {
  id: 'user-customer-001',
  name: 'James Wilson',
  email: 'customer@acme.com',
  password: demoPw,
  role: 'CUSTOMER',
  companyName: 'Acme Corporation',
  avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  createdAt: new Date().toISOString(),
});

// ── Helper: strip password before sending ─────────────────────────────────────
function safeUser(user) {
  const { password, ...safe } = user;
  return safe;
}

// ── Helper: generate JWT ──────────────────────────────────────────────────────
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register/admin
// Admin self-registers with org details
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register/admin', async (req, res) => {
  try {
    const { name, email, password, orgName, businessType } = req.body;

    if (!name || !email || !password || !orgName || !businessType) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const key = email.trim().toLowerCase();
    if (users.has(key)) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = {
      id: `user-admin-${crypto.randomBytes(4).toString('hex')}`,
      name: name.trim(),
      email: key,
      password: hashed,
      role: 'ADMIN',
      orgName: orgName.trim(),
      businessType: businessType.trim(),
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=16a34a&color=fff`,
      createdAt: new Date().toISOString(),
    };
    users.set(key, user);

    const token = generateToken(user);
    console.log(`✅ [AUTH] Admin registered: ${user.name} <${user.email}> — Org: ${orgName}`);

    res.status(201).json({ success: true, token, user: safeUser(user) });
  } catch (err) {
    console.error('[AUTH] Admin register error:', err);
    res.status(500).json({ success: false, message: 'Registration failed.' });
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
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }

    const key = email.trim().toLowerCase();
    if (users.has(key)) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = {
      id: `user-customer-${crypto.randomBytes(4).toString('hex')}`,
      name: name.trim(),
      email: key,
      password: hashed,
      role: 'CUSTOMER',
      companyName: companyName?.trim() || '',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`,
      createdAt: new Date().toISOString(),
    };
    users.set(key, user);

    const token = generateToken(user);
    console.log(`✅ [AUTH] Customer registered: ${user.name} <${user.email}>`);

    res.status(201).json({ success: true, token, user: safeUser(user) });
  } catch (err) {
    console.error('[AUTH] Customer register error:', err);
    res.status(500).json({ success: false, message: 'Registration failed.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// All roles — email + password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const key = email.trim().toLowerCase();
    const user = users.get(key);

    if (!user) {
      return res.status(401).json({ success: false, message: 'No account found with this email.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }

    const token = generateToken(user);
    console.log(`🔑 [AUTH] Login: ${user.name} <${user.email}> [${user.role}]`);

    res.json({ success: true, token, user: safeUser(user) });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/team/add  (Admin only)
// Admin adds Sales Manager / Sales Rep / Finance Manager
// ─────────────────────────────────────────────────────────────────────────────
router.post('/team/add', async (req, res) => {
  try {
    // Verify caller is an Admin via JWT
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: 'Not authenticated.' });

    let decoded;
    try {
      decoded = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }

    if (decoded.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only admins can add team members.' });
    }

    const { name, email, role, password } = req.body;
    const ALLOWED_ROLES = ['SALES_MANAGER', 'SALES_REP', 'FINANCE_MANAGER'];

    if (!name || !email || !role || !password) {
      return res.status(400).json({ success: false, message: 'name, email, role, and password are required.' });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${ALLOWED_ROLES.join(', ')}` });
    }

    const key = email.trim().toLowerCase();
    if (users.has(key)) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const AVATAR_COLORS = { SALES_MANAGER: 'f59e0b', SALES_REP: '3b82f6', FINANCE_MANAGER: '10b981' };
    const user = {
      id: `user-${role.toLowerCase()}-${crypto.randomBytes(4).toString('hex')}`,
      name: name.trim(),
      email: key,
      password: hashed,
      role,
      adminId: decoded.id,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${AVATAR_COLORS[role]}&color=fff`,
      createdAt: new Date().toISOString(),
    };
    users.set(key, user);

    console.log(`✅ [AUTH] Admin ${decoded.email} added team member: ${user.name} <${user.email}> [${role}]`);
    res.status(201).json({ success: true, user: safeUser(user), message: `${name} added as ${role}` });
  } catch (err) {
    console.error('[AUTH] Team add error:', err);
    res.status(500).json({ success: false, message: 'Failed to add team member.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/team  (Admin only — list their team members)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/team', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: 'Not authenticated.' });

    let decoded;
    try {
      decoded = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }

    if (decoded.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only admins can view team.' });
    }

    const team = [...users.values()]
      .filter(u => u.adminId === decoded.id)
      .map(safeUser);

    res.json({ success: true, team });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch team.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: 'Not authenticated.' });

    const decoded = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET);
    const user = users.get(decoded.email);

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({ success: true, user: safeUser(user) });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout  (client just discards token, but we acknowledge it)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Legacy Google auth endpoint — redirect to login
router.post('/google', (req, res) => {
  res.status(410).json({ success: false, message: 'Google OAuth has been removed. Please use email/password login.' });
});

export default router;
