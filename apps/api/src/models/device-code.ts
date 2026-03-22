import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './user.js';

export const deviceCodes = sqliteTable('device_codes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceCode: text('device_code').unique().notNull(),
  userCode: text('user_code').unique().notNull(),
  userId: text('user_id').references(() => users.id),
  status: text('status').default('pending').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
});
