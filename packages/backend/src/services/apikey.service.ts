import { randomBytes, createHash } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db.js';
import { apiKeys } from '../models/schema.js';
import { users } from '../models/schema.js';

function generateApiKey(): { fullKey: string; prefix: string; keyHash: string } {
  const random = randomBytes(32).toString('hex');
  const fullKey = `sk_live_${random}`;
  const prefix = `sk_live_${random.slice(0, 4)}...`;
  const keyHash = createHash('sha256').update(fullKey).digest('hex');
  return { fullKey, prefix, keyHash };
}

export async function createApiKey(
  userId: string,
  name: string,
  scopes: string[] = ['read'],
  expiresAt?: Date,
) {
  const db = getDb();
  const { fullKey, prefix, keyHash } = generateApiKey();

  const [record] = await db.insert(apiKeys).values({
    userId,
    name,
    prefix,
    keyHash,
    scopes,
    expiresAt: expiresAt ?? null,
  }).returning();

  return {
    id: record!.id,
    name: record!.name,
    key: fullKey,  // Only returned at creation time
    prefix: record!.prefix,
    scopes: record!.scopes,
    expiresAt: record!.expiresAt,
    createdAt: record!.createdAt,
  };
}

export async function listApiKeys(userId: string) {
  const db = getDb();
  return db.select({
    id: apiKeys.id,
    name: apiKeys.name,
    prefix: apiKeys.prefix,
    scopes: apiKeys.scopes,
    lastUsedAt: apiKeys.lastUsedAt,
    expiresAt: apiKeys.expiresAt,
    revoked: apiKeys.revoked,
    createdAt: apiKeys.createdAt,
  }).from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(apiKeys.createdAt);
}

export async function getApiKey(id: string, userId: string) {
  const db = getDb();
  const [record] = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
    .limit(1);
  return record ?? null;
}

export async function revokeApiKey(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.update(apiKeys)
    .set({ revoked: true, updatedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
    .returning();
  return result.length > 0;
}

export async function rotateApiKey(id: string, userId: string) {
  const db = getDb();
  const existing = await getApiKey(id, userId);
  if (!existing) return null;

  // Revoke old key
  await revokeApiKey(id, userId);

  // Create new key with same name and scopes
  return createApiKey(userId, existing.name, existing.scopes as string[], existing.expiresAt ?? undefined);
}

export async function validateApiKey(fullKey: string) {
  const db = getDb();
  const keyHash = createHash('sha256').update(fullKey).digest('hex');

  const [record] = await db.select({
    id: apiKeys.id,
    userId: apiKeys.userId,
    revoked: apiKeys.revoked,
    expiresAt: apiKeys.expiresAt,
    scopes: apiKeys.scopes,
  }).from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!record) return null;
  if (record.revoked) return null;
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) return null;

  // Update last_used_at
  await db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, record.id));

  // Get user info
  const [user] = await db.select({
    id: users.id,
    username: users.username,
    role: users.role,
  }).from(users)
    .where(eq(users.id, record.userId))
    .limit(1);

  if (!user) return null;

  return {
    sub: user.id,
    username: user.username,
    role: user.role,
    scopes: record.scopes,
  };
}
