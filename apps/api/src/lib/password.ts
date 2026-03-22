/**
 * Password hashing using Web Crypto PBKDF2.
 * Compatible with Cloudflare Workers runtime.
 */

const ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(password, salt);
  const keyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', key));

  // Format: iterations:salt:hash (all hex-encoded)
  return `${ITERATIONS}:${toHex(salt)}:${toHex(keyBytes)}`;
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  const [iterStr, saltHex, hashHex] = hash.split(':');
  if (!iterStr || !saltHex || !hashHex) return false;

  const iterations = parseInt(iterStr, 10);
  const salt = fromHex(saltHex);
  const key = await deriveKey(password, salt, iterations);
  const keyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', key));

  return toHex(keyBytes) === hashHex;
}

async function deriveKey(password: string, salt: Uint8Array, iterations = ITERATIONS): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: KEY_LENGTH * 8 },
    true,
    ['encrypt'],
  );
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
