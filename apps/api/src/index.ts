import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { AppEnv } from './env.js';
import { setEnvFromBindings, getFrontendUrl } from './env.js';
import { initDb } from './db.js';
import { setBucket } from './lib/storage.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { skillsRoutes } from './routes/skills.js';
import { namespaceRoutes } from './routes/namespaces.js';
import { apikeyRoutes } from './routes/apikeys.js';
import { adminRoutes } from './routes/admin.js';
import { mcpRoutes } from './routes/mcp.js';

const app = new Hono<AppEnv>();

// Per-request initialization middleware
app.use('*', async (c, next) => {
  setEnvFromBindings(c.env);
  initDb(c.env.DB);
  setBucket(c.env.ARTIFACTS);
  await next();
});

// Global middleware
app.use('*', cors({
  origin: (origin) => {
    const allowed = getFrontendUrl();
    // Allow configured frontend, workers.dev preview, and no-origin (non-browser)
    if (!origin) return allowed;
    if (origin === allowed) return origin;
    if (origin.endsWith('.workers.dev')) return origin;
    return allowed;
  },
}));
app.use('*', logger());

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Routes
app.route('/health', healthRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/skills', skillsRoutes);
app.route('/api/namespaces', namespaceRoutes);
app.route('/api/auth/apikeys', apikeyRoutes);
app.route('/api/admin', adminRoutes);
app.route('/mcp', mcpRoutes);

// 404
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

export default app;
