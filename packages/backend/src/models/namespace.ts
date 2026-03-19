import { pgTable, uuid, varchar, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './user.js';

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
