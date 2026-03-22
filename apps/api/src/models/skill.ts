import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { namespaces } from './namespace.js';
import { users } from './user.js';

export const skills = sqliteTable('skills', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  namespaceId: text('namespace_id').notNull().references(() => namespaces.id),
  name: text('name').notNull(),
  description: text('description'),
  latestTag: text('latest_tag').default('latest'),
  readme: text('readme'),
  dependencies: text('dependencies', { mode: 'json' }).$type<string[]>().default([]),
  downloads: integer('downloads').default(0).notNull(),
  author: text('author'),
  license: text('license'),
  repository: text('repository'),
  agents: text('agents', { mode: 'json' }).$type<string[]>().default([]),
  searchTags: text('search_tags', { mode: 'json' }).$type<string[]>().default([]),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
  uniqueIndex('skills_ns_name_unique').on(table.namespaceId, table.name),
  index('idx_skills_namespace').on(table.namespaceId),
]);

export const skillTags = sqliteTable('skill_tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  tag: text('tag').notNull(),
  artifactKey: text('artifact_key').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  checksum: text('checksum').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  publishedBy: text('published_by').references(() => users.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
  uniqueIndex('skill_tags_skill_tag_unique').on(table.skillId, table.tag),
  index('idx_skill_tags_skill').on(table.skillId),
]);
