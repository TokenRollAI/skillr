'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';

export default function DeviceCodePage() {
  const [userCode, setUserCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'need-login'>('idle');
  const [message, setMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('skillr_token');
    if (!token) {
      setStatus('need-login');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setStatus('loading');

    const token = localStorage.getItem('skillr_token');
    if (!token) {
      setStatus('need-login');
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/auth/device/approve'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_code: userCode.toUpperCase() }),
      });

      if (res.ok) {
        setStatus('success');
        setMessage('Authorized! You can return to your terminal now.');
      } else {
        const body = await res.json();
        setStatus('error');
        setMessage(body.error || 'Verification failed');
      }
    } catch {
      setStatus('error');
      setMessage('Connection error. Make sure the backend is running.');
    }
  }

  if (status === 'need-login') {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold">Device Verification</h1>
        <p className="mt-4 text-[var(--color-text-secondary)]">
          You need to login first before approving a device code.
        </p>
        <a
          href={`/login?redirect=/device`}
          className="mt-6 inline-block rounded-md bg-[var(--color-primary)] px-6 py-2 text-sm font-medium text-black hover:opacity-90"
        >
          Login first
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-bold">Device Verification</h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Enter the code shown in your terminal
      </p>

      {status === 'success' ? (
        <div className="mt-8 rounded-lg border border-[var(--color-success)] bg-[var(--color-bg-secondary)] p-6">
          <div className="text-4xl">✓</div>
          <p className="mt-2 text-[var(--color-success)]">{message}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <input
            type="text"
            value={userCode}
            onChange={(e) => setUserCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="ABCD1234"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-4 text-center font-mono text-2xl tracking-[0.5em] outline-none focus:border-[var(--color-primary)]"
            required
          />
          {status === 'error' && (
            <p className="text-sm text-[var(--color-error)]">{message}</p>
          )}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full rounded-md bg-[var(--color-primary)] py-3 font-medium text-black hover:opacity-90 disabled:opacity-50"
          >
            {status === 'loading' ? 'Verifying...' : 'Authorize'}
          </button>
        </form>
      )}
    </div>
  );
}
