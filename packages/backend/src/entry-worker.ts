import { setRuntime } from './runtime/index.js';
import { createWorkerRuntime } from './runtime/worker.js';
import { initDbD1 } from './db.js';
import app from './index.js';

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  ARTIFACTS: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize runtime adapters
    setRuntime(createWorkerRuntime({ ARTIFACTS: env.ARTIFACTS }));
    await initDbD1(env.DB);

    // Make env available to legacy process.env readers
    (globalThis as any).process = (globalThis as any).process || { env: {} };
    (globalThis as any).process.env.JWT_SECRET = env.JWT_SECRET;
    (globalThis as any).process.env.FRONTEND_URL = env.FRONTEND_URL;

    return app.fetch(request, env, ctx);
  },
};
