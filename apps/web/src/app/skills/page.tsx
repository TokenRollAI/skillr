'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiUrl } from '@/lib/api';

function SkillsContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const [skills, setSkills] = useState<any[]>([]);

  useEffect(() => {
    const searchQuery = new URLSearchParams({ q, page: String(page), limit: '20' });
    fetch(apiUrl(`/api/skills?${searchQuery}`))
      .then(res => res.ok ? res.json() : [])
      .then(setSkills)
      .catch(() => {});
  }, [q, page]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Skills</h1>
        <div className="flex items-center gap-4">
          <a
            href="/skills/publish"
            className="rounded-md bg-[var(--color-primary)] px-4 py-1.5 text-sm font-medium text-black hover:opacity-90"
          >
            Publish a Skill
          </a>
          <form action="/skills" method="GET">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search..."
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-sm outline-none"
            />
          </form>
        </div>
      </div>

      {skills.length === 0 ? (
        <div className="py-12 text-center text-[var(--color-text-secondary)]">
          {q ? `No skills found for "${q}"` : 'No skills published yet. Be the first!'}
          <div className="mt-4 font-mono text-sm">$ skillr push @namespace/skill-name</div>
        </div>
      ) : (
        <div className="grid gap-4">
          {skills.map((skill: any, i: number) => (
            <a
              key={i}
              href={`/skills/${skill.namespace}/${skill.name}`}
              className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 transition hover:border-[var(--color-primary)]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[var(--color-primary)]">{skill.namespace}/</span>
                  <span className="font-semibold">{skill.name}</span>
                </div>
                <span className="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                  {skill.latestTag || 'latest'}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {skill.description || 'No description'}
              </p>
              {((skill.agents && skill.agents.length > 0) || (skill.searchTags && skill.searchTags.length > 0)) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(skill.agents || []).map((agent: string) => (
                    <span
                      key={`agent-${agent}`}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-900/50 text-purple-300"
                    >
                      {agent}
                    </span>
                  ))}
                  {(skill.searchTags || []).map((tag: string) => (
                    <span
                      key={`tag-${tag}`}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                ↓ {skill.downloads || 0} downloads
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SkillsPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-[var(--color-text-secondary)]">Loading...</div>}>
      <SkillsContent />
    </Suspense>
  );
}
