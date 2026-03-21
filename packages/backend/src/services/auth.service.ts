import { eq } from 'drizzle-orm';
import { getRuntime } from '../runtime/index.js';
import { getDb } from '../db.js';
import { users } from '../models/schema.js';
import { deviceCodes } from '../models/schema.js';
import { signJwt } from '../utils/jwt.js';

function generateRandomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function registerUser(username: string, email: string, password: string) {
  const db = getDb();
  const passwordHash = await getRuntime().password.hash(password);

  const [user] = await db.insert(users).values({
    username,
    email,
    passwordHash,
  }).returning();

  return user;
}

export async function authenticateUser(username: string, password: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

  if (!user || !user.passwordHash) return null;

  const valid = await getRuntime().password.verify(user.passwordHash, password);
  if (!valid) return null;

  const token = await signJwt({
    sub: user.id,
    username: user.username,
    role: user.role,
  });

  return { user, token };
}

export async function createDeviceCode() {
  const db = getDb();
  const deviceCode = generateRandomHex(32);
  const userCode = generateRandomHex(4).toUpperCase().slice(0, 8);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  const [record] = await db.insert(deviceCodes).values({
    deviceCode,
    userCode,
    expiresAt,
  }).returning();

  return { deviceCode: record.deviceCode, userCode: record.userCode, expiresAt };
}

export async function approveDeviceCode(userCode: string, userId: string) {
  const db = getDb();
  const [record] = await db.select().from(deviceCodes)
    .where(eq(deviceCodes.userCode, userCode))
    .limit(1);

  if (!record) return { error: 'invalid_code' as const };
  if (record.status !== 'pending') return { error: 'already_used' as const };
  if (new Date(record.expiresAt) < new Date()) return { error: 'expired' as const };

  await db.update(deviceCodes)
    .set({ userId, status: 'approved' })
    .where(eq(deviceCodes.id, record.id));

  return { success: true };
}

export async function pollDeviceToken(deviceCode: string) {
  const db = getDb();
  const [record] = await db.select().from(deviceCodes)
    .where(eq(deviceCodes.deviceCode, deviceCode))
    .limit(1);

  if (!record) return { error: 'invalid_code' as const };
  if (new Date(record.expiresAt) < new Date()) return { error: 'expired_token' as const };
  if (record.status === 'pending') return { error: 'authorization_pending' as const };

  if (record.status === 'approved' && record.userId) {
    const [user] = await db.select().from(users).where(eq(users.id, record.userId)).limit(1);
    if (!user) return { error: 'invalid_code' as const };

    // Mark as used
    await db.update(deviceCodes)
      .set({ status: 'used' })
      .where(eq(deviceCodes.id, record.id));

    const token = await signJwt({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    return { access_token: token, token_type: 'Bearer' as const, expires_in: 604800 };
  }

  return { error: 'authorization_pending' as const };
}

export async function getUserById(userId: string) {
  const db = getDb();
  const [user] = await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    role: users.role,
  }).from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}
