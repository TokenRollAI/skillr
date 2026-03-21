import { getRuntime } from '../runtime/index.js';

export async function uploadArtifact(key: string, body: Buffer | ArrayBuffer, contentType = 'application/gzip'): Promise<void> {
  return getRuntime().storage.upload(key, body, contentType);
}

export async function downloadArtifact(key: string): Promise<ArrayBuffer | null> {
  return getRuntime().storage.download(key);
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  return getRuntime().storage.getSignedUrl(key, expiresIn);
}

export async function deleteArtifact(key: string): Promise<void> {
  return getRuntime().storage.delete(key);
}

export async function artifactExists(key: string): Promise<boolean> {
  return getRuntime().storage.exists(key);
}

export async function checkS3Connection(): Promise<boolean> {
  try {
    await getRuntime().storage.exists('__health_check__');
    return true;
  } catch { return false; }
}
