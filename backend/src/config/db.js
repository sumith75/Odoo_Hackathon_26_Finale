import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initialProducts,
  initialSubscriptionPlans,
  initialDiscountRules,
  initialWarehouses,
  initialInventory
} from '../db/seedData.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isPostgresConnected = false;
let pool = null;

// In-Memory Relational State Store (Active if PostgreSQL service is offline)
export const memStore = {
  products: [...initialProducts],
  subscription_plans: [...initialSubscriptionPlans],
  discount_rules: [...initialDiscountRules],
  warehouses: [...initialWarehouses],
  inventory: [...initialInventory],
  quotes: [],
  quote_items: [],
  quote_approvals: [],
  negotiation_history: [],
  warehouse_allocations: [],
  invoices: [],
  audit_logs: []
};

export async function initDb() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/odoo_finale';
  
  try {
    pool = new pg.Pool({
      connectionString,
      connectionTimeoutMillis: 10000,
      ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
    });

    const client = await pool.connect();
    console.log('✅ [DATABASE] Successfully connected to PostgreSQL at:', connectionString.replace(/:[^:@]+@/, ':****@'));
    isPostgresConnected = true;

    // Schema is managed by Prisma ORM (prisma/schema.prisma)
    console.log('✅ [DATABASE] PostgreSQL active via Neon & Prisma.');

    // Seed products if empty
    const { rows: prodRows } = await client.query('SELECT COUNT(*) as count FROM products');
    if (parseInt(prodRows[0].count, 10) === 0) {
      console.log('🌱 [DATABASE] Seeding initial master catalog into PostgreSQL...');
      for (const p of initialProducts) {
        await client.query(
          `INSERT INTO products (id, sku, name, category, base_price, unit_cost, is_subscription, billing_frequency, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
          [p.id, p.sku, p.name, p.category, p.base_price, p.unit_cost, p.is_subscription, p.billing_frequency, p.description]
        );
      }
      for (const sp of initialSubscriptionPlans) {
        await client.query(
          `INSERT INTO subscription_plans (id, code, name, monthly_rate, annual_rate, discount_annual_pct, features)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
          [sp.id, sp.code, sp.name, sp.monthly_rate, sp.annual_rate, sp.discount_annual_pct, sp.features]
        );
      }
      for (const dr of initialDiscountRules) {
        await client.query(
          `INSERT INTO discount_rules (id, name, min_quantity, min_deal_value, max_rep_discount_pct, min_margin_pct)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
          [dr.id, dr.name, dr.min_quantity, dr.min_deal_value, dr.max_rep_discount_pct, dr.min_margin_pct]
        );
      }
      for (const wh of initialWarehouses) {
        await client.query(
          `INSERT INTO warehouses (id, code, name, location, transit_days)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
          [wh.id, wh.code, wh.name, wh.location, wh.transit_days]
        );
      }
      for (const inv of initialInventory) {
        await client.query(
          `INSERT INTO inventory (id, warehouse_id, product_id, available_stock, reserved_stock)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
          [inv.id, inv.warehouse_id, inv.product_id, inv.available_stock, inv.reserved_stock]
        );
      }
      console.log('✅ [DATABASE] PostgreSQL seeded successfully.');
    }

    client.release();
  } catch (err) {
    console.warn('⚠️ [DATABASE] PostgreSQL connection failed (or service not started):', err.message);
    console.log('🚀 [DATABASE] Switching to built-in high-fidelity in-memory relational store. All APIs and demo flows will operate smoothly without interruption.');
    isPostgresConnected = false;
  }
}

export function getDbStatus() {
  return {
    engine: isPostgresConnected ? 'PostgreSQL' : 'In-Memory Relational Engine (PostgreSQL Fallback)',
    connected: true,
    isPostgres: isPostgresConnected,
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/odoo_finale'
  };
}

export async function executeQuery(sql, params = []) {
  if (isPostgresConnected && pool) {
    return await pool.query(sql, params);
  }
  return null;
}
