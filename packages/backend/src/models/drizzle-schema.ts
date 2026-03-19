/**
 * Consolidated schema file for drizzle-kit migration generation.
 * This file duplicates the table definitions to avoid .js extension resolution issues
 * with drizzle-kit's CJS module loader.
 *
 * The canonical schema definitions are in the individual model files.
 */
import { pgTable, uuid, varchar, text, integer, bigint, boolean, timestamp, jsonb, uniqueIndex, index, primaryKey } from 'drizzle-orm/pg-core';

// === users ===
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 64 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  role: varchar('role', { length: 20 }).default('viewer').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// === namespaces ===
export const namespaces = pgTable('namespaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 64 }).unique().notNull(),
  description: text('description'),
  visibility: varchar('visibility', { length: 20 }).default('internal').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const nsMembers = pgTable('ns_members', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  namespaceId: uuid('namespace_id').notNull().references(() => namespaces.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).default('viewer').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.namespaceId] }),
]);

// === skills ===
export const skills = pgTable('skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  namespaceId: uuid('namespace_id').notNull().references(() => namespaces.id),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  latestTag: varchar('latest_tag', { length: 64 }).default('latest'),
  readme: text('readme'),
  dependencies: jsonb('dependencies').default({}),
  downloads: integer('downloads').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('skills_ns_name_unique').on(table.namespaceId, table.name),
  index('idx_skills_namespace').on(table.namespaceId),
]);

export const skillTags = pgTable('skill_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  skillId: uuid('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  tag: varchar('tag', { length: 64 }).notNull(),
  artifactKey: varchar('artifact_key', { length: 512 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  checksum: varchar('checksum', { length: 128 }).notNull(),
  metadata: jsonb('metadata').default({}),
  publishedBy: uuid('published_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('skill_tags_skill_tag_unique').on(table.skillId, table.tag),
  index('idx_skill_tags_skill').on(table.skillId),
]);

// === device_codes ===
export const deviceCodes = pgTable('device_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceCode: varchar('device_code', { length: 128 }).unique().notNull(),
  userCode: varchar('user_code', { length: 16 }).unique().notNull(),
  userId: uuid('user_id').references(() => users.id),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// === api_keys ===
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 128 }).notNull(),
  prefix: varchar('prefix', { length: 16 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull(),
  scopes: jsonb('scopes').default(['read']).notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revoked: boolean('revoked').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_api_keys_user').on(table.userId),
  index('idx_api_keys_prefix').on(table.prefix),
]);

// === audit_logs ===
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 64 }).notNull(),
  resource: varchar('resource', { length: 255 }),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_audit_user').on(table.userId),
  index('idx_audit_action').on(table.action),
  index('idx_audit_time').on(table.createdAt),
]);
