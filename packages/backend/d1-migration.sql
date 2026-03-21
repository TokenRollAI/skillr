-- D1 (SQLite) schema for Skillr
-- Equivalent to the PostgreSQL schema but SQLite compatible

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS namespaces (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'internal',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ns_members (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  namespace_id TEXT NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, namespace_id)
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  namespace_id TEXT NOT NULL REFERENCES namespaces(id),
  name TEXT NOT NULL,
  description TEXT,
  latest_tag TEXT DEFAULT 'latest',
  readme TEXT,
  dependencies TEXT DEFAULT '{}',
  downloads INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(namespace_id, name)
);

CREATE TABLE IF NOT EXISTS skill_tags (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  artifact_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  published_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(skill_id, tag)
);

CREATE TABLE IF NOT EXISTS device_codes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  device_code TEXT UNIQUE NOT NULL,
  user_code TEXT UNIQUE NOT NULL,
  user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  resource TEXT,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT '["read"]',
  last_used_at TEXT,
  expires_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_skills_namespace ON skills(namespace_id);
CREATE INDEX IF NOT EXISTS idx_skill_tags_skill ON skill_tags(skill_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(prefix);

-- Seed default admin and namespace
INSERT OR IGNORE INTO users (id, username, email, password_hash, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin', 'admin@skillr.dev', NULL, 'admin');

INSERT OR IGNORE INTO namespaces (id, name, description, visibility)
VALUES ('00000000-0000-0000-0000-000000000001', '@default', 'Default namespace', 'public');

INSERT OR IGNORE INTO ns_members (user_id, namespace_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'maintainer');
