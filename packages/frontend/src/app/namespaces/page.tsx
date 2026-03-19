export default async function NamespacesPage() {
  let namespaces: any[] = [];
  try {
    const res = await fetch(`${process.env.BACKEND_INTERNAL_URL}/api/namespaces`, { cache: 'no-store' });
    if (res.ok) namespaces = await res.json();
  } catch {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Namespaces</h1>
        <a
          href="/namespaces/create"
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-black hover:opacity-90"
        >
          Create Namespace
        </a>
      </div>
      {namespaces.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">No namespaces yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {namespaces.map((ns: any, i: number) => (
            <div key={i} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
              <h2 className="font-semibold text-[var(--color-primary)]">{ns.name}</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{ns.description || 'No description'}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                  {ns.visibility}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
