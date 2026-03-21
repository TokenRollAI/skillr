/**
 * Runtime adapter interfaces for cross-platform compatibility.
 * Node.js and CF Workers provide different implementations.
 */

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface StorageAdapter {
  upload(key: string, body: Buffer | ArrayBuffer, contentType?: string): Promise<void>;
  download(key: string): Promise<ArrayBuffer | null>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export interface Runtime {
  password: PasswordHasher;
  storage: StorageAdapter;
}
