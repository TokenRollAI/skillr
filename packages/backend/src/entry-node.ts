import { serve } from '@hono/node-server';
import { getEnv } from './env.js';
import { setRuntime } from './runtime/index.js';
import { createNodeRuntime } from './runtime/node.js';
import { autoMigrate, autoSeed } from './bootstrap.js';
import app from './index.js';

const env = getEnv();

// Initialize Node.js runtime
setRuntime(createNodeRuntime({
  S3_ENDPOINT: env.S3_ENDPOINT,
  S3_ACCESS_KEY: env.S3_ACCESS_KEY,
  S3_SECRET_KEY: env.S3_SECRET_KEY,
  S3_BUCKET: env.S3_BUCKET,
}));

async function start() {
  console.log('Skillr Backend starting (Node.js)...');

  try {
    await autoMigrate();
    await autoSeed();
  } catch (err) {
    console.error('Bootstrap failed:', err);
    console.log('Starting server anyway (some features may not work)...');
  }

  serve({ fetch: app.fetch, port: env.PORT });
  console.log(`Skillr Backend ready on port ${env.PORT}`);
}

start();
