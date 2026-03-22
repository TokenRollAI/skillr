'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('skillr_token') : null;

  useEffect(() => {
    if (token) {
      fetch(apiUrl('/api/auth/me'), { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setUser(d));
    }
  }, []);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setError('');
    const res = await fetch(apiUrl('/api/auth/password'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (res.ok) {
      setMessage('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to update password');
    }
  }

  if (!token) return <div className="py-12 text-center text-[var(--color-text-secondary)]">Please <a href="/login" className="text-[var(--color-primary)]">login</a> first.</div>;

  return (
    <div className="mx-auto max-w-2xl py-8 space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="flex gap-4 border-b border-[var(--color-border)] pb-2">
        <a href="/settings" className="text-sm font-medium text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] pb-2">Profile</a>
        <a href="/settings/keys" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] pb-2">API Keys</a>
      </div>
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        {user ? (
          <dl className="space-y-3 text-sm">
            <div className="flex"><dt className="w-24 text-[var(--color-text-secondary)]">Username</dt><dd>{user.username}</dd></div>
            <div className="flex"><dt className="w-24 text-[var(--color-text-secondary)]">Email</dt><dd>{user.email}</dd></div>
            <div className="flex"><dt className="w-24 text-[var(--color-text-secondary)]">Role</dt><dd>{user.role}</dd></div>
          </dl>
        ) : <p className="text-[var(--color-text-secondary)]">Loading...</p>}
      </section>
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
        <h2 className="text-lg font-semibold mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Current password" className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none" required />
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 6 chars)" minLength={6} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none" required />
          {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
          {message && <p className="text-sm text-[var(--color-success)]">{message}</p>}
          <button type="submit" className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-black">Update Password</button>
        </form>
      </section>
    </div>
  );
}
