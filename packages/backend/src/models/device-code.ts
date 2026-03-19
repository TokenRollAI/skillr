import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './user.js';

export const deviceCodes = pgTable('device_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceCode: varchar('device_code', { length: 128 }).unique().notNull(),
  userCode: varchar('user_code', { length: 16 }).unique().notNull(),
  userId: uuid('user_id').references(() => users.id),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
