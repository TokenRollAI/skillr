import { getDb } from '../db.js';
import { auditLogs } from '../models/schema.js';

export async function logAuditEvent(params: {
  userId?: string;
  action: string;
  resource?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  const db = getDb();
  await db.insert(auditLogs).values({ createdAt: new Date().toISOString(), ...params });
}
