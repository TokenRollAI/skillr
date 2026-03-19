import { Hono } from 'hono';
import { eq, and, or, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireNsRole } from '../middleware/auth.js';
import { getDb } from '../db.js';
import { namespaces, nsMembers } from '../models/schema.js';
import { users } from '../models/schema.js';

export const namespaceRoutes = new Hono();

const createSchema = z.object({
  name: z.string().min(2).max(64).regex(/^@[a-z0-9][a-z0-9-]*$/),
  description: z.string().optional(),
  visibility: z.enum(['public', 'internal', 'private']).default('internal'),
});

// Create namespace
namespaceRoutes.post('/', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const db = getDb();
  const user = c.get('user' as never) as { sub: string };

  try {
    const [ns] = await db.insert(namespaces).values(parsed.data).returning();
    // Add creator as maintainer
    await db.insert(nsMembers).values({
      userId: user.sub,
      namespaceId: ns!.id,
      role: 'maintainer',
    });
    return c.json(ns, 201);
  } catch (err: any) {
    if (err.code === '23505') return c.json({ error: 'Namespace already exists' }, 409);
    throw err;
  }
});

// List namespaces
namespaceRoutes.get('/', async (c) => {
  const db = getDb();

  // Optional auth - extract user if present
  let userId: string | undefined;
  let userRole: string | undefined;
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { verifyJwt } = await import('../utils/jwt.js');
      const payload = await verifyJwt(authHeader.slice(7));
      userId = payload.sub;
      userRole = payload.role;
    } catch {
      // Token invalid, treat as unauthenticated
    }
  }

  // Admin sees all
  if (userRole === 'admin') {
    const result = await db.select().from(namespaces).orderBy(namespaces.name);
    return c.json(result);
  }

  if (!userId) {
    // Unauthenticated: only public namespaces
    const result = await db.select().from(namespaces)
      .where(eq(namespaces.visibility, 'public'))
      .orderBy(namespaces.name);
    return c.json(result);
  }

  // Authenticated: public + internal + private namespaces where user is member
  const publicInternal = await db.select().from(namespaces)
    .where(or(eq(namespaces.visibility, 'public'), eq(namespaces.visibility, 'internal')))
    .orderBy(namespaces.name);

  const privateMemberships = await db.select({ namespaceId: nsMembers.namespaceId })
    .from(nsMembers)
    .innerJoin(namespaces, eq(nsMembers.namespaceId, namespaces.id))
    .where(and(eq(nsMembers.userId, userId), eq(namespaces.visibility, 'private')));

  const privateIds = privateMemberships.map(m => m.namespaceId);
  let privateNs: typeof publicInternal = [];
  if (privateIds.length > 0) {
    privateNs = await db.select().from(namespaces)
      .where(inArray(namespaces.id, privateIds))
      .orderBy(namespaces.name);
  }

  const result = [...publicInternal, ...privateNs].sort((a, b) => a.name.localeCompare(b.name));
  return c.json(result);
});

// Get namespace
namespaceRoutes.get('/:name', async (c) => {
  const name = c.req.param('name');
  const db = getDb();
  const [ns] = await db.select().from(namespaces).where(eq(namespaces.name, name)).limit(1);
  if (!ns) return c.json({ error: 'Namespace not found' }, 404);

  // Check visibility
  if (ns.visibility !== 'public') {
    let userId: string | undefined;
    let userRole: string | undefined;
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { verifyJwt } = await import('../utils/jwt.js');
        const payload = await verifyJwt(authHeader.slice(7));
        userId = payload.sub;
        userRole = payload.role;
      } catch {
        // Token invalid
      }
    }

    if (userRole !== 'admin') {
      if (ns.visibility === 'internal' && !userId) {
        return c.json({ error: 'Namespace not found' }, 404);
      }
      if (ns.visibility === 'private') {
        if (!userId) return c.json({ error: 'Namespace not found' }, 404);
        const [membership] = await db.select().from(nsMembers)
          .where(and(eq(nsMembers.userId, userId), eq(nsMembers.namespaceId, ns.id)))
          .limit(1);
        if (!membership) return c.json({ error: 'Namespace not found' }, 404);
      }
    }
  }

  return c.json(ns);
});

// Add member
namespaceRoutes.post('/:name/members', requireAuth, requireNsRole('name', 'maintainer'), async (c) => {
  const name = c.req.param('name');
  const { userId, role } = await c.req.json();
  const db = getDb();

  const [ns] = await db.select().from(namespaces).where(eq(namespaces.name, name)).limit(1);
  if (!ns) return c.json({ error: 'Namespace not found' }, 404);

  try {
    await db.insert(nsMembers).values({ userId, namespaceId: ns.id, role: role || 'viewer' });
    return c.json({ success: true }, 201);
  } catch (err: any) {
    if (err.code === '23505') return c.json({ error: 'User is already a member' }, 409);
    throw err;
  }
});

// List members
namespaceRoutes.get('/:name/members', async (c) => {
  const name = c.req.param('name');
  const db = getDb();

  const [ns] = await db.select().from(namespaces).where(eq(namespaces.name, name)).limit(1);
  if (!ns) return c.json({ error: 'Namespace not found' }, 404);

  const members = await db.select({
    userId: nsMembers.userId,
    role: nsMembers.role,
    username: users.username,
    email: users.email,
  }).from(nsMembers)
    .innerJoin(users, eq(nsMembers.userId, users.id))
    .where(eq(nsMembers.namespaceId, ns.id));

  return c.json(members);
});

// Remove member
namespaceRoutes.delete('/:name/members/:userId', requireAuth, requireNsRole('name', 'maintainer'), async (c) => {
  const name = c.req.param('name');
  const userId = c.req.param('userId');
  const db = getDb();

  const [ns] = await db.select().from(namespaces).where(eq(namespaces.name, name)).limit(1);
  if (!ns) return c.json({ error: 'Namespace not found' }, 404);

  await db.delete(nsMembers).where(
    eq(nsMembers.userId, userId)
  );

  return c.json({ success: true });
});
