import { pgTable, uuid, varchar, text, integer, bigint, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { namespaces } from './namespace.js';
import { users } from './user.js';

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
