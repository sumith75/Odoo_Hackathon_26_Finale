export function resolveTenant(req, res, next) {
  if (!req.tenantId) {
    return res.status(403).json({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: 'Tenant context could not be resolved.' },
    });
  }
  next();
}
