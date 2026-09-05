import jwt from 'jsonwebtoken';
import prisma from '../db/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dealflow360-secret-key-2025';

export async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing token.' },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const audience = decoded.aud;

    // A customer-portal token may ONLY ever resolve as a Customer — it must
    // never be allowed to escalate into an internal User lookup, even if the
    // id happened to collide. This is what makes the customer portal a
    // structurally separate, restricted surface rather than just a
    // differently-styled internal screen.
    if (audience === 'customer-portal') {
      const customer = await prisma.customer.findUnique({
        where: { id: decoded.id },
        include: { tenant: true },
      });

      if (!customer) {
        return res.status(401).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Account no longer exists.' },
        });
      }

      if (customer.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCOUNT_DEACTIVATED', message: 'Your customer account has been deactivated.' },
        });
      }

      req.user = {
        id: customer.id,
        customerId: customer.id,
        name: customer.name,
        email: customer.email,
        role: 'CUSTOMER',
        status: customer.status,
        companyName: customer.companyName,
        tier: customer.tier,
        tenantId: customer.tenantId,
        organizationName: customer.tenant?.name || 'DealFlow360 Enterprise',
        currency: customer.currency || customer.tenant?.currency || 'INR',
      };
      req.tenantId = customer.tenantId;
      return next();
    }

    // An internal-user token (aud: 'internal') may ONLY ever resolve as a
    // User — it must never fall back to a Customer lookup.
    if (audience === 'internal') {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: { tenant: true },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Account no longer exists.' },
        });
      }

      if (user.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCOUNT_DEACTIVATED', message: 'Your account has been deactivated by the administrator.' },
        });
      }

      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone,
        tenantId: user.tenantId,
        organizationName: user.tenant?.name || 'DealFlow360 Enterprise',
        currency: user.tenant?.currency || 'INR',
        organization: user.tenant ? {
          id: user.tenant.id,
          name: user.tenant.name,
          currency: user.tenant.currency,
          address: user.tenant.address,
          companyEmail: user.tenant.companyEmail,
          phone: user.tenant.phone,
          industry: user.tenant.industry,
          country: user.tenant.country,
          timezone: user.tenant.timezone,
        } : null,
      };
      req.tenantId = user.tenantId;
      return next();
    }

    // Legacy token issued before the audience claim existed (pre-rollout,
    // expires naturally within JWT_EXPIRES of deployment) — fall back to the
    // old dual-lookup behavior rather than rejecting still-valid sessions.
    let user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { tenant: true },
    });

    if (!user) {
      // Check if this is an external Customer account
      const customer = await prisma.customer.findUnique({
        where: { id: decoded.id },
        include: { tenant: true },
      });

      if (customer) {
        if (customer.status !== 'ACTIVE') {
          return res.status(403).json({
            success: false,
            error: { code: 'ACCOUNT_DEACTIVATED', message: 'Your customer account has been deactivated.' },
          });
        }

        req.user = {
          id: customer.id,
          customerId: customer.id,
          name: customer.name,
          email: customer.email,
          role: 'CUSTOMER',
          status: customer.status,
          companyName: customer.companyName,
          tier: customer.tier,
          tenantId: customer.tenantId,
          organizationName: customer.tenant?.name || 'DealFlow360 Enterprise',
          currency: customer.currency || customer.tenant?.currency || 'INR',
        };
        req.tenantId = customer.tenantId;
        return next();
      }

      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Account no longer exists.' },
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_DEACTIVATED', message: 'Your account has been deactivated by the administrator.' },
      });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      phone: user.phone,
      tenantId: user.tenantId,
      organizationName: user.tenant?.name || 'DealFlow360 Enterprise',
      currency: user.tenant?.currency || 'INR',
      organization: user.tenant ? {
        id: user.tenant.id,
        name: user.tenant.name,
        currency: user.tenant.currency,
        address: user.tenant.address,
        companyEmail: user.tenant.companyEmail,
        phone: user.tenant.phone,
        industry: user.tenant.industry,
        country: user.tenant.country,
        timezone: user.tenant.timezone,
      } : null,
    };
    req.tenantId = user.tenantId;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired session token.' },
    });
  }
}
