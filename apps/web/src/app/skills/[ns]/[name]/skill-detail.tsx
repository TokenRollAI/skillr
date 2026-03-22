'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ExternalLink, User, Scale, GitBranch, Tag, Bot, Package } from 'lucide-react';
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
  const agentsList: string[] = skill.agents || [];
  const searchTagsList: string[] = skill.searchTags || [];
  const dependenciesList: string[] = skill.dependencies || [];

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

          {/* Tags badges */}
          {(agentsList.length > 0 || searchTagsList.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {agentsList.map((agent: string) => (
                <span
                  key={`agent-${agent}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-900/50 text-purple-300"
                >
                  <Bot className="h-3 w-3" />
                  {agent}
                </span>
              ))}
              {searchTagsList.map((tag: string) => (
                <span
                  key={`tag-${tag}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
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

        {/* Dependencies */}
        {dependenciesList.length > 0 && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
            <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5" />
              Dependencies
            </h2>
            <ul className="space-y-1 text-sm">
              {dependenciesList.map((dep: string) => (
                <li key={dep} className="text-[var(--color-text-secondary)] font-mono">{dep}</li>
              ))}
            </ul>
          </div>
        )}
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
            {skill.author && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-secondary)] flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  Author
                </dt>
                <dd>{skill.author}</dd>
              </div>
            )}
            {skill.license && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-secondary)] flex items-center gap-1">
                  <Scale className="h-3.5 w-3.5" />
                  License
                </dt>
                <dd>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/50 text-green-300">
                    {skill.license}
                  </span>
                </dd>
              </div>
            )}
            {skill.repository && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-secondary)] flex items-center gap-1">
                  <GitBranch className="h-3.5 w-3.5" />
                  Repository
                </dt>
                <dd>
                  <a
                    href={skill.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
                  >
                    Link
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-secondary)]">Updated</dt>
              <dd>{new Date(skill.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        {/* Agents */}
        {agentsList.length > 0 && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] flex items-center gap-1">
              <Bot className="h-3.5 w-3.5" />
              COMPATIBLE AGENTS
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {agentsList.map((agent: string) => (
                <span
                  key={agent}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-900/50 text-purple-300"
                >
                  {agent}
                </span>
              ))}
            </div>
          </div>
        )}

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
