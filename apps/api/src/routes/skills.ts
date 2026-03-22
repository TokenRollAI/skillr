import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import type { AppEnv } from '../env.js';
import { requireAuth, requireNsRole } from '../middleware/auth.js';
import * as skillService from '../services/skill.service.js';
import { getDb } from '../db.js';
import { namespaces, nsMembers } from '../models/schema.js';
import { logAuditEvent } from '../services/audit.service.js';
import { downloadArtifact } from '../lib/storage.js';
import { createTarGz } from '../lib/tar.js';

async function sha256(data: Uint8Array | ArrayBuffer): Promise<string> {
  const buffer = data instanceof Uint8Array ? data.buffer as ArrayBuffer : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const skillsRoutes = new Hono<AppEnv>();

// R2 download proxy — serves artifact directly from R2
skillsRoutes.get('/download/:key{.+}', async (c) => {
  const key = decodeURIComponent(c.req.param('key'));
  const object = await downloadArtifact(key);
  if (!object) return c.json({ error: 'Artifact not found' }, 404);

  const headers = new Headers();
  headers.set('Content-Type', 'application/gzip');
  headers.set('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`);
  if (object.size) {
    headers.set('Content-Length', String(object.size));
  }

  return new Response(object.body, { headers });
});

// Push a skill
skillsRoutes.post('/:ns/:name', requireAuth, async (c) => {
  const ns = c.req.param('ns');
  const name = c.req.param('name');
  const tag = c.req.query('tag') || 'latest';
  const user = c.get('user');

  if (user.role !== 'admin') {
    const db = getDb();
    const [nsRecord] = await db.select().from(namespaces).where(eq(namespaces.name, ns)).limit(1);
    if (!nsRecord) return c.json({ error: 'Namespace not found' }, 404);

    const [membership] = await db.select().from(nsMembers)
      .where(and(eq(nsMembers.userId, user.sub), eq(nsMembers.namespaceId, nsRecord.id)))
      .limit(1);

    if (!membership || membership.role !== 'maintainer') {
      return c.json({ error: 'Only namespace maintainers can push skills' }, 403);
    }
  }

  const contentType = c.req.header('content-type') || '';
  let tarball: Uint8Array;
  let description: string | undefined;
  let readme: string | undefined;
  let metadata: Record<string, unknown> = {};

  if (contentType.includes('application/json')) {
    const body = await c.req.json() as {
      description?: string;
      readme: string;
      metadata?: Record<string, unknown>;
    };
    if (!body.readme) return c.json({ error: 'Missing SKILL.md content' }, 400);
    // Pack SKILL.md content into a proper tar.gz so CLI can install it
    const skillMdBytes = new TextEncoder().encode(body.readme);
    tarball = await createTarGz('SKILL.md', skillMdBytes);
    description = body.description;
    readme = body.readme;
    if (body.metadata) metadata = body.metadata;
  } else if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const file = formData.get('tarball') as File;
    if (!file) return c.json({ error: 'Missing tarball file' }, 400);
    tarball = new Uint8Array(await file.arrayBuffer());
    description = formData.get('description') as string || undefined;
    readme = formData.get('readme') as string || undefined;
    const metaStr = formData.get('metadata') as string;
    if (metaStr) try { metadata = JSON.parse(metaStr); } catch {}
  } else {
    tarball = new Uint8Array(await c.req.arrayBuffer());
  }

  if (tarball.byteLength === 0) return c.json({ error: 'Empty tarball' }, 400);
  if (tarball.byteLength > 50 * 1024 * 1024) return c.json({ error: 'Tarball too large (max 50MB)' }, 413);

  const checksum = await sha256(tarball);

  try {
    const result = await skillService.createOrUpdateSkill(
      ns, name, tag, tarball, checksum, metadata, user.sub, description, readme,
    );
    await logAuditEvent({
      userId: user.sub,
      action: 'skill.push',
      resource: `${ns}/${name}:${tag}`,
      details: { checksum, size: tarball.byteLength },
      ipAddress: c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || 'unknown',
    });
    return c.json({
      name: `${ns}/${name}`,
      tag,
      checksum,
      size: tarball.byteLength,
      artifactKey: result.artifactKey,
    }, 201);
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      return c.json({ error: err.message }, 404);
    }
    throw err;
  }
});

// Helper: extract optional userId from Authorization header
async function extractOptionalUserId(c: any): Promise<string | undefined> {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { verifyJwt } = await import('../utils/jwt.js');
      const payload = await verifyJwt(authHeader.slice(7));
      return payload.sub;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// Get skill info
skillsRoutes.get('/:ns/:name', async (c) => {
  const ns = c.req.param('ns');
  const name = c.req.param('name');
  const result = await skillService.getSkill(ns, name);
  if (!result) return c.json({ error: 'Skill not found' }, 404);

  const userId = await extractOptionalUserId(c);
  const hasAccess = await skillService.checkNamespaceAccess(result.namespace.id, userId);
  if (!hasAccess) return c.json({ error: 'Skill not found' }, 404);

  return c.json({
    name: result.skill.name,
    namespace: result.namespace.name,
    description: result.skill.description,
    latestTag: result.skill.latestTag,
    downloads: result.skill.downloads,
    readme: result.skill.readme,
    createdAt: result.skill.createdAt,
    updatedAt: result.skill.updatedAt,
  });
});

// Get tags
skillsRoutes.get('/:ns/:name/tags', async (c) => {
  const ns = c.req.param('ns');
  const name = c.req.param('name');
  const skill = await skillService.getSkill(ns, name);
  if (!skill) return c.json({ error: 'Skill not found' }, 404);

  const userId = await extractOptionalUserId(c);
  const hasAccess = await skillService.checkNamespaceAccess(skill.namespace.id, userId);
  if (!hasAccess) return c.json({ error: 'Skill not found' }, 404);

  const tags = await skillService.getSkillTags(skill.skill.id);
  return c.json(tags.map(t => ({
    tag: t.tag,
    sizeBytes: t.sizeBytes,
    checksum: t.checksum,
    createdAt: t.createdAt,
  })));
});

// Get specific tag with download URL
skillsRoutes.get('/:ns/:name/tags/:tag', async (c) => {
  const ns = c.req.param('ns');
  const name = c.req.param('name');
  const tag = c.req.param('tag');
  const skill = await skillService.getSkill(ns, name);
  if (!skill) return c.json({ error: 'Skill not found' }, 404);

  const tagResult = await skillService.getSkillTag(skill.skill.id, tag);
  if (!tagResult) return c.json({ error: 'Tag not found' }, 404);

  await skillService.incrementDownloads(skill.skill.id);

  // Build absolute download URL from request origin
  const origin = new URL(c.req.url).origin;
  const downloadUrl = `${origin}${tagResult.downloadUrl}`;

  return c.json({
    tag: tagResult.tag,
    sizeBytes: tagResult.sizeBytes,
    checksum: tagResult.checksum,
    downloadUrl,
    createdAt: tagResult.createdAt,
  });
});

// Search skills
skillsRoutes.get('/', async (c) => {
  const userId = await extractOptionalUserId(c);

  const q = c.req.query('q') || '';
  const ns = c.req.query('namespace');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const agent = c.req.query('agent');
  const tag = c.req.query('tag');

  const results = await skillService.searchSkills(q, ns, page, limit, userId, agent, tag);
  return c.json(results.map(r => ({
    name: r.skill.name,
    namespace: r.namespace.name,
    description: r.skill.description,
    latestTag: r.skill.latestTag,
    downloads: r.skill.downloads,
    updatedAt: r.skill.updatedAt,
  })));
});

// Delete skill
skillsRoutes.delete('/:ns/:name', requireAuth, requireNsRole('ns', 'maintainer'), async (c) => {
  const ns = c.req.param('ns');
  const name = c.req.param('name');
  const deleted = await skillService.deleteSkill(ns, name);
  if (!deleted) return c.json({ error: 'Skill not found' }, 404);
  await logAuditEvent({
    userId: c.get('user').sub,
    action: 'skill.delete',
    resource: `${ns}/${name}`,
  });
  return c.json({ success: true });
});
