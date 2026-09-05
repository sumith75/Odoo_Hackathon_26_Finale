/**
 * pagination.js — Standardized Server-Side Pagination Utility
 *
 * Enforces safe boundary limits:
 * - Default page: 1
 * - Default limit: 20
 * - Maximum limit: 100 (strictly prevents unbounded memory exhaustion)
 *
 * Produces structured pagination metadata:
 * {
 *   page: 1,
 *   limit: 20,
 *   totalCount: 154,
 *   totalPages: 8,
 *   hasNextPage: true,
 *   hasPrevPage: false
 * }
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePaginationParams(query = {}) {
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) {
    page = DEFAULT_PAGE;
  }

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) {
    limit = DEFAULT_LIMIT;
  } else if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  const skip = (page - 1) * limit;
  const take = limit;

  return {
    page,
    limit,
    skip,
    take,
  };
}

export function buildPaginationMeta(totalCount, page, limit) {
  const totalPages = Math.ceil(totalCount / limit) || 1;

  return {
    page,
    limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export default {
  parsePaginationParams,
  buildPaginationMeta,
};
