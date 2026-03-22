import { createMiddleware } from 'hono/factory';
import { eq, and } from 'drizzle-orm';
import type { AppEnv } from '../env.js';
import { verifyJwt, type JwtPayload } from '../utils/jwt.js';
import { getDb } from '../db.js';
import { namespaces, nsMembers } from '../models/schema.js';

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const token = authHeader.slice(7);

  // API Key authentication
  if (token.startsWith('sk_live_')) {
    const { validateApiKey } = await import('../services/apikey.service.js');
    const payload = await validateApiKey(token);
    if (!payload) {
      return c.json({ error: 'Invalid or revoked API key' }, 401);
    }
    c.set('user', payload as JwtPayload);
    await next();
    return;
  }

  // JWT authentication
  try {
    const payload = await verifyJwt(token);
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
});

export const requireRole = (role: string) => createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  if (user.role !== role && user.role !== 'admin') {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }
  await next();
});

export const requireNsRole = (nsParamName: string, ...allowedRoles: string[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Authentication required' }, 401);

    // Admin bypasses namespace checks
    if (user.role === 'admin') {
      await next();
      return;
    }

    const nsName = c.req.param(nsParamName);
    if (!nsName) return c.json({ error: 'Namespace parameter missing' }, 400);

    const db = getDb();
    const [ns] = await db.select().from(namespaces).where(eq(namespaces.name, nsName)).limit(1);
    if (!ns) return c.json({ error: 'Namespace not found' }, 404);

    const [membership] = await db.select().from(nsMembers)
      .where(and(
        eq(nsMembers.userId, user.sub),
        eq(nsMembers.namespaceId, ns.id),
      )).limit(1);

    if (!membership || !allowedRoles.includes(membership.role)) {
      return c.json({ error: 'Insufficient permissions for this namespace' }, 403);
    }

    await next();
  });
