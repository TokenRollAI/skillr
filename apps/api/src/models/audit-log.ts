import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { users } from './user.js';

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id),
  action: text('action').notNull(),
  resource: text('resource'),
  details: text('details', { mode: 'json' }).$type<Record<string, unknown>>(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
  index('idx_audit_user').on(table.userId),
  index('idx_audit_action').on(table.action),
  index('idx_audit_time').on(table.createdAt),
]);
