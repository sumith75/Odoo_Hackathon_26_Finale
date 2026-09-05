import prisma from '../db/prisma.js';

export async function logAudit({ tenantId, userId, action, entityType, entityId, metadata }) {
  try {
    return await prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        metadata: metadata || undefined,
      },
    });
  } catch (err) {
    console.error('⚠️ [AUDIT LOG ERROR]:', err.message);
    return null;
  }
}
