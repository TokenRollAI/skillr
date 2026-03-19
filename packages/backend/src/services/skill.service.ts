import { eq, and, ilike, or, desc, sql } from 'drizzle-orm';
import { getDb } from '../db.js';
import { skills, skillTags } from '../models/schema.js';
import { namespaces } from '../models/schema.js';
import { uploadArtifact, getSignedDownloadUrl, deleteArtifact } from './storage.service.js';

export async function createOrUpdateSkill(
  namespaceName: string,
  skillName: string,
  tag: string,
  tarball: Buffer,
  checksum: string,
  metadata: Record<string, unknown>,
  publishedBy: string,
  description?: string,
  readme?: string,
) {
  const db = getDb();

  // Find namespace
  const [ns] = await db.select().from(namespaces).where(eq(namespaces.name, namespaceName)).limit(1);
  if (!ns) throw new Error(`Namespace "${namespaceName}" not found`);

  // Upsert skill
  let [skill] = await db.select().from(skills)
    .where(and(eq(skills.namespaceId, ns.id), eq(skills.name, skillName)))
    .limit(1);

  if (!skill) {
    [skill] = await db.insert(skills).values({
      namespaceId: ns.id,
      name: skillName,
      description: description || metadata.description as string || '',
      readme,
      latestTag: tag,
    }).returning();
  } else {
    await db.update(skills).set({
      description: description || metadata.description as string || skill.description,
      readme: readme || skill.readme,
      latestTag: tag,
      updatedAt: new Date(),
    }).where(eq(skills.id, skill!.id));
  }

  // Upload to S3
  const artifactKey = `${namespaceName}/${skillName}/${tag}.tar.gz`;
  await uploadArtifact(artifactKey, tarball);

  // Upsert tag
  const existingTag = await db.select().from(skillTags)
    .where(and(eq(skillTags.skillId, skill!.id), eq(skillTags.tag, tag)))
    .limit(1);

  if (existingTag.length > 0) {
    await db.update(skillTags).set({
      artifactKey,
      sizeBytes: tarball.length,
      checksum,
      metadata,
      publishedBy,
    }).where(eq(skillTags.id, existingTag[0]!.id));
  } else {
    await db.insert(skillTags).values({
      skillId: skill!.id,
      tag,
      artifactKey,
      sizeBytes: tarball.length,
      checksum,
      metadata,
      publishedBy,
    });
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

  const downloadUrl = await getSignedDownloadUrl(result.artifactKey);
  return { ...result, downloadUrl };
}

export async function searchSkills(query: string, namespace?: string, page = 1, limit = 20) {
  const db = getDb();
  const offset = (page - 1) * limit;

  const conditions = [];
  if (query) {
    conditions.push(
      or(
        ilike(skills.name, `%${query}%`),
        ilike(skills.description, `%${query}%`),
      )
    );
  }
  if (namespace) {
    const [ns] = await db.select().from(namespaces).where(eq(namespaces.name, namespace)).limit(1);
    if (ns) conditions.push(eq(skills.namespaceId, ns.id));
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

export async function listSkills(page = 1, limit = 20, namespace?: string) {
  return searchSkills('', namespace, page, limit);
}

export async function deleteSkill(namespaceName: string, skillName: string) {
  const db = getDb();
  const result = await getSkill(namespaceName, skillName);
  if (!result) return false;

  // Delete all tags' artifacts from S3
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
