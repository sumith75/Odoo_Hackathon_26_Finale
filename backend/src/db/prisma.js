/**
 * prisma.js — Singleton Prisma Client
 * Import this wherever you need database access.
 *
 * Usage:
 *   import prisma from '../db/prisma.js';
 *   const users = await prisma.user.findMany();
 */

import 'dotenv/config';
// import { PrismaClient } from '@prisma/client';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis;

let prisma = globalForPrisma.prisma;

if (!prisma) {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
  });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
      ? ['warn', 'error']
      : ['warn', 'error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
  }
}

export default prisma;
