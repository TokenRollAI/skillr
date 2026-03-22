# Database Schema Reference

## 1. Core Summary

Skillr uses 8 tables managed via drizzle-orm with SQLite (Cloudflare D1). All tables use `sqliteTable` from `drizzle-orm/sqlite-core`. PKs are `text` with `$defaultFn(() => crypto.randomUUID())`. Timestamps are `text` with ISO 8601 strings. JSON fields use `text({ mode: 'json' })`. The schema supports a multi-tenant namespace model with RBAC, versioned skill artifacts, OAuth Device Code flow, API Key authentication, and audit logging.

## 2. Source of Truth

- **Schema models (runtime):** `apps/api/src/models/schema.ts` -- re-exports from individual model files.
- **Individual model files:** `apps/api/src/models/user.ts`, `namespace.ts`, `skill.ts`, `device-code.ts`, `api-key.ts`, `audit-log.ts`
- **D1 migration SQL (initial):** `apps/api/d1-migration.sql`
- **D1 migration SQL (skill metadata):** `apps/api/migrations/0001-skill-metadata.sql` -- Adds `author`, `license`, `repository`, `agents`, `search_tags` columns to `skills` table.
- **Related Architecture:** `/llmdoc/architecture/backend-api.md`

## 3. Tables

### users (`apps/api/src/models/user.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK, crypto.randomUUID() |
| username | text | UNIQUE, NOT NULL |
| email | text | UNIQUE, NOT NULL |
| password_hash | text | nullable |
| role | text | NOT NULL, default `'viewer'` |
| created_at | text | NOT NULL, ISO 8601 |
| updated_at | text | NOT NULL, ISO 8601 |

### namespaces (`apps/api/src/models/namespace.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK, crypto.randomUUID() |
| name | text | UNIQUE, NOT NULL |
| description | text | nullable |
| visibility | text | NOT NULL, default `'internal'` |
| created_at | text | NOT NULL, ISO 8601 |
| updated_at | text | NOT NULL, ISO 8601 |

### ns_members (`apps/api/src/models/namespace.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| user_id | text | PK (composite), FK -> users |
| namespace_id | text | PK (composite), FK -> namespaces |
| role | text | NOT NULL, default `'viewer'` |
| created_at | text | NOT NULL, ISO 8601 |

### skills (`apps/api/src/models/skill.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK, crypto.randomUUID() |
| namespace_id | text | NOT NULL, FK -> namespaces |
| name | text | NOT NULL |
| description | text | nullable |
| latest_tag | text | default `'latest'` |
| readme | text | nullable |
| dependencies | text (json) | `string[]`, default `[]` |
| downloads | integer | NOT NULL, default `0` |
| author | text | nullable |
| license | text | nullable |
| repository | text | nullable |
| agents | text (json) | `string[]`, default `[]` |
| search_tags | text (json) | `string[]`, default `[]` |
| created_at | text | NOT NULL, ISO 8601 |
| updated_at | text | NOT NULL, ISO 8601 |

**Indexes:** `skills_ns_name_unique` UNIQUE(namespace_id, name), `idx_skills_namespace` (namespace_id)

### skill_tags (`apps/api/src/models/skill.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK, crypto.randomUUID() |
| skill_id | text | NOT NULL, FK -> skills(cascade) |
| tag | text | NOT NULL |
| artifact_key | text | NOT NULL |
| size_bytes | integer | NOT NULL |
| checksum | text | NOT NULL |
| metadata | text (json) | default `{}` |
| published_by | text | nullable, FK -> users |
| created_at | text | NOT NULL, ISO 8601 |

**Indexes:** `skill_tags_skill_tag_unique` UNIQUE(skill_id, tag), `idx_skill_tags_skill` (skill_id)

### device_codes (`apps/api/src/models/device-code.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK, crypto.randomUUID() |
| device_code | text | UNIQUE, NOT NULL |
| user_code | text | UNIQUE, NOT NULL |
| user_id | text | nullable, FK -> users |
| status | text | NOT NULL, default `'pending'` |
| expires_at | text | NOT NULL |
| created_at | text | NOT NULL, ISO 8601 |

### api_keys (`apps/api/src/models/api-key.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK, crypto.randomUUID() |
| user_id | text | NOT NULL, FK -> users(cascade) |
| name | text | NOT NULL |
| prefix | text | NOT NULL |
| key_hash | text | NOT NULL |
| scopes | text (json) | nullable |
| last_used_at | text | nullable |
| expires_at | text | nullable |
| revoked | integer (boolean) | NOT NULL, default `false` |
| created_at | text | NOT NULL, ISO 8601 |
| updated_at | text | NOT NULL, ISO 8601 |

### audit_logs (`apps/api/src/models/audit-log.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK, crypto.randomUUID() |
| user_id | text | nullable, FK -> users |
| action | text | NOT NULL |
| resource | text | nullable |
| details | text (json) | nullable |
| ip_address | text | nullable |
| user_agent | text | nullable |
| created_at | text | NOT NULL, ISO 8601 |

## 4. Key Relationships

- `ns_members.user_id` -> `users.id`, `ns_members.namespace_id` -> `namespaces.id`
- `skills.namespace_id` -> `namespaces.id`
- `skill_tags.skill_id` -> `skills.id` (cascade), `skill_tags.published_by` -> `users.id`
- `device_codes.user_id` -> `users.id`
- `api_keys.user_id` -> `users.id` (cascade)
- `audit_logs.user_id` -> `users.id`
