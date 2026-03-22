import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import * as authService from '../services/auth.service.js';
import { getFrontendUrl } from '../env.js';
import { logAuditEvent } from '../services/audit.service.js';
import { hashPassword, verifyPassword } from '../lib/password.js';

const registerSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  password: z.string().min(6),
});

const deviceApproveSchema = z.object({
  user_code: z.string().length(8),
});

const deviceTokenSchema = z.object({
  device_code: z.string(),
  grant_type: z.string(),
});

export const authRoutes = new Hono();

authRoutes.post('/register', async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const user = await authService.registerUser(parsed.data.username, parsed.data.email, parsed.data.password);
    await logAuditEvent({
      userId: user!.id,
      action: 'user.register',
      resource: user!.username,
    });
    return c.json({ id: user!.id, username: user!.username, email: user!.email }, 201);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Username or email already exists' }, 409);
    }
    throw err;
  }
});

authRoutes.post('/device/code', async (c) => {
  const result = await authService.createDeviceCode();
  const frontendUrl = getFrontendUrl();
  return c.json({
    device_code: result.deviceCode,
    user_code: result.userCode,
    verification_uri: `${frontendUrl}/device`,
    expires_in: 900,
    interval: 5,
  });
});

authRoutes.post('/device/approve', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = deviceApproveSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid user_code format' }, 400);
  }

  const user = c.get('user' as never) as { sub: string };
  const result = await authService.approveDeviceCode(parsed.data.user_code, user.sub);

  if ('error' in result) {
    const err = result.error as string;
    const statusMap: Record<string, number> = { invalid_code: 404, already_used: 409, expired: 410 };
    return c.json({ error: err }, (statusMap[err] || 400) as any);
  }

  return c.json({ success: true });
});

authRoutes.post('/device/token', async (c) => {
  const body = await c.req.json();
  const parsed = deviceTokenSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request' }, 400);
  }

  const result = await authService.pollDeviceToken(parsed.data.device_code);

  if ('error' in result) {
    return c.json(result, 200); // OAuth spec: errors are 200 with error field
  }

  return c.json(result);
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Username and password are required' }, 400);
  }

  const result = await authService.authenticateUser(parsed.data.username, parsed.data.password);
  if (!result) {
    return c.json({ error: 'Invalid username or password' }, 401);
  }

  await logAuditEvent({
    userId: result.user.id,
    action: 'user.login',
    resource: result.user.username,
    ipAddress: c.req.header('x-forwarded-for') || 'unknown',
    userAgent: c.req.header('user-agent') || 'unknown',
  });

  return c.json({
    token: result.token,
    user: {
      id: result.user.id,
      username: result.user.username,
      email: result.user.email,
      role: result.user.role,
    },
  });
});

authRoutes.get('/me', requireAuth, async (c) => {
  const jwtUser = c.get('user' as never) as { sub: string };
  const user = await authService.getUserById(jwtUser.sub);
  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json(user);
});

authRoutes.put('/password', requireAuth, async (c) => {
  const user = c.get('user' as never) as { sub: string };
  const body = await c.req.json();
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed' }, 400);

  const authResult = await authService.getUserById(user.sub);
  if (!authResult) return c.json({ error: 'User not found' }, 404);

  const db = (await import('../db.js')).getDb();
  const { users } = await import('../models/schema.js');
  const { eq } = await import('drizzle-orm');
  const [fullUser] = await db.select().from(users).where(eq(users.id, user.sub)).limit(1);
  if (!fullUser?.passwordHash) return c.json({ error: 'Cannot change password' }, 400);

  const valid = await verifyPassword(fullUser.passwordHash, parsed.data.currentPassword);
  if (!valid) return c.json({ error: 'Current password is incorrect' }, 401);

  const newHash = await hashPassword(parsed.data.newPassword);
  await db.update(users).set({ passwordHash: newHash, updatedAt: new Date().toISOString() }).where(eq(users.id, user.sub));

  await logAuditEvent({ userId: user.sub, action: 'user.password_change' });

  return c.json({ success: true });
});
