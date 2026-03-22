'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from './confirm-dialog';
import { apiUrl } from '@/lib/api';

export default function DeleteSkillButton({ namespace, name }: { namespace: string; name: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    const token = localStorage.getItem('skillr_token');

    try {
      const res = await fetch(apiUrl(`/api/skills/${namespace}/${name}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        router.push('/skills');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete');
      }
    } catch {
      alert('Connection error');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="rounded-md border border-[var(--color-error)] px-3 py-1.5 text-sm text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-white"
      >
        Delete Skill
      </button>
      <ConfirmDialog
        open={showConfirm}
        title="Delete Skill"
        message={`Are you sure you want to delete ${namespace}/${name}? This action cannot be undone. All versions and artifacts will be permanently removed.`}
        confirmText={loading ? 'Deleting...' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
