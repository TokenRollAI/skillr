'use client';

import { useEffect, useState } from 'react';
import CopyButton from '../../../components/copy-button';
import ConfirmDialog from '../../../components/confirm-dialog';

interface ApiKey { id: string; name: string; prefix: string; scopes: string[]; lastUsedAt: string | null; expiresAt: string | null; revoked: boolean; createdAt: string; }

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
  const [newKeyExpiry, setNewKeyExpiry] = useState('never');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [rotateTarget, setRotateTarget] = useState<string | null>(null);
  const [error, setError] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('skillhub_token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  useEffect(() => { loadKeys(); }, []);
  async function loadKeys() { const res = await fetch('/api/auth/apikeys', { headers }); if (res.ok) setKeys(await res.json()); }

  async function createKey(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const res = await fetch('/api/auth/apikeys', { method: 'POST', headers, body: JSON.stringify({ name: newKeyName, scopes: newKeyScopes, expiresIn: newKeyExpiry }) });
    if (res.ok) { const data = await res.json(); setCreatedKey(data.key); setShowCreate(false); setNewKeyName(''); loadKeys(); }
    else { const data = await res.json(); setError(data.error || 'Failed'); }
  }

  async function revokeKey() { if (!revokeTarget) return; await fetch(`/api/auth/apikeys/${revokeTarget}`, { method: 'DELETE', headers }); setRevokeTarget(null); loadKeys(); }
  async function rotateKey() { if (!rotateTarget) return; const res = await fetch(`/api/auth/apikeys/${rotateTarget}/rotate`, { method: 'POST', headers }); if (res.ok) { const data = await res.json(); setCreatedKey(data.key); } setRotateTarget(null); loadKeys(); }

  function getStatus(key: ApiKey) {
    if (key.revoked) return { label: 'Revoked', color: 'var(--color-error)' };
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return { label: 'Expired', color: 'var(--color-warning)' };
    return { label: 'Active', color: 'var(--color-success)' };
  }

  if (!token) return <div className="py-12 text-center text-[var(--color-text-secondary)]">Please <a href="/login" className="text-[var(--color-primary)]">login</a> first.</div>;

  return (
    <div className="mx-auto max-w-3xl py-8 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="flex gap-4 border-b border-[var(--color-border)] pb-2">
        <a href="/settings" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] pb-2">Profile</a>
        <a href="/settings/keys" className="text-sm font-medium text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] pb-2">API Keys</a>
      </div>

      {createdKey && (
        <div className="rounded-lg border border-[var(--color-success)] bg-[var(--color-bg-secondary)] p-4">
          <p className="text-sm font-semibold text-[var(--color-success)]">New API Key Created</p>
          <p className="mt-1 text-xs text-[var(--color-warning)]">Copy this key now. It won&apos;t be shown again!</p>
          <div className="mt-2 flex items-center gap-2 rounded-md bg-[var(--color-bg)] px-3 py-2 font-mono text-sm">
            <span className="flex-1 break-all">{createdKey}</span>
            <CopyButton text={createdKey} />
          </div>
          <button onClick={() => setCreatedKey(null)} className="mt-2 text-xs text-[var(--color-text-secondary)] hover:underline">Dismiss</button>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={() => setShowCreate(!showCreate)} className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-black">{showCreate ? 'Cancel' : 'Create New Key'}</button>
      </div>

      {showCreate && (
        <form onSubmit={createKey} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-3">
          <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name (e.g., CI Pipeline)" className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none" required />
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1"><input type="checkbox" checked disabled /> read</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={newKeyScopes.includes('write')} onChange={e => setNewKeyScopes(e.target.checked ? [...newKeyScopes, 'write'] : newKeyScopes.filter(s => s !== 'write'))} /> write</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={newKeyScopes.includes('admin')} onChange={e => setNewKeyScopes(e.target.checked ? [...newKeyScopes, 'admin'] : newKeyScopes.filter(s => s !== 'admin'))} /> admin</label>
          </div>
          <select value={newKeyExpiry} onChange={e => setNewKeyExpiry(e.target.value)} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm">
            <option value="30d">30 days</option><option value="90d">90 days</option><option value="365d">1 year</option><option value="never">Never expires</option>
          </select>
          {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
          <button type="submit" className="rounded-md bg-[var(--color-success)] px-4 py-2 text-sm font-medium text-black">Create Key</button>
        </form>
      )}

      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-tertiary)]"><tr>
            <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Name</th>
            <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Key</th>
            <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Scopes</th>
            <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Status</th>
            <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Last Used</th>
            <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Actions</th>
          </tr></thead>
          <tbody>
            {keys.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">No API keys yet</td></tr> :
              keys.map(key => { const status = getStatus(key); return (
                <tr key={key.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2 font-medium">{key.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-[var(--color-text-secondary)]">{key.prefix}</td>
                  <td className="px-4 py-2">{(key.scopes as string[]).map(s => <span key={s} className="mr-1 rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-xs">{s}</span>)}</td>
                  <td className="px-4 py-2"><span style={{ color: status.color }} className="text-xs font-medium">{status.label}</span></td>
                  <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4 py-2">{!key.revoked && <div className="flex gap-2">
                    <button onClick={() => setRevokeTarget(key.id)} className="text-xs text-[var(--color-error)] hover:underline">Revoke</button>
                    <button onClick={() => setRotateTarget(key.id)} className="text-xs text-[var(--color-primary)] hover:underline">Rotate</button>
                  </div>}</td>
                </tr>); })}
          </tbody>
        </table>
      </div>
      <ConfirmDialog open={!!revokeTarget} title="Revoke API Key" message="This key will immediately stop working." confirmText="Revoke" onConfirm={revokeKey} onCancel={() => setRevokeTarget(null)} />
      <ConfirmDialog open={!!rotateTarget} title="Rotate API Key" message="The current key will be revoked and a new one generated." confirmText="Rotate" onConfirm={rotateKey} onCancel={() => setRotateTarget(null)} />
    </div>
  );
}
