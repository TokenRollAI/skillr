import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BACKEND_URL = process.env.SKILLHUB_BACKEND_URL || 'http://localhost:3001';
const TOKEN = process.env.SKILLHUB_TOKEN || '';

async function apiRequest<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

  const res = await fetch(`${BACKEND_URL}${path}`, { headers });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

const server = new McpServer({
  name: 'mcp-skillr',
  version: '0.1.0',
});

// Tool: search_skills
server.tool(
  'search_skills',
  'Search for AI agent skills in the Skillr registry. Returns a list of skills matching the query.',
  {
    query: z.string().describe('Search query (e.g., "deploy frontend", "lint", "test")'),
    namespace: z.string().optional().describe('Filter by namespace (e.g., "@frontend")'),
    limit: z.number().optional().default(10).describe('Maximum number of results'),
  },
  async ({ query, namespace, limit }) => {
    const params = new URLSearchParams({ q: query, limit: String(limit || 10) });
    if (namespace) params.set('namespace', namespace);

    try {
      const results = await apiRequest<any[]>(`/api/skills?${params}`);

      if (results.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `No skills found for query: "${query}"` }],
        };
      }

      const text = results.map((r: any) =>
        `- **${r.namespace}/${r.name}** (${r.latestTag || 'latest'}) - ${r.description || 'No description'}\n  Install: \`skillr install ${r.namespace}/${r.name}\`\n  Downloads: ${r.downloads || 0}`
      ).join('\n\n');

      return {
        content: [{ type: 'text' as const, text: `Found ${results.length} skill(s):\n\n${text}` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text' as const, text: `Error searching skills: ${err.message}` }],
        isError: true,
      };
    }
  },
);

// Tool: get_skill_info
server.tool(
  'get_skill_info',
  'Get detailed information about a specific skill, including its README and available versions.',
  {
    namespace: z.string().describe('Namespace (e.g., "@frontend")'),
    name: z.string().describe('Skill name (e.g., "deploy-helper")'),
    tag: z.string().optional().default('latest').describe('Version tag'),
  },
  async ({ namespace, name, tag }) => {
    try {
      const skill = await apiRequest<any>(`/api/skills/${namespace}/${name}`);
      const tags = await apiRequest<any[]>(`/api/skills/${namespace}/${name}/tags`);

      const versionList = tags.map((t: any) => `  - ${t.tag} (${new Date(t.createdAt).toLocaleDateString()})`).join('\n');

      const text = [
        `# ${namespace}/${name}`,
        '',
        skill.description || 'No description',
        '',
        `## Install`,
        '```',
        `skillr install ${namespace}/${name}`,
        '```',
        '',
        `## Metadata`,
        `- Latest: ${skill.latestTag || 'latest'}`,
        `- Downloads: ${skill.downloads || 0}`,
        `- Updated: ${new Date(skill.updatedAt).toLocaleDateString()}`,
        '',
        `## Versions`,
        versionList || '  No versions published',
        '',
        `## README`,
        skill.readme || 'No README available.',
      ].join('\n');

      return {
        content: [{ type: 'text' as const, text }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text' as const, text: `Error getting skill info: ${err.message}` }],
        isError: true,
      };
    }
  },
);

// Tool: list_namespaces
server.tool(
  'list_namespaces',
  'List all available namespaces in the Skillr registry.',
  {},
  async () => {
    try {
      const namespaces = await apiRequest<any[]>('/api/namespaces');

      if (namespaces.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No namespaces found.' }],
        };
      }

      const text = namespaces.map((ns: any) =>
        `- **${ns.name}** (${ns.visibility}) - ${ns.description || 'No description'}`
      ).join('\n');

      return {
        content: [{ type: 'text' as const, text: `Available namespaces:\n\n${text}` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text' as const, text: `Error listing namespaces: ${err.message}` }],
        isError: true,
      };
    }
  },
);

// Tool: get_install_instructions
server.tool(
  'get_install_instructions',
  'Get installation instructions for a skill. Returns CLI commands to install and use the skill.',
  {
    namespace: z.string().describe('Namespace (e.g., "@frontend")'),
    name: z.string().describe('Skill name (e.g., "deploy-helper")'),
  },
  async ({ namespace, name }) => {
    try {
      const skill = await apiRequest<any>(`/api/skills/${namespace}/${name}`);

      const text = [
        `# Installing ${namespace}/${name}`,
        '',
        '## Quick Install',
        '```bash',
        `skillr install ${namespace}/${name}`,
        '```',
        '',
        '## What this does:',
        `1. Downloads the skill package from the registry`,
        `2. Extracts it to ~/.skillr/cache/${namespace}/${name}/`,
        `3. Creates a symlink in your project:`,
        `   - If .claude/ exists → .claude/skills/${namespace}/${name}`,
        `   - If .agents/ exists → .agents/skills/${namespace}/${name}`,
        '',
        '## Install specific version',
        '```bash',
        `skillr install ${namespace}/${name} -t v1.0.0`,
        '```',
        '',
        '## Update to latest',
        '```bash',
        `skillr update ${namespace}/${name}`,
        '```',
        '',
        skill.description ? `## About\n${skill.description}` : '',
      ].filter(Boolean).join('\n');

      return {
        content: [{ type: 'text' as const, text }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text' as const, text: `Skill ${namespace}/${name} not found. Try \`search_skills\` to find available skills.` }],
        isError: true,
      };
    }
  },
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
