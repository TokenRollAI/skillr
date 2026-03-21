import { setRuntime } from './runtime/index.js';
import { createWorkerRuntime } from './runtime/worker.js';
import app from './index.js';

// TODO: migrate env access to use Hono c.env instead of process.env
// In a real Workers deployment, process.env won't work.

export interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  ARTIFACTS: unknown; // R2Bucket — typed as unknown to avoid needing CF Workers types in Node build
}

export default {
  async fetch(request: Request, env: Env, ctx: unknown): Promise<Response> {
    // Initialize runtime for this request
    setRuntime(createWorkerRuntime({ ARTIFACTS: env.ARTIFACTS }));

    // Set env vars for Hono handlers
    // TODO: migrate env access to use Hono c.env
    (globalThis as any).process = (globalThis as any).process || { env: {} };
    (globalThis as any).process.env.DATABASE_URL = env.DATABASE_URL;
    (globalThis as any).process.env.JWT_SECRET = env.JWT_SECRET;
    (globalThis as any).process.env.FRONTEND_URL = env.FRONTEND_URL;

    return app.fetch(request, env, ctx as any);
  },
};
