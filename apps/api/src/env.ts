/**
 * Cloudflare Workers bindings type definition.
 * All configuration comes from wrangler.toml bindings, not process.env.
 */
export type Bindings = {
  DB: D1Database;
  ARTIFACTS: R2Bucket;
  JWT_SECRET: string;
  FRONTEND_URL: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    user: import('./utils/jwt.js').JwtPayload;
  };
};

// Per-request globals (safe in single-threaded Workers)
let _jwtSecret = '';
let _frontendUrl = '';

export function setEnvFromBindings(bindings: Bindings) {
  _jwtSecret = bindings.JWT_SECRET;
  _frontendUrl = bindings.FRONTEND_URL;
}

export function getJwtSecret(): string {
  return _jwtSecret;
}

export function getFrontendUrl(): string {
  return _frontendUrl;
}
