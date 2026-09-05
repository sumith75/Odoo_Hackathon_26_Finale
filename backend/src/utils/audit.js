/**
 * audit.js — Centralized Immutable Audit Trail Utility
 *
 * Records append-only, traceable business action logs across DealFlow360.
 * Automatically sanitizes sensitive data (passwords, tokens, payment secrets).
 */

import prisma from '../db/prisma.js';

/**
 * Sanitizes object data by stripping sensitive keys
 */
function sanitizeData(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeData);

  const clean = {};
  const SENSITIVE_KEYS = [
    'password',
    'passwordhash',
    'password_hash',
    'token',
    'secret',
    'cardnumber',
    'cvv',
    'authorization',
  ];

  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = sanitizeData(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Main append-only audit logger
 */
export async function logAudit({
  tenantId,
  userId,
  actorRole,
  action,
  entityType,
  entityId,
  description,
  beforeState,
  afterState,
  metadata,
  ipAddress,
  userAgent,
}) {
  if (!tenantId || !action || !entityType) {
    return null;
  }

  try {
    const cleanBefore = beforeState ? sanitizeData(beforeState) : undefined;
    const cleanAfter = afterState ? sanitizeData(afterState) : undefined;
    const cleanMetadata = metadata ? sanitizeData(metadata) : undefined;

    return await prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        actorRole: actorRole || null,
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        description: description || null,
        beforeState: cleanBefore || undefined,
        afterState: cleanAfter || undefined,
        metadata: cleanMetadata || undefined,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
  } catch (err) {
    console.error('⚠️ [AUDIT LOG ERROR]:', err.message);
    return null;
  }
}
