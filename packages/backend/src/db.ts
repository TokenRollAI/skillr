import * as schema from './models/schema.js';

let _db: any = null;

export function getDb() {
  if (!_db) {
    throw new Error('Database not initialized. Call initDb() or initDbD1() first.');
  }
  return _db;
}

/**
 * Initialize DB with postgres.js driver (Node.js / Docker).
 */
export async function initDb(databaseUrl: string) {
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const client = postgres(databaseUrl);
  _db = drizzle(client, { schema });
}

/**
 * Initialize DB with D1 (Cloudflare Workers).
 * D1 binding is passed from entry-worker.ts.
 */
export async function initDbD1(d1Binding: any) {
  const { drizzle } = await import('drizzle-orm/d1');
  _db = drizzle(d1Binding, { schema });
}
