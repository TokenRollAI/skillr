'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import CopyButton from '../../../../components/copy-button';
import DeleteSkillButton from '../../../../components/delete-skill-button';
import { apiUrl } from '@/lib/api';


export default function SkillDetailPage() {
  const params = useParams();
  const ns = params.ns as string;
  const name = params.name as string;

  const [skill, setSkill] = useState<any>(null);
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(apiUrl(`/api/skills/${ns}/${name}`)).then(r => r.ok ? r.json() : null),
      fetch(apiUrl(`/api/skills/${ns}/${name}/tags`)).then(r => r.ok ? r.json() : []),
    ])
      .then(([skillData, tagsData]) => {
        setSkill(skillData);
        setTags(tagsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ns, name]);

  if (loading) {
    return <div className="py-12 text-center text-[var(--color-text-secondary)]">Loading...</div>;
  }

  if (!skill) {
    return (
      <div className="py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--color-error)]">Skill Not Found</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">{ns}/{name} does not exist.</p>
      </div>
    );
  }

  const installCmd = `skillr install ${ns}/${name}`;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Main content */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">
            <span className="text-[var(--color-text-secondary)]">{skill.namespace}/</span>
            {skill.name}
          </h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">{skill.description}</p>
        </div>

        {/* Install command */}
        <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 font-mono text-sm">
          <span className="text-[var(--color-text-secondary)]">$</span>
          <span className="flex-1">{installCmd}</span>
          <CopyButton text={installCmd} />
        </div>

        {/* README */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
          <h2 className="mb-4 text-lg font-semibold">README</h2>
          <pre className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
            {skill.readme || 'No README available.'}
          </pre>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">METADATA</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-secondary)]">Latest</dt>
              <dd>{skill.latestTag || 'latest'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-secondary)]">Downloads</dt>
              <dd>{skill.downloads || 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-secondary)]">Updated</dt>
              <dd>{new Date(skill.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        {/* Versions */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">VERSIONS</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {tags.length === 0 ? (
              <li className="text-[var(--color-text-secondary)]">No versions yet</li>
            ) : (
              tags.map((t: any, i: number) => (
                <li key={i} className="flex justify-between">
                  <span className="text-[var(--color-primary)]">{t.tag}</span>
                  <span className="text-[var(--color-text-secondary)] text-xs">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Danger Zone */}
        <div className="rounded-lg border border-[var(--color-error)] bg-[var(--color-bg-secondary)] p-4">
          <h3 className="text-sm font-semibold text-[var(--color-error)]">DANGER ZONE</h3>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            Permanently delete this skill and all its versions.
          </p>
          <div className="mt-3">
            <DeleteSkillButton namespace={skill.namespace} name={skill.name} />
          </div>
        </div>
      </div>
    </div>
  );
}
