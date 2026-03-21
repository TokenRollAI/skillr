'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api-url';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const token = typeof window !== 'undefined' ? localStorage.getItem('skillhub_token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  useEffect(() => { loadUsers(); }, []);
  async function loadUsers() { const res = await fetch(apiUrl('/api/admin/users'), { headers }); if (res.ok) setUsers(await res.json()); }
  async function changeRole(userId: string, role: string) { await fetch(apiUrl(`/api/admin/users/${userId}/role`), { method: 'PUT', headers, body: JSON.stringify({ role }) }); loadUsers(); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <a href="/admin" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Back to Dashboard</a>
      </div>
      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-[var(--color-bg-tertiary)]"><tr>
          <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Username</th>
          <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Email</th>
          <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Role</th>
          <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Joined</th>
        </tr></thead><tbody>
          {users.map(u => (<tr key={u.id} className="border-t border-[var(--color-border)]">
            <td className="px-4 py-2 font-medium">{u.username}</td>
            <td className="px-4 py-2 text-[var(--color-text-secondary)]">{u.email}</td>
            <td className="px-4 py-2">
              <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs">
                <option value="viewer">viewer</option><option value="admin">admin</option>
              </select>
            </td>
            <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">{new Date(u.createdAt).toLocaleDateString()}</td>
          </tr>))}
        </tbody></table>
      </div>
    </div>
  );
}
