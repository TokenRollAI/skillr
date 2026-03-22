import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { streamSSE } from 'hono/streaming';
import type { AppEnv } from '../env.js';
import * as skillService from '../services/skill.service.js';
import { getDb } from '../db.js';
import { namespaces } from '../models/schema.js';

export const mcpRoutes = new Hono<AppEnv>();

// MCP tool definitions
const TOOLS = [
  {
    name: 'search_skills',
    description: 'Search for AI agent skills in the Skillr registry',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
        namespace: { type: 'string', description: 'Filter by namespace (optional)' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_skill_info',
    description: 'Get detailed information about a specific skill',
    inputSchema: {
      type: 'object' as const,
      properties: {
        namespace: { type: 'string', description: 'Namespace (e.g., @default)' },
        name: { type: 'string', description: 'Skill name' },
      },
      required: ['namespace', 'name'],
    },
  },
  {
    name: 'list_namespaces',
    description: 'List all available namespaces',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_install_instructions',
    description: 'Get installation instructions for a skill',
    inputSchema: {
      type: 'object' as const,
      properties: {
        namespace: { type: 'string', description: 'Namespace' },
        name: { type: 'string', description: 'Skill name' },
      },
      required: ['namespace', 'name'],
    },
  },
];

// Handle tool calls
async function handleToolCall(name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case 'search_skills': {
      const results = await skillService.searchSkills(
        args.query || '',
        args.namespace,
        1,
        args.limit || 10,
      );
      if (results.length === 0) return `No skills found for: "${args.query}"`;
      return results.map((r: any) =>
        `- **${r.namespace.name}/${r.skill.name}** (${r.skill.latestTag || 'latest'}) - ${r.skill.description || 'No description'}\n  Install: \`skillr install ${r.namespace.name}/${r.skill.name}\``
      ).join('\n\n');
    }
    case 'get_skill_info': {
      const skill = await skillService.getSkill(args.namespace, args.name);
      if (!skill) return `Skill ${args.namespace}/${args.name} not found.`;
      const tags = await skillService.getSkillTags(skill.skill.id);
      return [
        `# ${skill.namespace.name}/${skill.skill.name}`,
        skill.skill.description || '',
        `\nInstall: \`skillr install ${skill.namespace.name}/${skill.skill.name}\``,
        `Downloads: ${skill.skill.downloads}`,
        `Versions: ${tags.map((t: any) => t.tag).join(', ') || 'none'}`,
        skill.skill.readme ? `\n---\n${skill.skill.readme}` : '',
      ].join('\n');
    }
    case 'list_namespaces': {
      const db = getDb();
      const nsList = await db.select().from(namespaces).where(eq(namespaces.visibility, 'public'));
      if (nsList.length === 0) return 'No namespaces found.';
      return nsList.map((ns: any) => `- **${ns.name}** (${ns.visibility}) - ${ns.description || ''}`).join('\n');
    }
    case 'get_install_instructions': {
      const skill = await skillService.getSkill(args.namespace, args.name);
      if (!skill) return `Skill not found. Try search_skills to find available skills.`;
      return [
        `# Installing ${args.namespace}/${args.name}`,
        '```bash',
        `skillr install ${args.namespace}/${args.name}`,
        '```',
        `This downloads the skill and creates a symlink:`,
        `- .claude/ project → .claude/skills/${args.namespace}/${args.name}`,
        `- .agents/ project → .agents/skills/${args.namespace}/${args.name}`,
      ].join('\n');
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

// Simple MCP-compatible JSON-RPC endpoint
// This provides a REST-like interface that MCP clients can use
mcpRoutes.get('/tools', async (c) => {
  return c.json({ tools: TOOLS });
});

mcpRoutes.post('/call', async (c) => {
  const body = await c.req.json() as { tool: string; arguments: Record<string, any> };

  if (!body.tool) return c.json({ error: 'Missing tool name' }, 400);

  const toolDef = TOOLS.find(t => t.name === body.tool);
  if (!toolDef) return c.json({ error: `Unknown tool: ${body.tool}` }, 404);

  try {
    const result = await handleToolCall(body.tool, body.arguments || {});
    return c.json({
      content: [{ type: 'text', text: result }],
    });
  } catch (err: any) {
    return c.json({
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    });
  }
});

// SSE endpoint for streaming MCP (JSON-RPC over SSE)
mcpRoutes.get('/sse', async (c) => {
  return streamSSE(c, async (stream) => {
    // Send initial server info
    await stream.writeSSE({
      event: 'endpoint',
      data: '/mcp/message',
    });
  });
});

// JSON-RPC message handler for MCP protocol
mcpRoutes.post('/message', async (c) => {
  const body = await c.req.json() as { jsonrpc: string; method: string; params?: any; id?: number };

  if (body.method === 'initialize') {
    return c.json({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'skillr-mcp', version: '0.1.0' },
      },
    });
  }

  if (body.method === 'notifications/initialized') {
    return c.json({ jsonrpc: '2.0', id: body.id, result: {} });
  }

  if (body.method === 'tools/list') {
    return c.json({
      jsonrpc: '2.0',
      id: body.id,
      result: { tools: TOOLS },
    });
  }

  if (body.method === 'tools/call') {
    const { name, arguments: args } = body.params || {};
    try {
      const result = await handleToolCall(name, args || {});
      return c.json({
        jsonrpc: '2.0',
        id: body.id,
        result: { content: [{ type: 'text', text: result }] },
      });
    } catch (err: any) {
      return c.json({
        jsonrpc: '2.0',
        id: body.id,
        result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true },
      });
    }
  }

  return c.json({
    jsonrpc: '2.0',
    id: body.id,
    error: { code: -32601, message: `Method not found: ${body.method}` },
  });
});
