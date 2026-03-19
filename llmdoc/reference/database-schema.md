# Database Schema Reference

## 1. Core Summary

Skillhub uses 7 PostgreSQL tables managed via drizzle-orm. All primary keys are UUID with `defaultRandom()`. Timestamps use `timestamptz`. The schema supports a multi-tenant namespace model with RBAC, versioned skill artifacts, OAuth Device Code flow, and audit logging.

## 2. Source of Truth

- **Schema models (runtime):** `packages/backend/src/models/schema.ts` -- re-exports from individual model files.
- **Drizzle migration schema:** `packages/backend/src/models/drizzle-schema.ts` -- combined schema for `drizzle-kit`.
- **Initial migration SQL:** `packages/backend/drizzle/0000_motionless_morbius.sql`
- **Related Architecture:** `/llmdoc/architecture/backend-api.md`

## 3. Tables

### users (`packages/backend/src/models/user.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, defaultRandom |
| username | varchar(64) | UNIQUE, NOT NULL |
| email | varchar(255) | UNIQUE, NOT NULL |
| password_hash | varchar(255) | nullable |
| role | varchar(20) | NOT NULL, default `'viewer'` |
| created_at | timestamptz | NOT NULL, defaultNow |
| updated_at | timestamptz | NOT NULL, defaultNow |

### namespaces (`packages/backend/src/models/namespace.ts:4-11`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, defaultRandom |
| name | varchar(64) | UNIQUE, NOT NULL |
| description | text | nullable |
| visibility | varchar(20) | NOT NULL, default `'internal'` |
| created_at | timestamptz | NOT NULL, defaultNow |
| updated_at | timestamptz | NOT NULL, defaultNow |

### ns_members (`packages/backend/src/models/namespace.ts:13-20`)

| Column | Type | Constraints |
|--------|------|-------------|
| user_id | uuid | PK (composite), FK -> users(cascade) |
| namespace_id | uuid | PK (composite), FK -> namespaces(cascade) |
| role | varchar(20) | NOT NULL, default `'viewer'` |
| created_at | timestamptz | NOT NULL, defaultNow |

### skills (`packages/backend/src/models/skill.ts:5-19`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, defaultRandom |
| namespace_id | uuid | NOT NULL, FK -> namespaces |
| name | varchar(128) | NOT NULL |
| description | text | nullable |
| latest_tag | varchar(64) | default `'latest'` |
| readme | text | nullable |
| dependencies | jsonb | default `{}` |
| downloads | integer | NOT NULL, default `0` |
| created_at | timestamptz | NOT NULL, defaultNow |
| updated_at | timestamptz | NOT NULL, defaultNow |

**Indexes:** `skills_ns_name_unique` UNIQUE(namespace_id, name), `idx_skills_namespace` (namespace_id)

### skill_tags (`packages/backend/src/models/skill.ts:21-34`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, defaultRandom |
| skill_id | uuid | NOT NULL, FK -> skills(cascade) |
| tag | varchar(64) | NOT NULL |
| artifact_key | varchar(512) | NOT NULL |
| size_bytes | bigint | NOT NULL |
| checksum | varchar(128) | NOT NULL |
| metadata | jsonb | default `{}` |
| published_by | uuid | nullable, FK -> users |
| created_at | timestamptz | NOT NULL, defaultNow |

**Indexes:** `skill_tags_skill_tag_unique` UNIQUE(skill_id, tag), `idx_skill_tags_skill` (skill_id)

### device_codes (`packages/backend/src/models/device-code.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, defaultRandom |
| device_code | varchar(128) | UNIQUE, NOT NULL |
| user_code | varchar(16) | UNIQUE, NOT NULL |
| user_id | uuid | nullable, FK -> users |
| status | varchar(20) | NOT NULL, default `'pending'` |
| expires_at | timestamptz | NOT NULL |
| created_at | timestamptz | NOT NULL, defaultNow |

**Status values:** `pending` -> `approved` -> `used`

### audit_logs (`packages/backend/src/models/audit-log.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, defaultRandom |
| user_id | uuid | nullable, FK -> users |
| action | varchar(64) | NOT NULL |
| resource | varchar(255) | nullable |
| details | jsonb | nullable |
| ip_address | varchar(45) | nullable |
| user_agent | text | nullable |
| created_at | timestamptz | NOT NULL, defaultNow |

**Indexes:** `idx_audit_user` (user_id), `idx_audit_action` (action), `idx_audit_time` (created_at)

## 4. Key Relationships

- `ns_members.user_id` -> `users.id` (cascade delete)
- `ns_members.namespace_id` -> `namespaces.id` (cascade delete)
- `skills.namespace_id` -> `namespaces.id` (no cascade)
- `skill_tags.skill_id` -> `skills.id` (cascade delete)
- `skill_tags.published_by` -> `users.id` (no cascade)
- `device_codes.user_id` -> `users.id` (no cascade)
- `audit_logs.user_id` -> `users.id` (no cascade)
