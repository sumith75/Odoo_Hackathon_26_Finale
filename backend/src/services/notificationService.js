/**
 * notificationService.js — Centralized Event Notification Engine
 *
 * Provides resilient, event-driven notification management:
 * - createNotification(options)
 * - dispatchNotificationAsync(options)
 * - getUserNotifications(options)
 * - getUnreadCount(options)
 * - markAsRead(options)
 * - markAllAsRead(options)
 *
 * Enforces:
 * - Multi-tenant isolation
 * - Role-based customer sanitization (no internal risk, margin, cost, or rules leaked)
 * - Idempotency & duplicate notification prevention
 * - Deep linking to real workflow URLs
 * - Graceful fallback to background job queue
 */

import prisma from '../db/prisma.js';
import redis from '../config/redis.js';
import jobQueue from '../jobs/jobQueue.js';

const DUP_CACHE_TTL = 60; // 60 seconds deduplication window

/**
 * Sanitizes notification content for customer recipients
 */
function sanitizeCustomerNotification(payload) {
  let message = payload.message || '';

  // Remove internal risk scores, margin percentages, cost amounts, or ceiling rule text
  message = message.replace(/risk score \d+\/100/gi, '');
  message = message.replace(/margin \d+(\.\d+)?%/gi, '');
  message = message.replace(/discount ceiling \d+%/gi, '');
  message = message.replace(/internal comment:.*?($|\.)/gi, '');

  const metadata = payload.metadata ? { ...payload.metadata } : {};
  delete metadata.riskScore;
  delete metadata.riskLevel;
  delete metadata.marginAmount;
  delete metadata.marginPercentage;
  delete metadata.costAmount;
  delete metadata.discountCeiling;
  delete metadata.violations;
  delete metadata.internalComments;

  return {
    ...payload,
    message: message.trim(),
    metadata,
  };
}

/**
 * Derives canonical action URL for deep linking
 */
function deriveActionUrl(type, entityType, entityId, recipientRole) {
  if (!entityId) return '/notifications';

  if (recipientRole === 'CUSTOMER') {
    if (['QUOTATION', 'NEGOTIATION'].includes(entityType)) return `/customer/deal-room/${entityId}`;
    if (['INVOICE', 'PAYMENT'].includes(entityType)) return `/customer/invoices`;
    return `/customer`;
  }

  switch (type) {
    case 'APPROVAL_REQUIRED':
    case 'NEGOTIATION_REAPPROVAL_REQUIRED':
      return `/manager/approvals/${entityId}`;
    case 'QUOTE_SUBMITTED':
    case 'QUOTE_APPROVED':
    case 'QUOTE_REJECTED':
    case 'QUOTE_RETURNED':
    case 'CUSTOMER_NEGOTIATION_STARTED':
      return recipientRole === 'SALES_MANAGER'
        ? `/manager/approvals/${entityId}`
        : `/sales/deals`;
    case 'FULFILLMENT_REQUIRED':
    case 'FULFILLMENT_COMPLETED':
    case 'PARTIAL_FULFILLMENT':
    case 'INVENTORY_SHORTAGE':
      return `/finance/fulfillment`;
    case 'INVOICE_CREATED':
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_PENDING':
    case 'PAYMENT_OVERDUE':
    case 'RECURRING_BILLING_DUE':
      return `/finance/invoices`;
    case 'DEAL_HEALTH_ALERT':
      return `/manager/dashboard`;
    default:
      return `/manager/dashboard`;
  }
}

/**
 * Creates notification record in PostgreSQL with idempotency check
 */
export async function createNotification(options = {}) {
  let {
    tenantId,
    recipientUserId,
    recipientCustomerId,
    recipientRole = 'SALES_REP',
    type = 'SYSTEM_ALERT',
    title,
    message,
    entityType,
    entityId,
    actionUrl,
    metadata,
  } = options;

  if (!tenantId) {
    throw new Error('tenantId is required for notification creation.');
  }

  if (!recipientUserId && !recipientCustomerId) {
    throw new Error('A recipientUserId or recipientCustomerId must be specified.');
  }

  // Idempotency deduplication check via Redis
  const recipientKey = recipientUserId || recipientCustomerId;
  const dupKey = `notif:${tenantId}:${type}:${entityType || 'none'}:${entityId || 'none'}:${recipientKey}`;

  try {
    const isNew = await redis.setnx(dupKey, '1', DUP_CACHE_TTL);
    if (!isNew) {
      // Duplicate notification within 60s suppressed
      return null;
    }
  } catch (e) {
    // Non-fatal, proceed with creation
  }

  // Customer sanitization
  if (recipientCustomerId || recipientRole === 'CUSTOMER') {
    const sanitized = sanitizeCustomerNotification({ title, message, metadata });
    title = sanitized.title;
    message = sanitized.message;
    metadata = sanitized.metadata;
  }

  // Derive deep-link action URL if missing
  if (!actionUrl) {
    actionUrl = deriveActionUrl(type, entityType, entityId, recipientRole);
  }

  try {
    const notification = await prisma.notification.create({
      data: {
        tenantId,
        recipientUserId: recipientUserId || null,
        recipientCustomerId: recipientCustomerId || null,
        type,
        title,
        message,
        entityType: entityType || null,
        entityId: entityId ? String(entityId) : null,
        actionUrl,
        metadata: metadata || undefined,
      },
    });

    return notification;
  } catch (err) {
    console.error('[NOTIFICATION_CREATE_ERROR]:', err.message);
    return null;
  }
}

/**
 * Dispatches notification asynchronously via job queue
 */
export async function dispatchNotificationAsync(options = {}) {
  try {
    await jobQueue.enqueueJob('NOTIFICATION_DISPATCH', options);
  } catch (err) {
    // Fallback: execute synchronously if queue fails
    await createNotification(options);
  }
}

/**
 * Retrieves paginated notifications for recipient
 */
export async function getUserNotifications({
  tenantId,
  recipientUserId,
  recipientCustomerId,
  category, // 'ALL', 'UNREAD', 'APPROVALS', 'NEGOTIATIONS', 'FULFILLMENT', 'BILLING', 'SYSTEM'
  page = 1,
  limit = 20,
}) {
  const where = { tenantId };

  if (recipientUserId) {
    where.recipientUserId = recipientUserId;
  } else if (recipientCustomerId) {
    where.recipientCustomerId = recipientCustomerId;
  } else {
    return { data: [], pagination: { total: 0, page: 1, limit, totalPages: 0 } };
  }

  if (category === 'UNREAD') {
    where.isRead = false;
  } else if (category === 'APPROVALS') {
    where.type = { in: ['APPROVAL_REQUIRED', 'QUOTE_SUBMITTED', 'QUOTE_APPROVED', 'QUOTE_REJECTED', 'QUOTE_RETURNED', 'NEGOTIATION_REAPPROVAL_REQUIRED'] };
  } else if (category === 'NEGOTIATIONS') {
    where.type = { in: ['CUSTOMER_NEGOTIATION_STARTED', 'NEGOTIATION_APPROVED', 'QUOTE_UPDATED'] };
  } else if (category === 'FULFILLMENT') {
    where.type = { in: ['FULFILLMENT_REQUIRED', 'FULFILLMENT_COMPLETED', 'PARTIAL_FULFILLMENT', 'INVENTORY_SHORTAGE'] };
  } else if (category === 'BILLING') {
    where.type = { in: ['INVOICE_CREATED', 'PAYMENT_RECEIVED', 'PAYMENT_PENDING', 'PAYMENT_OVERDUE', 'RECURRING_BILLING_DUE', 'SUBSCRIPTION_CREATED'] };
  } else if (category === 'SYSTEM') {
    where.type = { in: ['DEAL_HEALTH_ALERT', 'SYSTEM_ALERT'] };
  }

  const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * take;

  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  return {
    data: notifications,
    pagination: {
      total,
      page: parseInt(page, 10) || 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    },
  };
}

/**
 * Returns unread notifications count for recipient
 */
export async function getUnreadCount({ tenantId, recipientUserId, recipientCustomerId }) {
  const where = { tenantId, isRead: false };
  if (recipientUserId) where.recipientUserId = recipientUserId;
  else if (recipientCustomerId) where.recipientCustomerId = recipientCustomerId;
  else return 0;

  return await prisma.notification.count({ where });
}

/**
 * Marks single notification as read
 */
export async function markAsRead({ notificationId, tenantId, recipientUserId, recipientCustomerId }) {
  const where = { id: notificationId, tenantId };
  if (recipientUserId) where.recipientUserId = recipientUserId;
  if (recipientCustomerId) where.recipientCustomerId = recipientCustomerId;

  const notif = await prisma.notification.findFirst({ where });
  if (!notif) return null;

  return await prisma.notification.update({
    where: { id: notif.id },
    data: { isRead: true, readAt: new Date() },
  });
}

/**
 * Marks all unread notifications for recipient as read
 */
export async function markAllAsRead({ tenantId, recipientUserId, recipientCustomerId }) {
  const where = { tenantId, isRead: false };
  if (recipientUserId) where.recipientUserId = recipientUserId;
  if (recipientCustomerId) where.recipientCustomerId = recipientCustomerId;

  return await prisma.notification.updateMany({
    where,
    data: { isRead: true, readAt: new Date() },
  });
}
