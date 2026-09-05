// Production Idempotency Middleware (Point 12)
// Prevents duplicate charges, duplicate inventory allocations, and double invoice creation.

const idempotencyStore = new Map();

/**
 * Idempotency middleware for express
 * Checks 'Idempotency-Key' or 'x-idempotency-key' header
 */
export function idempotencyMiddleware(req, res, next) {
  const key = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

  if (!key) {
    return next();
  }

  // Check if we already processed this exact key
  if (idempotencyStore.has(key)) {
    const cached = idempotencyStore.get(key);
    res.setHeader('X-Cache', 'HIT-IDEMPOTENCY');
    res.setHeader('X-Idempotency-Key', key);
    return res.status(cached.status).json(cached.body);
  }

  // Intercept response to store result
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Only cache successful or client-side responses (not 5xx errors)
    if (res.statusCode < 500) {
      idempotencyStore.set(key, {
        status: res.statusCode,
        body,
        cachedAt: Date.now()
      });
    }
    res.setHeader('X-Idempotency-Key', key);
    return originalJson(body);
  };

  next();
}

/**
 * Clear expired keys (older than 24 hours)
 */
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;
  for (const [key, val] of idempotencyStore.entries()) {
    if (now - val.cachedAt > maxAge) {
      idempotencyStore.delete(key);
    }
  }
}, 60 * 60 * 1000);
