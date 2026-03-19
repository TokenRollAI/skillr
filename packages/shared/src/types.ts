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
