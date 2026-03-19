export default async function SkillsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const q = params.q || '';
  const page = parseInt(params.page || '1');

  let skills: any[] = [];
  try {
    const searchQuery = new URLSearchParams({ q, page: String(page), limit: '20' });
    const res = await fetch(`${process.env.BACKEND_INTERNAL_URL}/api/skills?${searchQuery}`, {
      cache: 'no-store',
    });
    if (res.ok) skills = await res.json();
  } catch {
    // Backend might not be running
  }

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
