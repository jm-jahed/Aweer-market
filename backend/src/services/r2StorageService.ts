/**
 * AweerMarket Cloudflare R2 Product Image Storage Service
 * Connects via S3-compatible API using @aws-sdk/client-s3.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl: string;
  endpoint?: string;
}

export interface UploadImageResult {
  key: string;
  url: string;
  bucket: string;
  size: number;
  mimeType: string;
}

export interface ImageValidationResult {
  isValid: boolean;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  extension?: 'jpg' | 'png' | 'webp';
  error?: string;
}

/**
 * Validates image buffer using magic bytes (file signatures)
 * Rejects SVGs, HTML, executables, scripts, and malformed files.
 */
export function validateImageBuffer(buffer: Buffer): ImageValidationResult {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: 'File buffer is empty.' };
  }

  const MAX_SIZE = 5 * 1024 * 1024; // 5 MiB
  if (buffer.length > MAX_SIZE) {
    return { isValid: false, error: 'File size exceeds maximum allowed limit of 5 MiB.' };
  }

  // 1. JPEG check: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { isValid: true, mimeType: 'image/jpeg', extension: 'jpg' };
  }

  // 2. PNG check: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { isValid: true, mimeType: 'image/png', extension: 'png' };
  }

  // 3. WebP check: starts with 'RIFF' and bytes 8..12 are 'WEBP'
  if (buffer.length >= 12) {
    const riff = buffer.subarray(0, 4).toString('ascii');
    const webp = buffer.subarray(8, 12).toString('ascii');
    if (riff === 'RIFF' && webp === 'WEBP') {
      return { isValid: true, mimeType: 'image/webp', extension: 'webp' };
    }
  }

  // Reject SVG, HTML, or any unsupported format
  const snippet = buffer.subarray(0, 100).toString('utf8').toLowerCase();
  if (snippet.includes('<svg') || snippet.includes('<?xml') || snippet.includes('<html') || snippet.includes('<script')) {
    return { isValid: false, error: 'SVG and script/HTML files are strictly disallowed for security reasons.' };
  }

  return { isValid: false, error: 'Unsupported file type. Only standard JPEG, PNG, and WebP images are permitted.' };
}

/**
 * Retrieves and validates Cloudflare R2 environment configuration.
 * Fails safely with clear errors if credentials are not configured.
 */
export function getR2Config(): R2Config {
  const accountId = (process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucketName = (process.env.R2_BUCKET_NAME || '').trim();
  const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_URL || '').trim();
  const customEndpoint = (process.env.R2_ENDPOINT || '').trim();

  const missing: string[] = [];
  if (!accountId && !customEndpoint) missing.push('R2_ACCOUNT_ID');
  if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
  if (!bucketName) missing.push('R2_BUCKET_NAME');
  if (!publicBaseUrl) missing.push('R2_PUBLIC_BASE_URL');

  if (missing.length > 0) {
    throw new Error(`Cloudflare R2 is not fully configured. Missing required environment variables: ${missing.join(', ')}`);
  }

  const endpoint = customEndpoint || `https://${accountId}.r2.cloudflarestorage.com`;

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ''),
    endpoint
  };
}

/**
 * Checks whether R2 configuration is present without throwing.
 */
export function isR2Configured(): boolean {
  try {
    getR2Config();
    return true;
  } catch {
    return false;
  }
}

let s3ClientInstance: S3Client | null = null;

export function getR2Client(customConfig?: Partial<R2Config>): S3Client {
  if (customConfig) {
    const config = { ...getR2Config(), ...customConfig };
    return new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  if (!s3ClientInstance) {
    const config = getR2Config();
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  return s3ClientInstance;
}

export function setR2ClientInstance(client: S3Client | null): void {
  s3ClientInstance = client;
}

/**
 * Uploads a validated product image buffer to Cloudflare R2 with strict shop-scoped key.
 */
export async function uploadProductImageToR2(
  fileBuffer: Buffer,
  shopId: string,
  client?: S3Client
): Promise<UploadImageResult> {
  const validation = validateImageBuffer(fileBuffer);
  if (!validation.isValid || !validation.mimeType || !validation.extension) {
    throw new Error(validation.error || 'Invalid image buffer');
  }

  const config = getR2Config();
  const s3 = client || getR2Client();

  // Clean shopId and generate random UUID key
  const cleanShopId = shopId.replace(/[^a-zA-Z0-9_-]/g, '') || 'general';
  const randomUniqueId = crypto.randomUUID();
  const objectKey = `products/${cleanShopId}/${randomUniqueId}.${validation.extension}`;

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: objectKey,
    Body: fileBuffer,
    ContentType: validation.mimeType,
    CacheControl: 'public, max-age=31536000, immutable'
  });

  await s3.send(command);

  const publicUrl = `${config.publicBaseUrl}/${objectKey}`;

  return {
    key: objectKey,
    url: publicUrl,
    bucket: config.bucketName,
    size: fileBuffer.length,
    mimeType: validation.mimeType
  };
}

/**
 * Strict validator for Cloudflare R2 product image deletion keys.
 * Enforces exact pattern: products/<shopId>/<uuidv4>.(jpg|png|webp)
 * Rejects path traversal (..), URL-encoded separators (%2e, %2f), backslashes,
 * arbitrary URLs, and keys outside the authorized shop namespace.
 */
export function isValidProductImageKey(key: string, authorizedShopId?: string): { isValid: boolean; error?: string } {
  if (!key || typeof key !== 'string') {
    return { isValid: false, error: 'Object key is required and must be a string.' };
  }

  const trimmedKey = key.trim();

  // Reject full URLs or protocol schemes
  if (trimmedKey.startsWith('http://') || trimmedKey.startsWith('https://') || trimmedKey.startsWith('//')) {
    return { isValid: false, error: 'Public URLs cannot be used as storage deletion keys; provide the object key.' };
  }

  // Reject URL-encoded characters (like %2e, %2f, %5c) to prevent traversal evasion
  if (/%[0-9a-fA-F]{2}/.test(trimmedKey)) {
    return { isValid: false, error: 'Encoded characters and path sequences are strictly rejected.' };
  }

  // Reject traversal sequences or backslashes
  if (trimmedKey.includes('..') || trimmedKey.includes('\\')) {
    return { isValid: false, error: 'Path traversal sequences (..) are strictly prohibited.' };
  }

  // If authorizedShopId is provided, enforce strict match to that shop's namespace
  if (authorizedShopId) {
    const cleanShopId = authorizedShopId.replace(/[^a-zA-Z0-9_-]/g, '') || 'general';
    const expectedPrefix = `products/${cleanShopId}/`;
    if (!trimmedKey.startsWith(expectedPrefix)) {
      return { isValid: false, error: 'Cannot delete image outside of your authorized shop namespace.' };
    }

    const shopSpecificRegex = new RegExp(`^products\\/${cleanShopId}\\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\.(jpg|png|webp)$`);
    if (!shopSpecificRegex.test(trimmedKey)) {
      return { isValid: false, error: 'Invalid object key format. Key must match products/<shopId>/<uuid>.(jpg|png|webp).' };
    }

    return { isValid: true };
  }

  // Generic valid pattern: products/<shopId>/<uuid>.(jpg|png|webp)
  const genericRegex = /^products\/[a-zA-Z0-9_-]+\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(jpg|png|webp)$/;
  if (!genericRegex.test(trimmedKey)) {
    return { isValid: false, error: 'Invalid object key format. Key must match products/<shopId>/<uuid>.(jpg|png|webp).' };
  }

  return { isValid: true };
}

/**
 * Deletes a product image from Cloudflare R2
 */
export async function deleteProductImageFromR2(objectKey: string, client?: S3Client): Promise<boolean> {
  const check = isValidProductImageKey(objectKey);
  if (!check.isValid) {
    throw new Error(check.error || 'Invalid deletion object key');
  }

  const config = getR2Config();
  const s3 = client || getR2Client();

  const command = new DeleteObjectCommand({
    Bucket: config.bucketName,
    Key: objectKey.trim()
  });

  await s3.send(command);
  return true;
}
