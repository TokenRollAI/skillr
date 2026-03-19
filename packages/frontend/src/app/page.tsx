export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          AI Agent 技能聚合与分发中心
        </h1>
        <p className="mt-4 text-lg text-[var(--color-text-secondary)]">
          DockerHub + NPM for AI Agent Skills
        </p>

        {/* Search */}
        <div className="mx-auto mt-8 max-w-2xl">
          <form action="/skills" method="GET">
            <div className="flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <input
                type="text"
                name="q"
                placeholder="Search skills... (e.g., deploy, lint, test)"
                className="flex-1 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[var(--color-text-secondary)]"
              />
              <button
                type="submit"
                className="px-6 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)]"
              >
                Search
              </button>
            </div>
          </form>
        </div>

        {/* Quick Install */}
        <div className="mx-auto mt-6 max-w-md">
          <div className="flex items-center justify-center gap-2 rounded-md bg-[var(--color-bg-secondary)] px-4 py-2 font-mono text-sm">
            <span className="text-[var(--color-text-secondary)]">$</span>
            <span>skillr install @default/hello-world</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <FeatureCard
          title="Scan & Push"
          description="Auto-discover SKILL.md files and publish to registry with one command."
          command="skillr scan && skillr push @ns/skill"
        />
        <FeatureCard
          title="Install & Symlink"
          description="Install skills with automatic symlink to .claude/ or .agents/ directories."
          command="skillr install @ns/skill"
        />
        <FeatureCard
          title="MCP Gateway"
          description="Let AI agents dynamically discover and use skills via MCP protocol."
          command='search_skills({ query: "deploy" })'
        />
      </section>
    </div>
  );
}

function FeatureCard({ title, description, command }: { title: string; description: string; command: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
      <h3 className="text-lg font-semibold text-[var(--color-primary)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{description}</p>
      <div className="mt-4 rounded-md bg-[var(--color-bg)] px-3 py-2 font-mono text-xs text-[var(--color-text-secondary)]">
        $ {command}
      </div>
    </div>
  );
}
