# Database Schema Reference

## 1. Core Summary

Skillr uses 8 tables managed via drizzle-orm. Supports dual database backends: PostgreSQL (Node.js deployment, UUID PKs with `defaultRandom()`, `timestamptz`) and Cloudflare D1 (SQLite, text PKs with UUID generation, `text` timestamps). The schema supports a multi-tenant namespace model with RBAC, versioned skill artifacts, OAuth Device Code flow, API Key authentication, and audit logging.

## 2. Source of Truth

- **Schema models (runtime):** `packages/backend/src/models/schema.ts` -- re-exports from individual model files.
- **Drizzle migration schema:** `packages/backend/src/models/drizzle-schema.ts` -- combined schema for `drizzle-kit`.
- **Initial migration SQL:** `packages/backend/drizzle/0000_motionless_morbius.sql`
- **D1 migration SQL:** `packages/backend/d1-migration.sql`
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

### namespaces (`packages/backend/src/models/namespace.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, defaultRandom |
| name | varchar(64) | UNIQUE, NOT NULL |
| description | text | nullable |
| visibility | varchar(20) | NOT NULL, default `'internal'` |
| created_at | timestamptz | NOT NULL, defaultNow |
| updated_at | timestamptz | NOT NULL, defaultNow |

**Visibility values:** `public`, `internal`, `private`. Public = visible to all; Internal = visible to authenticated users; Private = visible only to members and admins.

### ns_members (`packages/backend/src/models/namespace.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| user_id | uuid | PK (composite), FK -> users(cascade) |
| namespace_id | uuid | PK (composite), FK -> namespaces(cascade) |
| role | varchar(20) | NOT NULL, default `'viewer'` |
| created_at | timestamptz | NOT NULL, defaultNow |

### skills (`packages/backend/src/models/skill.ts`)

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

### skill_tags (`packages/backend/src/models/skill.ts`)

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

### api_keys (`packages/backend/src/models/api-key.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, defaultRandom |
| user_id | uuid | NOT NULL, FK -> users(cascade) |
| name | varchar(128) | NOT NULL |
| prefix | varchar(20) | NOT NULL |
| key_hash | varchar(128) | NOT NULL |
| scopes | jsonb | nullable |
| last_used_at | timestamptz | nullable |
| expires_at | timestamptz | nullable |
| revoked | boolean | NOT NULL, default `false` |
| created_at | timestamptz | NOT NULL, defaultNow |
| updated_at | timestamptz | NOT NULL, defaultNow |

**Key format:** `sk_live_<32-byte-hex>`. Only the SHA-256 hash is stored; the prefix field stores `sk_live_<first8>` for lookup.

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
- `api_keys.user_id` -> `users.id` (cascade delete)
- `audit_logs.user_id` -> `users.id` (no cascade)

## 5. D1 (SQLite) Compatibility

When deployed on Cloudflare Workers with D1:
- UUID columns use `text` type with application-level UUID generation.
- `timestamptz` maps to `text` (ISO 8601 strings).
- `jsonb` maps to `text` (JSON serialized).
- `bigint` maps to `integer`.
- Migration file: `packages/backend/d1-migration.sql`.
