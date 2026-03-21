import type { Runtime, PasswordHasher, StorageAdapter } from './types.js';

class NodePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const argon2 = await import('argon2');
    return argon2.hash(password);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    const argon2 = await import('argon2');
    return argon2.verify(hash, password);
  }
}

class NodeStorageAdapter implements StorageAdapter {
  private client: any;
  private bucket: string;
  private initPromise: Promise<void>;

  constructor(endpoint: string, accessKey: string, secretKey: string, bucket: string) {
    this.bucket = bucket;
    this.initPromise = this._init(endpoint, accessKey, secretKey);
  }

  private async _init(endpoint: string, accessKey: string, secretKey: string) {
    const { S3Client } = await import('@aws-sdk/client-s3');
    this.client = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });
  }

  private async getClient() {
    await this.initPromise;
    return this.client;
  }

  async upload(key: string, body: Buffer | ArrayBuffer, contentType = 'application/gzip'): Promise<void> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getClient();
    await client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: key, Body: Buffer.from(body as ArrayBuffer), ContentType: contentType,
    }));
  }

  async download(key: string): Promise<ArrayBuffer | null> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getClient();
    try {
      const result = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const stream = result.Body;
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream) chunks.push(chunk);
      return Buffer.concat(chunks).buffer;
    } catch (err: any) {
      if (err.name === 'NoSuchKey') return null;
      throw err;
    }
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = await this.getClient();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getClient();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getClient();
    try {
      await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch { return false; }
  }
}

export function createNodeRuntime(env: {
  S3_ENDPOINT: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_BUCKET: string;
}): Runtime {
  return {
    password: new NodePasswordHasher(),
    storage: new NodeStorageAdapter(env.S3_ENDPOINT, env.S3_ACCESS_KEY, env.S3_SECRET_KEY, env.S3_BUCKET),
  };
}
