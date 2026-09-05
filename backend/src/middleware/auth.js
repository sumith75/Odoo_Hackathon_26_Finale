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
      tenantId: user.tenantId,
      organizationName: user.tenant?.name || 'DealFlow360 Enterprise',
      currency: user.tenant?.currency || 'INR',
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
