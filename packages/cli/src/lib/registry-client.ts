import type { DeviceCodeResponse, DeviceTokenPollResponse, UserInfo } from '@skillr/shared';

export class RegistryClient {
  constructor(
    protected baseUrl: string,
    protected token?: string,
  ) {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...(options?.headers as Record<string, string>) },
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Authentication required. Run `skillr auth login` first.');
      }
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  async requestDeviceCode(): Promise<DeviceCodeResponse> {
    return this.request<DeviceCodeResponse>('/api/auth/device/code', {
      method: 'POST',
    });
  }

  async pollDeviceToken(deviceCode: string): Promise<DeviceTokenPollResponse> {
    return this.request<DeviceTokenPollResponse>('/api/auth/device/token', {
      method: 'POST',
      body: JSON.stringify({
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
  }

  async getUserInfo(): Promise<UserInfo> {
    return this.request<UserInfo>('/api/auth/me');
  }

  async pushSkill(
    namespace: string,
    name: string,
    tarball: Buffer,
    tag: string = 'latest',
    metadata?: { description?: string; readme?: string; metadata?: Record<string, unknown> },
  ): Promise<{ name: string; tag: string; checksum: string; size: number }> {
    const formData = new FormData();
    formData.append('tarball', new Blob([tarball]), `${name}.tar.gz`);
    if (metadata?.description) formData.append('description', metadata.description);
    if (metadata?.readme) formData.append('readme', metadata.readme);
    if (metadata?.metadata) formData.append('metadata', JSON.stringify(metadata.metadata));

    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(`${this.baseUrl}/api/skills/${namespace}/${name}?tag=${tag}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error('Authentication required. Run `skillr auth login` first.');
      const body = await res.json().catch(() => ({}));
      throw new Error((body as any).error || `API error: ${res.status}`);
    }

    return res.json() as any;
  }

  async getSkillInfo(namespace: string, name: string): Promise<any> {
    return this.request(`/api/skills/${namespace}/${name}`);
  }

  async getSkillTag(namespace: string, name: string, tag: string): Promise<{
    tag: string;
    sizeBytes: number;
    checksum: string;
    downloadUrl: string;
  }> {
    return this.request(`/api/skills/${namespace}/${name}/tags/${tag}`);
  }

  async searchSkills(query: string, namespace?: string, limit?: number, opts?: { agent?: string; tag?: string }): Promise<any[]> {
    const params = new URLSearchParams({ q: query });
    if (namespace) params.set('namespace', namespace);
    if (limit) params.set('limit', String(limit));
    if (opts?.agent) params.set('agent', opts.agent);
    if (opts?.tag) params.set('tag', opts.tag);
    return this.request(`/api/skills?${params}`);
  }
}
