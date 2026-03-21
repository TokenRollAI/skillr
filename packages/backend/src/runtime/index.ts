import type { Runtime } from './types.js';

let _runtime: Runtime | null = null;

export function setRuntime(runtime: Runtime): void {
  _runtime = runtime;
}

export function getRuntime(): Runtime {
  if (!_runtime) throw new Error('Runtime not initialized. Call setRuntime() first.');
  return _runtime;
}

export type { Runtime, PasswordHasher, StorageAdapter } from './types.js';
