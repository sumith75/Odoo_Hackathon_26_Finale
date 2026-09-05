// Production Idempotency Middleware (Requirement 9)
// Prevents duplicate charges, duplicate inventory allocations, and double invoice creation across clustered nodes.

import redis from '../config/redis.js';

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours

/**
 * Distributed Idempotency middleware for express
 * Checks 'Idempotency-Key' or 'x-idempotency-key' header
 */
export async function idempotencyMiddleware(req, res, next) {
  const key = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

  if (!key || req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const redisKey = `idempotency:${key}`;

  try {
    // Check if key has already been processed in distributed cache
    const cachedData = await redis.get(redisKey);
    if (cachedData) {
      const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
      res.setHeader('X-Cache', 'HIT-IDEMPOTENCY');
      res.setHeader('X-Idempotency-Key', key);
      return res.status(parsed.status).json(parsed.body);
    }
  } catch (err) {
    // Fall back to processing normally if cache lookup fails
    console.warn('[IDEMPOTENCY] Cache lookup error:', err.message);
  }

  // Intercept response to store result
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Only cache successful or client-side responses (not 5xx server errors)
    if (res.statusCode < 500) {
      redis.set(
        redisKey,
        JSON.stringify({
          status: res.statusCode,
          body,
          cachedAt: Date.now(),
        }),
        IDEMPOTENCY_TTL_SECONDS
      ).catch((err) => console.warn('[IDEMPOTENCY] Cache write error:', err.message));
    }
    res.setHeader('X-Idempotency-Key', key);
    return originalJson(body);
  };

  next();
}

export default idempotencyMiddleware;
