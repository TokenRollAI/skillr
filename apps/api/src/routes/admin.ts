import { Hono } from 'hono';
import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getDb } from '../db.js';
import { users, namespaces, skills, auditLogs } from '../models/schema.js';

export const adminRoutes = new Hono();

adminRoutes.use('*', requireAuth, requireRole('admin'));

// Stats
adminRoutes.get('/stats', async (c) => {
  const db = getDb();
  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [nsCount] = await db.select({ count: sql<number>`count(*)` }).from(namespaces);
  const [skillCount] = await db.select({ count: sql<number>`count(*)` }).from(skills);
  const [downloads] = await db.select({ total: sql<number>`coalesce(sum(${skills.downloads}), 0)` }).from(skills);

  return c.json({
    users: userCount?.count ?? 0,
    namespaces: nsCount?.count ?? 0,
    skills: skillCount?.count ?? 0,
    totalDownloads: downloads?.total ?? 0,
  });
});

// User list
adminRoutes.get('/users', async (c) => {
  const db = getDb();
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  const result = await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    role: users.role,
    createdAt: users.createdAt,
  }).from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json(result);
});

// Update user role
adminRoutes.put('/users/:id/role', async (c) => {
  const id = c.req.param('id');
  const { role } = await c.req.json();
  if (!['admin', 'viewer'].includes(role)) {
    return c.json({ error: 'Invalid role. Must be "admin" or "viewer".' }, 400);
  }

  const db = getDb();
  const result = await db.update(users)
    .set({ role, updatedAt: new Date().toISOString() })
    .where(eq(users.id, id))
    .returning();

  if (result.length === 0) return c.json({ error: 'User not found' }, 404);
  return c.json({ success: true, role });
});

// Audit logs
adminRoutes.get('/audit', async (c) => {
  const db = getDb();
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = (page - 1) * limit;
  const action = c.req.query('action');
  const from = c.req.query('from');
  const to = c.req.query('to');

  const conditions = [];
  if (action) conditions.push(eq(auditLogs.action, action));
  if (from) conditions.push(gte(auditLogs.createdAt, from));
  if (to) conditions.push(lte(auditLogs.createdAt, to));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db.select({
    id: auditLogs.id,
    userId: auditLogs.userId,
    action: auditLogs.action,
    resource: auditLogs.resource,
    details: auditLogs.details,
    createdAt: auditLogs.createdAt,
  }).from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json(result);
});
