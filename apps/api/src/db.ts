import { drizzle } from 'drizzle-orm/d1';
import * as schema from './models/schema.js';

// Per-request DB instance (safe in single-threaded Workers)
let _db: ReturnType<typeof drizzle> | null = null;

export function initDb(d1: D1Database) {
  _db = drizzle(d1, { schema });
}

export function getDb() {
  if (!_db) {
    throw new Error('Database not initialized. Ensure DB middleware is applied.');
  }
  return _db;
}
