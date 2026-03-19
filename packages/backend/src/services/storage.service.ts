import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getEnv } from '../env.js';

let _s3: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3) {
    const env = getEnv();
    _s3 = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: 'us-east-1',
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });
  }
  return _s3;
}

export async function uploadArtifact(key: string, body: Buffer, contentType = 'application/gzip'): Promise<void> {
  const env = getEnv();
  await getS3Client().send(new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

export async function downloadArtifact(key: string): Promise<ReadableStream | null> {
  const env = getEnv();
  try {
    const result = await getS3Client().send(new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }));
    return result.Body as ReadableStream;
  } catch (err: any) {
    if (err.name === 'NoSuchKey') return null;
    throw err;
  }
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const env = getEnv();
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });
  return awsGetSignedUrl(getS3Client(), command, { expiresIn });
}

export async function deleteArtifact(key: string): Promise<void> {
  const env = getEnv();
  await getS3Client().send(new DeleteObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  }));
}

export async function artifactExists(key: string): Promise<boolean> {
  const env = getEnv();
  try {
    await getS3Client().send(new HeadObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

export async function checkS3Connection(): Promise<boolean> {
  try {
    await artifactExists('__health_check__');
    return true;
  } catch {
    return false;
  }
}
