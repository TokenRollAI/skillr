import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { getEnv } from './env.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { skillsRoutes } from './routes/skills.js';
import { namespaceRoutes } from './routes/namespaces.js';
import { apikeyRoutes } from './routes/apikeys.js';
import { adminRoutes } from './routes/admin.js';

const app = new Hono();

// Global middleware
app.use('*', cors());
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

// 404
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Start server
const env = getEnv();
console.log(`Starting Skillr Backend on port ${env.PORT}...`);
serve({
  fetch: app.fetch,
  port: env.PORT,
});

export default app;
