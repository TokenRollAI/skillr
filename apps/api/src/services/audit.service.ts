import { getDb } from '../db.js';
import { auditLogs } from '../models/schema.js';
import { desc, eq, and, gte, lte } from 'drizzle-orm';

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

export async function queryAuditLogs(filters: {
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  const db = getDb();
  const conditions = [];
  if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
  if (filters.userId) conditions.push(eq(auditLogs.userId, filters.userId));
  if (filters.from) conditions.push(gte(auditLogs.createdAt, filters.from));
  if (filters.to) conditions.push(lte(auditLogs.createdAt, filters.to));

  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const offset = (page - 1) * limit;

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return db.select().from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);
}
