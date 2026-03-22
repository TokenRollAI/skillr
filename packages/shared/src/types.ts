export interface SourceConfig {
  name: string;
  url: string;
  default?: boolean;
}

export interface AuthEntry {
  token: string;
  expires_at?: string;
  type: 'device_code' | 'machine_token';
}

export interface SkillrConfig {
  sources: SourceConfig[];
  auth: Record<string, AuthEntry>;
  telemetry: boolean;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface DeviceTokenPollResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: 'authorization_pending' | 'slow_down' | 'expired_token' | 'access_denied';
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'maintainer' | 'viewer';
}

// --- Domain types (shared across backend, frontend, MCP) ---

export interface Namespace {
  id: string;
  name: string;
  description: string | null;
  visibility: 'public' | 'internal' | 'private';
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  namespaceId: string;
  name: string;
  description: string | null;
  latestTag: string | null;
  readme: string | null;
  downloads: number;
  author: string | null;
  license: string | null;
  repository: string | null;
  agents: string[];
  searchTags: string[];
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillTag {
  id: string;
  skillId: string;
  tag: string;
  artifactKey: string;
  sizeBytes: number;
  checksum: string;
  metadata: Record<string, unknown>;
  publishedBy: string | null;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revoked: boolean;
  createdAt: string;
}

// --- API response types ---

export interface SkillSearchResult {
  name: string;
  namespace: string;
  description: string | null;
  latestTag: string | null;
  downloads: number;
  updatedAt: string;
}

export interface SkillDetail {
  name: string;
  namespace: string;
  description: string | null;
  latestTag: string | null;
  downloads: number;
  readme: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillTagDetail {
  tag: string;
  sizeBytes: number;
  checksum: string;
  downloadUrl: string;
  createdAt: string;
}

// --- skill.json manifest types ---

export interface SkillManifestEntry {
  path: string;
  name: string;
  description: string;
  agents?: string[];
  tags?: string[];
  dependencies?: string[];
  files?: {
    include?: string[];
    exclude?: string[];
  };
}

export interface SkillManifest {
  name: string;
  version?: string;
  author?: string;
  license?: string;
  repository?: string;
  namespace?: string;
  description?: string;
  agents?: string[];
  tags?: string[];
  dependencies?: string[];
  files?: {
    include?: string[];
    exclude?: string[];
  };
  skills?: SkillManifestEntry[];
}
