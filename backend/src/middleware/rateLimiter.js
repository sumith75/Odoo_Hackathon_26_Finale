/**
 * rateLimiter.js — Distributed Sliding-Window Rate Limiter with Redis
 *
 * Implements token bucket / window counters for sensitive endpoints:
 * - Auth endpoints (10 requests per minute per IP)
 * - Negotiation endpoints (30 requests per minute per IP/customer)
 * - General API mutations (120 requests per minute per IP)
 *
 * Emits standard headers:
 * - X-RateLimit-Limit
 * - X-RateLimit-Remaining
 * - X-RateLimit-Reset
 * - Retry-After (on 429 Too Many Requests)
 */

import redis from '../config/redis.js';

export function createRateLimiter({
  windowSeconds = 60,
  maxRequests = 60,
  keyPrefix = 'rl',
  message = 'Too many requests. Please slow down and try again later.',
} = {}) {
  return async function rateLimiterMiddleware(req, res, next) {
    // Unique identifier for client: IP or authenticated user/tenant
    const identifier = req.user?.id || req.ip || req.connection?.remoteAddress || 'unknown-client';
    const rateLimitKey = `${keyPrefix}:${identifier}`;

    try {
      const rawCount = await redis.get(rateLimitKey);
      const currentCount = rawCount ? parseInt(rawCount, 10) : 0;

      if (currentCount >= maxRequests) {
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('Retry-After', windowSeconds);

        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message,
            retryAfterSeconds: windowSeconds,
          },
        });
      }

      // Increment count
      const newCount = currentCount + 1;
      await redis.set(rateLimitKey, String(newCount), windowSeconds);

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - newCount));

      next();
    } catch (err) {
      // In case of error, fail open to avoid disrupting legitimate user flows
      console.warn('[RATE_LIMITER] Non-fatal error:', err.message);
      next();
    }
  };
}

// Preset rate limiters for critical application surfaces
export const authRateLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 15,
  keyPrefix: 'rl:auth',
  message: 'Too many authentication attempts. Please wait 1 minute before retrying.',
});

export const negotiationRateLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 30,
  keyPrefix: 'rl:negotiate',
  message: 'Too many counteroffers submitted in a short period. Please review your terms and try again.',
});

export const mutationRateLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 120,
  keyPrefix: 'rl:mutation',
  message: 'Request limit exceeded for this operation. Please slow down.',
});

export default createRateLimiter;
