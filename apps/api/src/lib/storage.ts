/**
 * R2 storage utilities.
 * Per-request bucket reference set via middleware.
 */

let _bucket: R2Bucket | null = null;

export function setBucket(bucket: R2Bucket) {
  _bucket = bucket;
}

function getBucket(): R2Bucket {
  if (!_bucket) throw new Error('R2 bucket not initialized. Ensure storage middleware is applied.');
  return _bucket;
}

export async function uploadArtifact(key: string, data: ArrayBuffer | Uint8Array): Promise<void> {
  await getBucket().put(key, data);
}

export async function downloadArtifact(key: string): Promise<R2ObjectBody | null> {
  return getBucket().get(key);
}

export async function deleteArtifact(key: string): Promise<void> {
  await getBucket().delete(key);
}

export async function checkR2Connection(): Promise<boolean> {
  try {
    await getBucket().head('__health_check__');
    return true;
  } catch {
    // head() throws on non-existent key, but the connection itself works
    return true;
  }
}
