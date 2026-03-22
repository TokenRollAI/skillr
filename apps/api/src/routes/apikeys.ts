import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env.js';
import { requireAuth } from '../middleware/auth.js';
import * as apikeyService from '../services/apikey.service.js';
import { logAuditEvent } from '../services/audit.service.js';

export const apikeyRoutes = new Hono<AppEnv>();

const createSchema = z.object({
  name: z.string().min(1).max(128),
  scopes: z.array(z.enum(['read', 'write', 'admin'])).default(['read']),
  expiresIn: z.enum(['30d', '90d', '365d', 'never']).default('never'),
});

apikeyRoutes.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  let expiresAt: Date | undefined;
  if (parsed.data.expiresIn !== 'never') {
    const days = parseInt(parsed.data.expiresIn);
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  const result = await apikeyService.createApiKey(user.sub, parsed.data.name, parsed.data.scopes, expiresAt);

  await logAuditEvent({
    userId: user.sub,
    action: 'apikey.create',
    resource: result.name,
  });

  return c.json(result, 201);
});

apikeyRoutes.get('/', requireAuth, async (c) => {
  const user = c.get('user');
  const keys = await apikeyService.listApiKeys(user.sub);
  return c.json(keys);
});

apikeyRoutes.get('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const key = await apikeyService.getApiKey(id, user.sub);
  if (!key) return c.json({ error: 'API Key not found' }, 404);
  return c.json(key);
});

apikeyRoutes.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const revoked = await apikeyService.revokeApiKey(id, user.sub);
  if (!revoked) return c.json({ error: 'API Key not found' }, 404);

  await logAuditEvent({
    userId: user.sub,
    action: 'apikey.revoke',
    resource: id,
  });

  return c.json({ success: true });
});

apikeyRoutes.post('/:id/rotate', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const result = await apikeyService.rotateApiKey(id, user.sub);
  if (!result) return c.json({ error: 'API Key not found' }, 404);

  await logAuditEvent({
    userId: user.sub,
    action: 'apikey.rotate',
    resource: id,
  });

  return c.json(result, 201);
});
