import prisma from '../src/db/prisma.js';
import { createNotification, getUserNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../src/services/notificationService.js';
import { logAudit } from '../src/utils/audit.js';

async function runModule10Tests() {
  console.log('====================================================');
  console.log('🧪 Starting Module 10: Notifications & Audit Verification');
  console.log('====================================================\n');

  try {
    // 1. Fetch tenant with admin user and customer
    const tenant = await prisma.organization.findUnique({ where: { id: 'org-techworld-001' } });
    if (!tenant) throw new Error('Organization tenant org-techworld-001 not found.');

    const admin = await prisma.user.findFirst({ where: { tenantId: tenant.id, role: 'ADMIN' } });
    if (!admin) throw new Error('No admin user found in database for tenant.');

    const customer = await prisma.customer.findFirst({ where: { tenantId: tenant.id } });
    if (!customer) throw new Error('No customer found for tenant.');

    console.log(`✅ Organization Tenant resolved: ${tenant.name} (${tenant.id})`);
    console.log(`✅ Admin user resolved: ${admin.email}`);
    console.log(`✅ Customer resolved: ${customer.name} (${customer.id})\n`);

    // 2. Test Notification Creation for Admin User
    console.log('--- Test 1: Notification Creation for User ---');
    const notifUser = await createNotification({
      tenantId: tenant.id,
      recipientUserId: admin.id,
      recipientRole: 'ADMIN',
      type: 'APPROVAL_REQUIRED',
      title: 'Test Approval Needed',
      message: 'Quotation #DF360-TEST-001 requires admin approval due to risk score 85/100 and margin 12.5%.',
      entityType: 'QUOTATION',
      entityId: 'test-quote-101',
    });
    console.log('Created Notification ID:', notifUser?.id);
    if (!notifUser) throw new Error('Failed to create user notification.');
    console.log('✅ User notification created successfully.\n');

    // 3. Test Customer Sanitization
    console.log('--- Test 2: Notification Creation for Customer (Sanitization Check) ---');
    const notifCust = await createNotification({
      tenantId: tenant.id,
      recipientCustomerId: customer.id,
      recipientRole: 'CUSTOMER',
      type: 'QUOTE_APPROVED',
      title: 'Quote Terms Approved',
      message: 'Your quote is approved! Internal info: risk score 75/100 and margin 15% and internal comment: do not release early.',
      entityType: 'QUOTATION',
      entityId: 'test-quote-102',
    });
    console.log('Sanitized Customer Message:', notifCust?.message);
    if (notifCust?.message.includes('risk score 75/100') || notifCust?.message.includes('margin 15%')) {
      throw new Error('FAILED: Sensitive internal terms were NOT sanitized for customer recipient!');
    }
    console.log('✅ Customer content sanitization verified clean.\n');

    // 4. Test Unread Count & Query
    console.log('--- Test 3: Unread Count & Notification Retrieval ---');
    const unread = await getUnreadCount({ tenantId: tenant.id, recipientUserId: admin.id });
    console.log(`Unread count for Admin (${admin.email}):`, unread);

    const userNotifs = await getUserNotifications({
      tenantId: tenant.id,
      recipientUserId: admin.id,
      category: 'ALL',
      limit: 10,
    });
    console.log(`Retrieved ${userNotifs.data.length} notifications for Admin.`);
    if (userNotifs.data.length === 0) throw new Error('No notifications returned for user.');
    console.log('✅ Notification query & unread count operational.\n');

    // 5. Test Mark as Read & Mark All Read
    console.log('--- Test 4: Mark as Read & Mark All Read ---');
    const readResult = await markAsRead({
      notificationId: notifUser.id,
      tenantId: tenant.id,
      recipientUserId: admin.id,
    });
    console.log('Marked read status:', readResult?.isRead);

    await markAllAsRead({ tenantId: tenant.id, recipientUserId: admin.id });
    const postCount = await getUnreadCount({ tenantId: tenant.id, recipientUserId: admin.id });
    console.log(`Unread count post markAllAsRead: ${postCount}`);
    if (postCount !== 0) throw new Error('markAllAsRead failed to clear unread badge count.');
    console.log('✅ Mark as read & Mark all read operations verified.\n');

    // 6. Test Rich Audit Trail Logging with Sensitive Data Sanitization
    console.log('--- Test 5: Audit Trail Logging & Redaction ---');
    const auditLog = await logAudit({
      tenantId: tenant.id,
      userId: admin.id,
      actorRole: 'ADMIN',
      action: 'SYSTEM_SETTINGS_UPDATE',
      entityType: 'ORGANIZATION',
      entityId: tenant.id,
      description: 'Updated security policy and secret API token',
      metadata: {
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        settingName: 'SecurityEnforcement',
        enabled: true,
      },
    });
    console.log('Created AuditLog ID:', auditLog.id);
    console.log('Redacted Metadata:', JSON.stringify(auditLog.metadata));
    if (auditLog.metadata?.password !== '[REDACTED]' || auditLog.metadata?.token !== '[REDACTED]') {
      throw new Error('FAILED: Sensitive fields (password, token) were NOT redacted in audit log!');
    }
    console.log('✅ Audit log recording & sensitive redaction verified.\n');

    console.log('====================================================');
    console.log('🎉 ALL MODULE 10 VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================');

    process.exit(0);
  } catch (err) {
    console.error('❌ MODULE 10 VERIFICATION FAILED:', err);
    process.exit(1);
  }
}

runModule10Tests();
