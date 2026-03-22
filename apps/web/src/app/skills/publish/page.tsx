'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';

export default function PublishSkillPage() {
  const [namespaces, setNamespaces] = useState<any[]>([]);
  const [namespace, setNamespace] = useState('');
  const [skillName, setSkillName] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [license, setLicense] = useState('');
  const [agentsInput, setAgentsInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [readme, setReadme] = useState(`---
name:
description:
version: 1.0.0
---

# My Skill

Describe what this skill does here.

## Usage

Explain how to use this skill.
`);
  const [tag, setTag] = useState('latest');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const token = typeof window !== 'undefined' ? localStorage.getItem('skillr_token') : null;

  useEffect(() => {
    // Load available namespaces
    fetch(apiUrl('/api/namespaces'))
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setNamespaces(data);
        if (data.length > 0) setNamespace(data[0].name);
      });
  }, []);

  // Update frontmatter when name/description change
  useEffect(() => {
    if (skillName || description) {
      setReadme(prev => {
        // Replace name and description in frontmatter
        return prev.replace(/^(---\nname:).*$/m, `$1 ${skillName}`)
                   .replace(/^(description:).*$/m, `$1 ${description}`);
      });
    }
  }, [skillName, description]);

  function parseCommaSeparated(value: string): string[] {
    return value
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Please login first');
      return;
    }
    if (!namespace) {
      setError('Please select a namespace');
      return;
    }
    if (!skillName) {
      setError('Please enter a skill name');
      return;
    }
    if (!readme.trim()) {
      setError('SKILL.md content is required');
      return;
    }

    // Validate skill name format
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(skillName)) {
      setError('Skill name must be lowercase letters, numbers, dots, hyphens, underscores');
      return;
    }

    setLoading(true);

    const agents = parseCommaSeparated(agentsInput);
    const tags = parseCommaSeparated(tagsInput);

    try {
      const res = await fetch(apiUrl(`/api/skills/${namespace}/${skillName}?tag=${tag}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description,
          readme,
          metadata: {
            name: skillName,
            description,
            ...(author && { author }),
            ...(license && { license }),
            ...(agents.length > 0 && { agents }),
            ...(tags.length > 0 && { tags }),
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Publish failed');
        return;
      }

      const result = await res.json();
      setSuccess(`Published ${result.name}:${result.tag} successfully!`);

      // Redirect to skill page after 2 seconds
      setTimeout(() => {
        router.push(`/skills/${namespace}/${skillName}`);
      }, 2000);
    } catch {
      setError('Connection error. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="py-12 text-center">
        <h1 className="text-2xl font-bold">Publish a Skill</h1>
        <p className="mt-4 text-[var(--color-text-secondary)]">
          Please <a href="/login?redirect=/skills/publish" className="text-[var(--color-primary)]">login</a> first to publish skills.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-8">
      <h1 className="text-2xl font-bold mb-2">Publish a Skill</h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        Create and publish a new AI agent skill to the registry.
      </p>

      {success && (
        <div className="mb-6 rounded-lg border border-[var(--color-success)] bg-[var(--color-bg-secondary)] p-4 text-[var(--color-success)]">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Namespace + Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Namespace</label>
            <select
              value={namespace}
              onChange={e => setNamespace(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm outline-none"
              required
            >
              {namespaces.map((ns: any) => (
                <option key={ns.name} value={ns.name}>{ns.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Skill Name</label>
            <input
              type="text"
              value={skillName}
              onChange={e => setSkillName(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
              placeholder="my-awesome-skill"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm outline-none"
              required
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="A brief description of what this skill does"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm outline-none"
            required
          />
        </div>

        {/* Author + License */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
              Author
              <span className="ml-1 text-xs text-[var(--color-text-secondary)]">(optional)</span>
            </label>
            <input
              type="text"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Your Name"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
              License
              <span className="ml-1 text-xs text-[var(--color-text-secondary)]">(optional)</span>
            </label>
            <input
              type="text"
              value={license}
              onChange={e => setLicense(e.target.value)}
              placeholder="MIT"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>

        {/* Agents */}
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
            Compatible Agents
            <span className="ml-1 text-xs text-[var(--color-text-secondary)]">(optional, comma-separated)</span>
          </label>
          <input
            type="text"
            value={agentsInput}
            onChange={e => setAgentsInput(e.target.value)}
            placeholder="claude-code, codex, openClaw"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm outline-none"
          />
          {agentsInput && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {parseCommaSeparated(agentsInput).map((agent) => (
                <span
                  key={agent}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-900/50 text-purple-300"
                >
                  {agent}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
            Tags
            <span className="ml-1 text-xs text-[var(--color-text-secondary)]">(optional, comma-separated)</span>
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
            placeholder="testing, automation, react"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm outline-none"
          />
          {tagsInput && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {parseCommaSeparated(tagsInput).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Version Tag */}
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Version Tag</label>
          <input
            type="text"
            value={tag}
            onChange={e => setTag(e.target.value)}
            placeholder="latest"
            className="w-48 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm outline-none"
          />
        </div>

        {/* SKILL.md Editor */}
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
            SKILL.md Content
            <span className="ml-2 text-xs text-[var(--color-text-secondary)]">(Markdown with YAML frontmatter)</span>
          </label>
          <textarea
            value={readme}
            onChange={e => setReadme(e.target.value)}
            rows={20}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 font-mono text-sm outline-none focus:border-[var(--color-primary)]"
            required
          />
        </div>

        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Or use CLI: <code className="rounded bg-[var(--color-bg-tertiary)] px-1 py-0.5">skillr push {namespace}/{skillName || 'skill-name'}</code>
          </p>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-[var(--color-primary)] px-6 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Publishing...' : 'Publish Skill'}
          </button>
        </div>
      </form>
    </div>
  );
}
