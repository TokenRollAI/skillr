'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiUrl } from '@/lib/api';


export default function NamespaceSettingsPage() {
  const params = useParams();
  const nsName = decodeURIComponent(params.name as string);

  const [members, setMembers] = useState<any[]>([]);
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('skillr_token') : null;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      const res = await fetch(apiUrl(`/api/namespaces/${nsName}/members`), { headers });
      if (res.ok) setMembers(await res.json());
    } catch {}
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await fetch(apiUrl(`/api/namespaces/${nsName}/members`), {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: newUserId, role: newRole }),
      });

      if (res.ok) {
        setSuccess('Member added');
        setNewUserId('');
        loadMembers();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add member');
      }
    } catch {
      setError('Connection error');
    }
  }

  async function removeMember(userId: string) {
    if (!confirm('Remove this member?')) return;

    try {
      await fetch(apiUrl(`/api/namespaces/${nsName}/members/${userId}`), {
        method: 'DELETE',
        headers,
      });
      loadMembers();
    } catch {}
  }

  return (
    <div className="mx-auto max-w-2xl py-8 space-y-8">
      <h1 className="text-2xl font-bold">Settings: {nsName}</h1>

      {/* Add Member */}
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
        <h2 className="text-lg font-semibold mb-4">Add Member</h2>
        <form onSubmit={addMember} className="flex gap-3">
          <input
            type="text"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            placeholder="User ID (UUID)"
            className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none"
            required
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          >
            <option value="viewer">Viewer</option>
            <option value="maintainer">Maintainer</option>
          </select>
          <button type="submit" className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-black">
            Add
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-[var(--color-error)]">{error}</p>}
        {success && <p className="mt-2 text-sm text-[var(--color-success)]">{success}</p>}
      </section>

      {/* Current Members */}
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
        <h2 className="text-lg font-semibold mb-4">Members</h2>
        {members.length === 0 ? (
          <p className="text-[var(--color-text-secondary)]">No members</p>
        ) : (
          <div className="space-y-2">
            {members.map((m: any) => (
              <div key={m.userId} className="flex items-center justify-between rounded-md bg-[var(--color-bg)] px-4 py-2">
                <div>
                  <span className="font-medium">{m.username}</span>
                  <span className="ml-2 text-sm text-[var(--color-text-secondary)]">{m.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${m.role === 'maintainer' ? 'bg-[var(--color-primary)] text-black' : 'bg-[var(--color-bg-tertiary)]'}`}>
                    {m.role}
                  </span>
                  <button
                    onClick={() => removeMember(m.userId)}
                    className="text-xs text-[var(--color-error)] hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
