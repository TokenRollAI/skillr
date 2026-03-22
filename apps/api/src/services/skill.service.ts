import { eq, and, like, or, desc, sql, inArray } from 'drizzle-orm';
import { getDb } from '../db.js';
import { skills, skillTags } from '../models/schema.js';
import { namespaces, nsMembers } from '../models/schema.js';
import { uploadArtifact, deleteArtifact } from '../lib/storage.js';

export async function createOrUpdateSkill(
  namespaceName: string,
  skillName: string,
  tag: string,
  tarball: Uint8Array,
  checksum: string,
  metadata: Record<string, unknown>,
  publishedBy: string,
  description?: string,
  readme?: string,
) {
  const db = getDb();

  const [ns] = await db.select().from(namespaces).where(eq(namespaces.name, namespaceName)).limit(1);
  if (!ns) throw new Error(`Namespace "${namespaceName}" not found`);

  let [skill] = await db.select().from(skills)
    .where(and(eq(skills.namespaceId, ns.id), eq(skills.name, skillName)))
    .limit(1);

  const now = new Date().toISOString();

  const author = metadata.author as string | undefined;
  const license = metadata.license as string | undefined;
  const repository = metadata.repository as string | undefined;
  const agents = (metadata.agents as string[] | undefined) ?? [];
  const searchTags = (metadata.tags as string[] | undefined) ?? [];
  const deps = (metadata.dependencies as string[] | undefined) ?? [];

  if (!skill) {
    [skill] = await db.insert(skills).values({
      namespaceId: ns.id,
      name: skillName,
      description: description || metadata.description as string || '',
      readme,
      latestTag: tag,
      author: author ?? null,
      license: license ?? null,
      repository: repository ?? null,
      agents,
      searchTags,
      dependencies: deps,
      createdAt: now,
      updatedAt: now,
    }).returning();
  } else {
    await db.update(skills).set({
      description: description || metadata.description as string || skill.description,
      readme: readme || skill.readme,
      latestTag: tag,
      author: author ?? skill.author,
      license: license ?? skill.license,
      repository: repository ?? skill.repository,
      agents: agents.length > 0 ? agents : skill.agents,
      searchTags: searchTags.length > 0 ? searchTags : skill.searchTags,
      dependencies: deps.length > 0 ? deps : skill.dependencies,
      updatedAt: now,
    }).where(eq(skills.id, skill!.id));
  }

  // Upload to R2
  const artifactKey = `${namespaceName}/${skillName}/${tag}.tar.gz`;
  await uploadArtifact(artifactKey, tarball);

  // Upsert tag
  const existingTag = await db.select().from(skillTags)
    .where(and(eq(skillTags.skillId, skill!.id), eq(skillTags.tag, tag)))
    .limit(1);

  if (existingTag.length > 0) {
    await db.update(skillTags).set({
      artifactKey,
      sizeBytes: tarball.byteLength,
      checksum,
      metadata,
      publishedBy,
    }).where(eq(skillTags.id, existingTag[0]!.id));
  } else {
    await db.insert(skillTags).values({
      skillId: skill!.id,
      tag,
      artifactKey,
      sizeBytes: tarball.byteLength,
      checksum,
      metadata,
      publishedBy,
      createdAt: now,
    });
  }

  // If tag is a version (not "latest"), also upsert "latest" pointing to same artifact
  if (tag !== 'latest') {
    const existingLatest = await db.select().from(skillTags)
      .where(and(eq(skillTags.skillId, skill!.id), eq(skillTags.tag, 'latest')))
      .limit(1);

    if (existingLatest.length > 0) {
      await db.update(skillTags).set({
        artifactKey,
        sizeBytes: tarball.byteLength,
        checksum,
        metadata,
        publishedBy,
      }).where(eq(skillTags.id, existingLatest[0]!.id));
    } else {
      await db.insert(skillTags).values({
        skillId: skill!.id,
        tag: 'latest',
        artifactKey,
        sizeBytes: tarball.byteLength,
        checksum,
        metadata,
        publishedBy,
        createdAt: now,
      });
    }
  }

  return { skill: skill!, artifactKey };
}

export async function getSkill(namespaceName: string, skillName: string) {
  const db = getDb();
  const result = await db.select({
    skill: skills,
    namespace: namespaces,
  }).from(skills)
    .innerJoin(namespaces, eq(skills.namespaceId, namespaces.id))
    .where(and(eq(namespaces.name, namespaceName), eq(skills.name, skillName)))
    .limit(1);

  return result[0] ?? null;
}

export async function getSkillTags(skillId: string) {
  const db = getDb();
  return db.select().from(skillTags)
    .where(eq(skillTags.skillId, skillId))
    .orderBy(desc(skillTags.createdAt));
}

export async function getSkillTag(skillId: string, tag: string) {
  const db = getDb();
  const [result] = await db.select().from(skillTags)
    .where(and(eq(skillTags.skillId, skillId), eq(skillTags.tag, tag)))
    .limit(1);

  if (!result) return null;

  // R2 doesn't support presigned URLs; return proxy download path
  const downloadUrl = `/api/skills/download/${encodeURIComponent(result.artifactKey)}`;
  return { ...result, downloadUrl };
}

export async function getAccessibleNamespaceIds(userId?: string): Promise<string[]> {
  const db = getDb();

  if (!userId) {
    const publicNs = await db.select({ id: namespaces.id }).from(namespaces)
      .where(eq(namespaces.visibility, 'public'));
    return publicNs.map(n => n.id);
  }

  const openNs = await db.select({ id: namespaces.id }).from(namespaces)
    .where(or(eq(namespaces.visibility, 'public'), eq(namespaces.visibility, 'internal')));

  const privateNs = await db.select({ id: nsMembers.namespaceId }).from(nsMembers)
    .innerJoin(namespaces, eq(nsMembers.namespaceId, namespaces.id))
    .where(and(eq(nsMembers.userId, userId), eq(namespaces.visibility, 'private')));

  return [...openNs.map(n => n.id), ...privateNs.map(n => n.id)];
}

export async function checkNamespaceAccess(namespaceId: string, userId?: string): Promise<boolean> {
  const db = getDb();
  const [ns] = await db.select().from(namespaces).where(eq(namespaces.id, namespaceId)).limit(1);
  if (!ns) return false;

  if (ns.visibility === 'public') return true;
  if (ns.visibility === 'internal' && userId) return true;
  if (ns.visibility === 'private' && userId) {
    const [membership] = await db.select().from(nsMembers)
      .where(and(eq(nsMembers.userId, userId), eq(nsMembers.namespaceId, namespaceId)))
      .limit(1);
    return !!membership;
  }
  return false;
}

export async function searchSkills(query: string, namespace?: string, page = 1, limit = 20, userId?: string, agentFilter?: string, tagFilter?: string) {
  const db = getDb();
  const offset = (page - 1) * limit;

  const accessibleIds = await getAccessibleNamespaceIds(userId);
  if (accessibleIds.length === 0) return [];

  const conditions = [];
  conditions.push(inArray(skills.namespaceId, accessibleIds));

  if (query) {
    // SQLite LIKE is case-insensitive for ASCII by default
    conditions.push(
      or(
        like(skills.name, `%${query}%`),
        like(skills.description, `%${query}%`),
      )
    );
  }
  if (namespace) {
    const [ns] = await db.select().from(namespaces).where(eq(namespaces.name, namespace)).limit(1);
    if (ns) conditions.push(eq(skills.namespaceId, ns.id));
  }
  if (agentFilter) {
    const safe = agentFilter.replace(/[%_]/g, '');
    conditions.push(like(skills.agents, `%"${safe}"%`));
  }
  if (tagFilter) {
    const safe = tagFilter.replace(/[%_]/g, '');
    conditions.push(like(skills.searchTags, `%"${safe}"%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const results = await db.select({
    skill: skills,
    namespace: namespaces,
  }).from(skills)
    .innerJoin(namespaces, eq(skills.namespaceId, namespaces.id))
    .where(whereClause)
    .orderBy(desc(skills.downloads))
    .limit(limit)
    .offset(offset);

  return results;
}

export async function deleteSkill(namespaceName: string, skillName: string) {
  const db = getDb();
  const result = await getSkill(namespaceName, skillName);
  if (!result) return false;

  const tags = await getSkillTags(result.skill.id);
  for (const tag of tags) {
    try { await deleteArtifact(tag.artifactKey); } catch {}
  }

  await db.delete(skills).where(eq(skills.id, result.skill.id));
  return true;
}

export async function incrementDownloads(skillId: string) {
  const db = getDb();
  await db.update(skills).set({
    downloads: sql`${skills.downloads} + 1`,
  }).where(eq(skills.id, skillId));
}
