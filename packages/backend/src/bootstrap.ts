import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getDb } from './db.js';
import { sql } from 'drizzle-orm';
import { users, namespaces, nsMembers } from './models/schema.js';
import { getRuntime } from './runtime/index.js';

/**
 * Auto-migrate: Execute SQL migration files if tables don't exist yet.
 * Safe to run multiple times — checks for existing tables before applying.
 */
export async function autoMigrate() {
  const db = getDb();

  // Check if users table exists (proxy for "has migrated")
  try {
    await db.execute(sql`SELECT 1 FROM users LIMIT 0`);
    console.log('[migrate] Tables already exist, skipping migration.');
    return;
  } catch {
    console.log('[migrate] Tables not found, running migration...');
  }

  // Find migration files
  const migrationDirs = [
    join(import.meta.dirname || '.', '..', 'drizzle'),
    join(process.cwd(), 'drizzle'),
    '/app/drizzle',
  ];

  let migrationDir: string | null = null;
  for (const dir of migrationDirs) {
    if (existsSync(dir)) {
      migrationDir = dir;
      break;
    }
  }

  if (!migrationDir) {
    console.warn('[migrate] No drizzle/ migration directory found, skipping.');
    return;
  }

  const sqlFiles = readdirSync(migrationDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of sqlFiles) {
    const content = readFileSync(join(migrationDir, file), 'utf-8');
    // Split on drizzle breakpoints
    const statements = content.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try {
        await db.execute(sql.raw(stmt));
      } catch (err: any) {
        // Ignore "already exists" errors
        if (!err.message?.includes('already exists')) {
          console.error(`[migrate] Error in ${file}:`, err.message);
        }
      }
    }
    console.log(`[migrate] Applied: ${file}`);
  }

  // Also create tables for audit_logs and api_keys if not in migration files
  const extraTables = [
    `CREATE TABLE IF NOT EXISTS "audit_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid REFERENCES "users"("id"),
      "action" varchar(64) NOT NULL,
      "resource" varchar(255),
      "details" jsonb,
      "ip_address" varchar(45),
      "user_agent" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "idx_audit_user" ON "audit_logs"("user_id")`,
    `CREATE INDEX IF NOT EXISTS "idx_audit_action" ON "audit_logs"("action")`,
    `CREATE INDEX IF NOT EXISTS "idx_audit_time" ON "audit_logs"("created_at")`,
    `CREATE TABLE IF NOT EXISTS "api_keys" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "name" varchar(128) NOT NULL,
      "prefix" varchar(16) NOT NULL,
      "key_hash" varchar(255) NOT NULL,
      "scopes" jsonb DEFAULT '["read"]' NOT NULL,
      "last_used_at" timestamp with time zone,
      "expires_at" timestamp with time zone,
      "revoked" boolean DEFAULT false NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "idx_api_keys_user" ON "api_keys"("user_id")`,
    `CREATE INDEX IF NOT EXISTS "idx_api_keys_prefix" ON "api_keys"("prefix")`,
  ];

  for (const stmt of extraTables) {
    try {
      await db.execute(sql.raw(stmt));
    } catch (err: any) {
      if (!err.message?.includes('already exists')) {
        console.error('[migrate] Extra table error:', err.message);
      }
    }
  }

  console.log('[migrate] Migration complete.');
}

/**
 * Auto-seed: Create default admin user and namespace if they don't exist.
 * Safe to run multiple times — uses onConflictDoNothing.
 */
export async function autoSeed() {
  const db = getDb();

  // Check if admin already exists
  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) {
    console.log('[seed] Users exist, skipping seed.');
    return;
  }

  console.log('[seed] Empty database, creating admin user and default namespace...');

  const passwordHash = await getRuntime().password.hash('admin123');
  const [admin] = await db
    .insert(users)
    .values({
      username: 'admin',
      email: 'admin@skillr.dev',
      passwordHash,
      role: 'admin',
    })
    .onConflictDoNothing()
    .returning();

  if (admin) {
    const [ns] = await db
      .insert(namespaces)
      .values({
        name: '@default',
        description: 'Default namespace',
        visibility: 'public',
      })
      .onConflictDoNothing()
      .returning();

    if (ns) {
      await db
        .insert(nsMembers)
        .values({
          userId: admin.id,
          namespaceId: ns.id,
          role: 'maintainer',
        })
        .onConflictDoNothing();
    }

    console.log('[seed] Created admin user (admin / admin123) and @default namespace.');
  }
}
