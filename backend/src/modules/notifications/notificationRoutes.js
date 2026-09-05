/**
 * notificationRoutes.js — REST APIs for In-App Notifications
 *
 * Endpoints:
 * - GET   /api/notifications
 * - GET   /api/notifications/unread-count
 * - PATCH /api/notifications/:id/read
 * - POST  /api/notifications/read-all
 *
 * Protection:
 * - Authenticated user or customer token required
 * - Multi-tenant isolated (tenantId from token)
 * - Recipient-isolated (only own notifications accessible)
 */

import express from 'express';
import { authenticateUser } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../../services/notificationService.js';

const router = express.Router();

router.use(authenticateUser);
router.use(resolveTenant);

/**
 * GET /api/notifications
 * Retrieve paginated notifications for authenticated user/customer
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const recipientUserId = req.user?.role !== 'CUSTOMER' ? req.user?.id : null;
    const recipientCustomerId = req.user?.role === 'CUSTOMER' ? req.user?.id : null;

    const { category = 'ALL', page = 1, limit = 20 } = req.query;

    const result = await getUserNotifications({
      tenantId,
      recipientUserId,
      recipientCustomerId,
      category: category.toUpperCase(),
      page,
      limit,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    console.error('[NOTIFICATIONS_FETCH_ERROR]:', err);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to retrieve notifications.' },
    });
  }
});

/**
 * GET /api/notifications/unread-count
 * Unread notifications badge count
 */
router.get('/unread-count', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const recipientUserId = req.user?.role !== 'CUSTOMER' ? req.user?.id : null;
    const recipientCustomerId = req.user?.role === 'CUSTOMER' ? req.user?.id : null;

    const count = await getUnreadCount({
      tenantId,
      recipientUserId,
      recipientCustomerId,
    });

    res.json({
      success: true,
      count,
    });
  } catch (err) {
    console.error('[UNREAD_COUNT_ERROR]:', err);
    res.status(500).json({
      success: false,
      error: { code: 'COUNT_ERROR', message: 'Failed to fetch unread notification count.' },
    });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark single notification as read
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const recipientUserId = req.user?.role !== 'CUSTOMER' ? req.user?.id : null;
    const recipientCustomerId = req.user?.role === 'CUSTOMER' ? req.user?.id : null;

    const updated = await markAsRead({
      notificationId: req.params.id,
      tenantId,
      recipientUserId,
      recipientCustomerId,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found or access denied.' },
      });
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error('[MARK_READ_ERROR]:', err);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to mark notification as read.' },
    });
  }
});

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read for current user
 */
router.post('/read-all', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const recipientUserId = req.user?.role !== 'CUSTOMER' ? req.user?.id : null;
    const recipientCustomerId = req.user?.role === 'CUSTOMER' ? req.user?.id : null;

    const result = await markAllAsRead({
      tenantId,
      recipientUserId,
      recipientCustomerId,
    });

    res.json({
      success: true,
      message: 'All notifications marked as read.',
      count: result.count,
    });
  } catch (err) {
    console.error('[MARK_ALL_READ_ERROR]:', err);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to mark all notifications as read.' },
    });
  }
});

export default router;
