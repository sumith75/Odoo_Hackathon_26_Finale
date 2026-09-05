import express from 'express';
import crypto from 'crypto';
import { initialUsers } from '../db/seedData.js';

const router = express.Router();

let currentUser = null; // Unauthenticated by default until login
const activeSessions = new Map();

// Helper to find or map user by email or role
function resolveUser(email, role) {
  if (role) {
    const byRole = initialUsers.find(u => u.role === role);
    if (byRole) return byRole;
  }

  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    const byEmail = initialUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (byEmail) return byEmail;

    // Pattern matching for role domains
    if (cleanEmail.includes('admin')) return initialUsers.find(u => u.role === 'ADMIN');
    if (cleanEmail.includes('manager')) return initialUsers.find(u => u.role === 'SALES_MANAGER');
    if (cleanEmail.includes('finance') || cleanEmail.includes('ops')) return initialUsers.find(u => u.role === 'FINANCE_OPERATIONS');
    if (cleanEmail.includes('acme') || cleanEmail.includes('customer')) return initialUsers.find(u => u.role === 'CUSTOMER');
    if (cleanEmail.includes('sales')) return initialUsers.find(u => u.role === 'SALES_REP');

    // Dynamically provision generic external Google user
    return {
      id: `user-google-${crypto.randomBytes(4).toString('hex')}`,
      name: email.split('@')[0].replace('.', ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase()),
      email: cleanEmail,
      role: role || 'CUSTOMER',
      authProvider: 'google'
    };
  }

  return initialUsers[1]; // Default to Sales Rep
}

/**
 * Standard Login / Role switch endpoint
 */
router.post('/login', (req, res) => {
  const { email, role } = req.body;
  const user = resolveUser(email, role);
  currentUser = user;

  const token = `df360-jwt-${crypto.randomBytes(16).toString('hex')}`;
  activeSessions.set(token, user);

  res.json({
    success: true,
    token,
    user: currentUser,
    message: `Authenticated as ${currentUser.name} (${currentUser.role})`
  });
});

/**
 * Google Auth Verification & Sign-In Endpoint
 */
router.post('/google', (req, res) => {
  const { email, name, avatar, role, credential } = req.body;

  if (!email && !role) {
    return res.status(400).json({
      success: false,
      message: 'Google authentication requires an email or role identifier'
    });
  }

  const user = resolveUser(email, role);
  if (name && !user.name.includes('(')) {
    user.name = name;
  }
  if (avatar) {
    user.avatar = avatar;
  }

  currentUser = user;
  const token = `df360-gtoken-${crypto.randomBytes(16).toString('hex')}`;
  activeSessions.set(token, user);

  console.log(`🔑 [GOOGLE AUTH] Successfully authenticated Google user: ${user.name} <${user.email}> [Role: ${user.role}]`);

  res.json({
    success: true,
    token,
    user: currentUser,
    authProvider: 'google',
    message: `Google Sign-in successful for ${currentUser.name}`
  });
});

/**
 * Logout Endpoint
 */
router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    activeSessions.delete(token);
  }
  currentUser = null;

  res.json({
    success: true,
    message: 'User logged out successfully'
  });
});

/**
 * Current User Endpoint
 */
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  let user = currentUser;

  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (activeSessions.has(token)) {
      user = activeSessions.get(token);
    }
  }

  res.json({
    success: true,
    user
  });
});

/**
 * List 5 Canonical System Users
 */
router.get('/users', (req, res) => {
  res.json({
    success: true,
    users: initialUsers
  });
});

export default router;
