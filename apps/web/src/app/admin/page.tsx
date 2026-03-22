'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api-url';

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [error, setError] = useState('');
  const router = useRouter();
  const token = typeof window !== 'undefined' ? localStorage.getItem('skillhub_token') : null;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    fetch(apiUrl('/api/admin/stats'), { headers }).then(r => { if (r.status === 403) { setError('Admin access required'); return null; } return r.json(); }).then(d => d && setStats(d));
    fetch(apiUrl('/api/admin/audit?limit=10'), { headers }).then(r => r.ok ? r.json() : []).then(setAudit);
  }, []);

  if (error) return <div className="py-12 text-center"><h1 className="text-2xl font-bold text-[var(--color-error)]">403 Forbidden</h1><p className="mt-2 text-[var(--color-text-secondary)]">{error}</p></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="flex gap-3">
          <a href="/admin/users" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-bg-tertiary)]">Users</a>
          <a href="/admin/audit" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-bg-tertiary)]">Audit Log</a>
        </div>
      </div>
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[{ label: 'Users', value: stats.users, color: 'var(--color-primary)' }, { label: 'Namespaces', value: stats.namespaces, color: 'var(--color-success)' }, { label: 'Skills', value: stats.skills, color: 'var(--color-warning)' }, { label: 'Downloads', value: stats.totalDownloads, color: 'var(--color-text)' }].map(c => (
            <div key={c.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
              <p className="text-sm text-[var(--color-text-secondary)]">{c.label}</p>
              <p className="mt-1 text-3xl font-bold" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>
      )}
      <section>
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        {audit.length === 0 ? <p className="text-[var(--color-text-secondary)]">No activity yet.</p> : (
          <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-sm"><thead className="bg-[var(--color-bg-tertiary)]"><tr>
              <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Time</th>
              <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Action</th>
              <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Resource</th>
            </tr></thead><tbody>
              {audit.map((log: any) => (<tr key={log.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2"><span className="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-xs">{log.action}</span></td>
                <td className="px-4 py-2 text-[var(--color-text-secondary)]">{log.resource || '-'}</td>
              </tr>))}
            </tbody></table>
          </div>
        )}
      </section>
    </div>
  );
}
