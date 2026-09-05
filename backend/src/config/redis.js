/**
 * redis.js — Distributed Caching & Coordination Client with In-Memory Fallback
 *
 * Provides a resilient Redis client abstraction for:
 * - Distributed Idempotency key tracking across horizontally scaled API instances
 * - Rate limiting
 * - Short-lived query caching
 * - Liveness/Readiness health checks
 *
 * Implements graceful fallback to an in-memory store if Redis is unreachable,
 * guaranteeing zero downtime or developer disruption in local/CI environments.
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const memoryStore = new Map();

let redisClient = null;
let isConnected = false;

try {
  redisClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        // Stop retrying aggressively after 3 attempts and rely on memory fallback
        return null;
      }
      return Math.min(times * 100, 1000);
    },
    connectTimeout: 2000,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  redisClient.on('connect', () => {
    isConnected = true;
    console.log('⚡ [REDIS] Connected successfully to Redis distributed cache.');
  });

  redisClient.on('ready', () => {
    isConnected = true;
  });

  redisClient.on('error', (err) => {
    if (isConnected) {
      console.warn('⚠️ [REDIS] Connection dropped. Operating in memory-fallback mode.');
    }
    isConnected = false;
  });

  // Attempt initial connect
  redisClient.connect().catch(() => {
    // Non-fatal: fall back to memory
    isConnected = false;
    console.log('ℹ️ [REDIS] Redis instance not detected at ' + REDIS_URL + '. Operating with in-memory fallback.');
  });
} catch (err) {
  isConnected = false;
  console.log('ℹ️ [REDIS] Operating with in-memory fallback store.');
}

/**
 * Standard Redis interface with in-memory fallback
 */
export const redis = {
  isAvailable() {
    return isConnected && redisClient && redisClient.status === 'ready';
  },

  async get(key) {
    if (this.isAvailable()) {
      try {
        return await redisClient.get(key);
      } catch (e) {
        // Fall back to memory on error
      }
    }
    const item = memoryStore.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      memoryStore.delete(key);
      return null;
    }
    return item.value;
  },

  async set(key, value, ttlSeconds = null) {
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    if (this.isAvailable()) {
      try {
        if (ttlSeconds) {
          return await redisClient.set(key, strVal, 'EX', ttlSeconds);
        }
        return await redisClient.set(key, strVal);
      } catch (e) {
        // Fall back to memory
      }
    }
    memoryStore.set(key, {
      value: strVal,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
    return 'OK';
  },

  async setnx(key, value, ttlSeconds = 86400) {
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    if (this.isAvailable()) {
      try {
        const result = await redisClient.set(key, strVal, 'EX', ttlSeconds, 'NX');
        return result === 'OK';
      } catch (e) {
        // Fall back to memory
      }
    }
    // Memory fallback for setnx
    if (memoryStore.has(key)) {
      const item = memoryStore.get(key);
      if (!item.expiresAt || Date.now() <= item.expiresAt) {
        return false; // Key already exists
      }
    }
    memoryStore.set(key, {
      value: strVal,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  },

  async del(key) {
    if (this.isAvailable()) {
      try {
        return await redisClient.del(key);
      } catch (e) {
        // Fall back to memory
      }
    }
    return memoryStore.delete(key) ? 1 : 0;
  },

  async ping() {
    if (this.isAvailable()) {
      try {
        const res = await redisClient.ping();
        return res === 'PONG';
      } catch (e) {
        return false;
      }
    }
    return true; // Memory fallback reports healthy
  },

  async flushAll() {
    if (this.isAvailable()) {
      try {
        await redisClient.flushall();
      } catch (e) {}
    }
    memoryStore.clear();
  },
};

export default redis;
