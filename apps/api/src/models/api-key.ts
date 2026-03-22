import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './user.js';

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  prefix: text('prefix').notNull(),
  keyHash: text('key_hash').notNull(),
  scopes: text('scopes', { mode: 'json' }).$type<string[]>().default(['read']).notNull(),
  lastUsedAt: text('last_used_at'),
  expiresAt: text('expires_at'),
  revoked: integer('revoked', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
  index('idx_api_keys_user').on(table.userId),
  index('idx_api_keys_prefix').on(table.prefix),
]);
