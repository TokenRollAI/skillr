'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiUrl } from '@/lib/api-url';


export default function NamespaceDetailPage() {
  const params = useParams();
  const nsName = decodeURIComponent(params.name as string);

  const [ns, setNs] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [nsSkills, setNsSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(apiUrl(`/api/namespaces/${nsName}`)).then(r => r.ok ? r.json() : null),
      fetch(apiUrl(`/api/namespaces/${nsName}/members`)).then(r => r.ok ? r.json() : []),
      fetch(apiUrl(`/api/skills?namespace=${nsName}`)).then(r => r.ok ? r.json() : []),
    ])
      .then(([nsData, membersData, skillsData]) => {
        setNs(nsData);
        setMembers(membersData);
        setNsSkills(skillsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [nsName]);

  if (loading) {
    return <div className="py-12 text-center text-[var(--color-text-secondary)]">Loading...</div>;
  }

  if (!ns) {
    return (
      <div className="py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--color-error)]">Namespace Not Found</h1>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">{ns.name}</h1>
          <p className="mt-1 text-[var(--color-text-secondary)]">{ns.description || 'No description'}</p>
          <span className="mt-2 inline-block rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
            {ns.visibility}
          </span>
        </div>
        <a
          href={`/namespaces/${encodeURIComponent(nsName)}/settings`}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          Settings
        </a>
      </div>

      {/* Skills in this namespace */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Skills ({nsSkills.length})</h2>
        {nsSkills.length === 0 ? (
          <p className="text-[var(--color-text-secondary)]">No skills in this namespace yet.</p>
        ) : (
          <div className="grid gap-3">
            {nsSkills.map((skill: any, i: number) => (
              <a
                key={i}
                href={`/skills/${skill.namespace}/${skill.name}`}
                className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 hover:border-[var(--color-primary)]"
              >
                <div className="flex justify-between">
                  <span className="font-medium">{skill.name}</span>
                  <span className="text-xs text-[var(--color-text-secondary)]">{skill.latestTag || 'latest'}</span>
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{skill.description}</p>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Members */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Members ({members.length})</h2>
        {members.length === 0 ? (
          <p className="text-[var(--color-text-secondary)]">No members.</p>
        ) : (
          <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-tertiary)]">
                <tr>
                  <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Username</th>
                  <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Email</th>
                  <th className="px-4 py-2 text-left text-[var(--color-text-secondary)]">Role</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m: any, i: number) => (
                  <tr key={i} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-2">{m.username}</td>
                    <td className="px-4 py-2 text-[var(--color-text-secondary)]">{m.email}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${m.role === 'maintainer' ? 'bg-[var(--color-primary)] text-black' : 'bg-[var(--color-bg-tertiary)]'}`}>
                        {m.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
