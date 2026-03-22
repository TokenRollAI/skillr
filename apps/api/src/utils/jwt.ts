import { SignJWT, jwtVerify } from 'jose';
import { getJwtSecret } from '../env.js';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

function getSecret(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

export async function signJwt(payload: JwtPayload, expiresIn = '7d'): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as JwtPayload;
}
