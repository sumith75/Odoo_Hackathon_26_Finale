/**
 * seedDemo.js — Resettable Demo Seed Script for DealFlow360
 *
 * Runs seed logic from prisma/seed.js to reset/re-seed demo data.
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '../../');

console.log('🌱 [SEED:DEMO] Starting DealFlow360 demo database seeding...');
try {
  execSync('node prisma/seed.js', { cwd: backendDir, stdio: 'inherit' });
  console.log('✅ [SEED:DEMO] Database successfully seeded for demo execution!');
} catch (err) {
  console.error('❌ [SEED:DEMO] Failed to seed demo database:', err);
  process.exit(1);
}
