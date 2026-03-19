'use client';

import { useEffect, useState } from 'react';

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('skillhub_token') : null;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => { loadLogs(); }, [actionFilter]);
  async function loadLogs() {
    const params = new URLSearchParams({ limit: '50' });
    if (actionFilter) params.set('action', actionFilter);
    const res = await fetch(`/api/admin/audit?${params}`, { headers });
    if (res.ok) setLogs(await res.json());
  }

  const actions = ['user.register', 'user.login', 'user.password_change', 'skill.push', 'skill.delete', 'apikey.create', 'apikey.revoke', 'apikey.rotate'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <a href="/admin" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Back to Dashboard</a>
      </div>
      <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-sm">
        <option value="">All actions</option>
        {actions.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-[var(--color-bg-tertiary)]"><tr>
          <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Time</th>
          <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Action</th>
          <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Resource</th>
          <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">User ID</th>
        </tr></thead><tbody>
          {logs.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">No audit logs</td></tr> :
            logs.map(log => (<tr key={log.id} className="border-t border-[var(--color-border)]">
              <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">{new Date(log.createdAt).toLocaleString()}</td>
              <td className="px-4 py-2"><span className="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-xs">{log.action}</span></td>
              <td className="px-4 py-2 text-[var(--color-text-secondary)]">{log.resource || '-'}</td>
              <td className="px-4 py-2 font-mono text-xs text-[var(--color-text-secondary)]">{log.userId?.slice(0, 8) || '-'}</td>
            </tr>))}
        </tbody></table>
      </div>
    </div>
  );
}
