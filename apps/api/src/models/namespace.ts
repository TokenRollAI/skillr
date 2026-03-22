import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { users } from './user.js';

export const namespaces = sqliteTable('namespaces', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').unique().notNull(),
  description: text('description'),
  visibility: text('visibility').default('internal').notNull(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()).notNull(),
});

export const nsMembers = sqliteTable('ns_members', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  namespaceId: text('namespace_id').notNull().references(() => namespaces.id, { onDelete: 'cascade' }),
  role: text('role').default('viewer').notNull(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.namespaceId] }),
]);
