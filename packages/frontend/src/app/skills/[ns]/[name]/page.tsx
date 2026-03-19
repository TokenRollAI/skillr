import CopyButton from '../../../../components/copy-button';
import DeleteSkillButton from '../../../../components/delete-skill-button';

export default async function SkillDetailPage({ params }: { params: Promise<{ ns: string; name: string }> }) {
  const { ns, name } = await params;

  let skill: any = null;
  let tags: any[] = [];
  try {
    const res = await fetch(`${process.env.BACKEND_INTERNAL_URL}/api/skills/${ns}/${name}`, { cache: 'no-store' });
    if (res.ok) skill = await res.json();
    const tagsRes = await fetch(`${process.env.BACKEND_INTERNAL_URL}/api/skills/${ns}/${name}/tags`, { cache: 'no-store' });
    if (tagsRes.ok) tags = await tagsRes.json();
  } catch {}

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
