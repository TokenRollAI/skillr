import { Hono } from 'hono';
import type { AppEnv } from '../env.js';
import { getDb } from '../db.js';
import { checkR2Connection } from '../lib/storage.js';
import { sql } from 'drizzle-orm';

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get('/', async (c) => {
  let dbStatus = 'disconnected';
  let r2Status = 'disconnected';

  try {
    const db = getDb();
    await db.run(sql`SELECT 1`);
    dbStatus = 'connected';
  } catch {}

  try {
    const ok = await checkR2Connection();
    r2Status = ok ? 'connected' : 'disconnected';
  } catch {}

  const status = dbStatus === 'connected' ? 'ok' : 'degraded';
  return c.json({ status, db: dbStatus, r2: r2Status });
});
