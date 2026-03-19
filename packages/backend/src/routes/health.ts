import { Hono } from 'hono';
import { getDb } from '../db.js';
import { checkS3Connection } from '../services/storage.service.js';
import { sql } from 'drizzle-orm';

export const healthRoutes = new Hono();

healthRoutes.get('/', async (c) => {
  let dbStatus = 'disconnected';
  let s3Status = 'disconnected';

  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    dbStatus = 'connected';
  } catch {}

  try {
    const s3Ok = await checkS3Connection();
    s3Status = s3Ok ? 'connected' : 'disconnected';
  } catch {}

  const status = dbStatus === 'connected' ? 'ok' : 'degraded';
  return c.json({ status, db: dbStatus, s3: s3Status });
});
