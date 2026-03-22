'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      // Store token and user info
      localStorage.setItem('skillr_token', data.token);
      localStorage.setItem('skillr_user', JSON.stringify(data.user));

      // Notify NavBar about auth change
      window.dispatchEvent(new Event('skillhub:auth'));

      // Check for redirect
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      router.push(redirect || '/');
    } catch (err: unknown) {
      setError('Connection error. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="text-2xl font-bold text-center mb-8">Login to Skillr</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-[var(--color-primary)] py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-[var(--color-text-secondary)]">
        Don&apos;t have an account?{' '}
        <a href="/register" className="text-[var(--color-primary)] hover:underline">Register</a>
      </p>

      <div className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">CLI LOGIN</h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Or authenticate via the CLI (for terminal/agent use):
        </p>
        <div className="mt-2 rounded-md bg-[var(--color-bg)] px-3 py-2 font-mono text-sm">
          $ skillr auth login
        </div>
      </div>
    </div>
  );
}
