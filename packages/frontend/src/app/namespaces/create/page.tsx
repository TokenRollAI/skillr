'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateNamespacePage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('internal');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const fullName = name.startsWith('@') ? name : `@${name}`;
    const token = localStorage.getItem('skillhub_token');
    if (!token) {
      setError('Please login first');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/namespaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: fullName, description, visibility }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create namespace');
        return;
      }

      router.push(`/namespaces/${encodeURIComponent(fullName)}`);
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg py-8">
      <h1 className="text-2xl font-bold mb-6">Create Namespace</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Name</label>
          <div className="flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <span className="px-3 text-[var(--color-text-secondary)]">@</span>
            <input
              type="text"
              value={name.replace(/^@/, '')}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              className="flex-1 bg-transparent px-2 py-2 text-sm outline-none"
              placeholder="my-team"
              required
            />
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Lowercase letters, numbers, and hyphens only</p>
        </div>

        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm outline-none"
            placeholder="Optional description"
          />
        </div>

        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Visibility</label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm outline-none"
          >
            <option value="public">Public — visible to everyone</option>
            <option value="internal">Internal — visible to authenticated users</option>
            <option value="private">Private — visible to members only</option>
          </select>
        </div>

        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-[var(--color-primary)] py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Namespace'}
        </button>
      </form>
    </div>
  );
}
