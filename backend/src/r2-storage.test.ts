import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { buildServer } from './server.js';
import { resetInMemoryUsers } from './models/user.model.js';
import { resetInMemoryShops, findShopById } from './models/shop.model.js';
import { resetInMemoryProducts, findProductById, createProduct } from './models/product.model.js';
import { resetInMemoryOrders } from './models/order.model.js';
import { UserRole, WholesaleUnit, ProductCategory } from '@aweermarket/types';
import { signSessionToken } from './utils/crypto.js';
import { getSecretForRole } from './plugins/security.js';
import {
  validateImageBuffer,
  getR2Config,
  isR2Configured,
  compressProductImage,
  uploadProductImageToR2,
  deleteProductImageFromR2,
  setR2ClientInstance,
  isValidProductImageKey,
  MAX_IMAGE_DIMENSION,
  WEBP_COMPRESSION_QUALITY,
  MAX_INPUT_PIXELS
} from './services/r2StorageService.js';
import sharp from 'sharp';
import {
  configureAuthRateLimit,
  resetAuthRateLimitConfig,
  resetAuthRateLimitStore
} from './plugins/rate-limit.js';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Synthetic Valid Magic Bytes
const VALID_JPEG = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
]);

const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89
]);

const VALID_WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x20, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
  Buffer.from('VP8 ')
]);

function createMultipartPayload(filename: string, contentType: string, fileBuffer: Buffer) {
  const boundary = '----AweerStorageBoundary987654321';
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([
    Buffer.from(header, 'utf8'),
    fileBuffer,
    Buffer.from(footer, 'utf8')
  ]);
  return {
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`
    },
    body
  };
}

describe('AweerMarket — Cloudflare R2 Product Image Storage Integration Tests', () => {
  let app: FastifyInstance;
  let sentCommands: any[] = [];
  let mockS3ShouldFail = false;

  // Real decodable image buffers for compression & upload testing
  let REAL_VALID_JPEG: Buffer;
  let REAL_VALID_PNG: Buffer;
  let REAL_VALID_WEBP: Buffer;
  let LARGE_JPEG: Buffer;
  let TRANSPARENT_PNG: Buffer;

  // Mock S3 Client
  const mockS3Client = {
    send: async (command: any) => {
      if (mockS3ShouldFail) {
        throw new Error('Cloudflare R2 Connection Timeout: S3 PutObject failed');
      }
      sentCommands.push(command);
      return { $metadata: { httpStatusCode: 200 } };
    }
  } as unknown as S3Client;

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'super-test-secret-at-least-32-chars-long-12345';
    process.env.JWT_SECRET_BUYER = 'buyer-secret-must-be-at-least-32-chars-long-abc';
    process.env.JWT_SECRET_SHOP_ADMIN = 'shop-admin-secret-at-least-32-chars-long-def';
    process.env.JWT_SECRET_SUPER_ADMIN = 'super-admin-secret-at-least-32-chars-long-xyz';

    // Configure Test R2 Environment Variables
    process.env.R2_ACCOUNT_ID = 'test_cloudflare_account_123';
    process.env.R2_ACCESS_KEY_ID = 'test_r2_access_key_abc';
    process.env.R2_SECRET_ACCESS_KEY = 'test_r2_secret_key_xyz_confidential';
    process.env.R2_BUCKET_NAME = 'aweermarket-products-test';
    process.env.R2_PUBLIC_BASE_URL = 'https://images-test.aweermarket.ae';
    delete process.env.R2_ENDPOINT;

    setR2ClientInstance(mockS3Client);

    // Create decodable fixture buffers with Sharp
    REAL_VALID_JPEG = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).jpeg().toBuffer();

    REAL_VALID_PNG = await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 0.5 } }
    }).png().toBuffer();

    REAL_VALID_WEBP = await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } }
    }).webp().toBuffer();

    LARGE_JPEG = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: { r: 120, g: 180, b: 90 } }
    }).jpeg().toBuffer();

    TRANSPARENT_PNG = await sharp({
      create: { width: 200, height: 200, channels: 4, background: { r: 255, g: 128, b: 0, alpha: 0.4 } }
    }).png().toBuffer();

    app = await buildServer();
    await app.ready();
  });

  after(async () => {
    setR2ClientInstance(null);
    await app.close();
  });

  beforeEach(() => {
    resetInMemoryUsers();
    resetInMemoryShops();
    resetInMemoryProducts();
    resetInMemoryOrders();
    resetAuthRateLimitStore();
    resetAuthRateLimitConfig();
    sentCommands = [];
    mockS3ShouldFail = false;
  });

  // Helper to register an authenticated vendor via standard API
  async function registerTestVendor(suffix: string = '') {
    const email = `vendor_${Date.now()}_${Math.random().toString(36).substring(7)}${suffix}@aweer.ae`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/vendor/register',
      payload: {
        email,
        password: 'VendorSecurePassword123!',
        fullName: 'Stall Vendor Rashid',
        stallName: `Rashid Produce Stall ${suffix}`,
        stallNumber: `ST-${suffix || '99'}`,
        tradeLicenseNumber: `TL-${suffix || '9999'}`,
        phone: '+971501234567'
      }
    });

    const cookie = res.headers['set-cookie'] as string;
    const body = res.json();
    return {
      cookie,
      user: body.user,
      shop: body.shop
    };
  }

  // ==========================================================================
  // 1. Magic Bytes Validation Tests
  // ==========================================================================
  describe('1. Image Buffer & Signature Validation (validateImageBuffer)', () => {
    it('accepts valid JPEG file with FF D8 FF signature', () => {
      const res = validateImageBuffer(VALID_JPEG);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.mimeType, 'image/jpeg');
      assert.strictEqual(res.extension, 'jpg');
    });

    it('accepts valid PNG file with 89 50 4E 47 signature', () => {
      const res = validateImageBuffer(VALID_PNG);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.mimeType, 'image/png');
      assert.strictEqual(res.extension, 'png');
    });

    it('accepts valid WebP file with RIFF....WEBP signature', () => {
      const res = validateImageBuffer(VALID_WEBP);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.mimeType, 'image/webp');
      assert.strictEqual(res.extension, 'webp');
    });

    it('rejects text file with forged .jpg extension', () => {
      const fakeJpg = Buffer.from('Hello, this is just plain text disguised as an image.');
      const res = validateImageBuffer(fakeJpg);
      assert.strictEqual(res.isValid, false);
      assert.match(res.error || '', /unsupported file type/i);
    });

    it('rejects SVG files and XML scripts for strict security', () => {
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script></svg>');
      const res = validateImageBuffer(svg);
      assert.strictEqual(res.isValid, false);
      assert.match(res.error || '', /svg/i);
    });

    it('rejects empty file buffer', () => {
      const empty = Buffer.alloc(0);
      const res = validateImageBuffer(empty);
      assert.strictEqual(res.isValid, false);
      assert.match(res.error || '', /empty/i);
    });

    it('rejects oversized buffer (> 5 MiB limit)', () => {
      const oversized = Buffer.alloc(5 * 1024 * 1024 + 10);
      oversized[0] = 0xFF;
      oversized[1] = 0xD8;
      oversized[2] = 0xFF;
      const res = validateImageBuffer(oversized);
      assert.strictEqual(res.isValid, false);
      assert.match(res.error || '', /5 MiB/i);
    });

    it('rejects executable / ELF / PE binary files', () => {
      const executable = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x00]);
      const res = validateImageBuffer(executable);
      assert.strictEqual(res.isValid, false);
    });
  });

  // ==========================================================================
  // 2. R2 Configuration & Key Structure Tests
  // ==========================================================================
  describe('2. R2 Configuration & Key Structure', () => {
    it('parses valid R2 configuration and normalizes public URL', () => {
      const config = getR2Config();
      assert.strictEqual(config.accountId, 'test_cloudflare_account_123');
      assert.strictEqual(config.bucketName, 'aweermarket-products-test');
      assert.strictEqual(config.publicBaseUrl, 'https://images-test.aweermarket.ae');
      assert.strictEqual(config.endpoint, 'https://test_cloudflare_account_123.r2.cloudflarestorage.com');
    });

    it('fails safely when required credentials are missing', () => {
      const oldKey = process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_SECRET_ACCESS_KEY;
      try {
        assert.throws(() => getR2Config(), /missing required environment variables.*R2_SECRET_ACCESS_KEY/i);
      } finally {
        process.env.R2_SECRET_ACCESS_KEY = oldKey;
      }
    });

    it('generates predictable object key structure: products/<shopId>/<uuid>.webp', async () => {
      const result = await uploadProductImageToR2(REAL_VALID_JPEG, 'stall_99', mockS3Client);
      assert.ok(result.key.startsWith('products/stall_99/'));
      assert.ok(result.key.endsWith('.webp'));
      assert.strictEqual(result.url, `https://images-test.aweermarket.ae/${result.key}`);
      assert.strictEqual(result.mimeType, 'image/webp');
      assert.strictEqual(result.format, 'webp');
      assert.strictEqual(result.width, 100);
      assert.strictEqual(result.height, 100);
      assert.ok(result.size > 0);
      assert.ok((result.originalSize ?? 0) > 0);

      // Verify command sent to S3
      assert.strictEqual(sentCommands.length, 1);
      const cmd = sentCommands[0];
      assert.strictEqual(cmd.input.Bucket, 'aweermarket-products-test');
      assert.strictEqual(cmd.input.Key, result.key);
      assert.strictEqual(cmd.input.ContentType, 'image/webp');
      assert.strictEqual(cmd.input.CacheControl, 'public, max-age=31536000, immutable');
    });
  });

  // ==========================================================================
  // 2b. Product Image Compression & Optimization (compressProductImage)
  // ==========================================================================
  describe('2b. Product Image Compression & Optimization (compressProductImage)', () => {
    it('converts valid JPEG to WebP and applies quality 82', async () => {
      const res = await compressProductImage(REAL_VALID_JPEG);
      assert.strictEqual(res.format, 'webp');
      assert.strictEqual(res.mimeType, 'image/webp');
      assert.strictEqual(res.extension, 'webp');
      assert.strictEqual(res.width, 100);
      assert.strictEqual(res.height, 100);
      assert.ok(res.compressedSize > 0);
      assert.strictEqual(res.originalSize, REAL_VALID_JPEG.length);
      // Validate WebP container magic bytes: starts with RIFF and has WEBP signature
      const riff = res.buffer.subarray(0, 4).toString('ascii');
      const webp = res.buffer.subarray(8, 12).toString('ascii');
      assert.strictEqual(riff, 'RIFF');
      assert.strictEqual(webp, 'WEBP');
    });

    it('resizes oversized image while strictly preserving aspect ratio', async () => {
      const res = await compressProductImage(LARGE_JPEG);
      // 3000 x 2000 (3:2) clamped inside 1600x1600 bounding box -> 1600 x 1067
      assert.strictEqual(res.width, 1600);
      assert.strictEqual(res.height, 1067);
      assert.strictEqual(res.format, 'webp');
      assert.ok(res.compressedSize < res.originalSize, 'Compressed size should be smaller than original');
    });

    it('never upscales or enlarges smaller images', async () => {
      const smallJpg = await sharp({
        create: { width: 640, height: 480, channels: 3, background: { r: 50, g: 100, b: 150 } }
      }).jpeg().toBuffer();
      const res = await compressProductImage(smallJpg);
      assert.strictEqual(res.width, 640);
      assert.strictEqual(res.height, 480);
    });

    it('preserves alpha channel / transparency for PNG with transparency', async () => {
      const res = await compressProductImage(TRANSPARENT_PNG);
      assert.strictEqual(res.format, 'webp');
      assert.strictEqual(res.hasAlpha, true);
      const meta = await sharp(res.buffer).metadata();
      assert.strictEqual(meta.hasAlpha, true);
      assert.strictEqual(meta.channels, 4);
    });

    it('enforces Sharp pixel limit and rejects images exceeding 25 megapixels', async () => {
      // 6000 x 5000 = 30 million pixels (> 25 megapixels safety limit)
      const hugeImage = await sharp({
        create: { width: 6000, height: 5000, channels: 3, background: { r: 10, g: 20, b: 30 } }
      }).jpeg().toBuffer();

      await assert.rejects(
        async () => compressProductImage(hugeImage),
        /exceed.*25 megapixels/i
      );
    });

    it('fails safely and throws error on corrupt image buffer without uploading to R2', async () => {
      const corruptWithValidHeader = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x00, 0x00, 0x00
      ]);
      await assert.rejects(
        async () => compressProductImage(corruptWithValidHeader),
        /image compression failed/i
      );
    });

    it('never calls S3 when compression fails (fail-closed protection)', async () => {
      sentCommands = [];
      const corruptWithValidHeader = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x00, 0x00, 0x00
      ]);
      await assert.rejects(
        async () => uploadProductImageToR2(corruptWithValidHeader, 'stall_99', mockS3Client),
        /image compression failed/i
      );
      assert.strictEqual(sentCommands.length, 0, 'S3 PutObject must NEVER be called if compression fails');
    });

    it('achieves substantial file size reduction on realistic photograph sample', async () => {
      const realisticJpg = await sharp({
        create: { width: 2400, height: 1600, channels: 3, background: { r: 200, g: 80, b: 40 } }
      }).jpeg({ quality: 98 }).toBuffer();

      const res = await compressProductImage(realisticJpg);
      const originalBytes = realisticJpg.length;
      const compressedBytes = res.compressedSize;
      assert.ok(compressedBytes < originalBytes, `Expected compression: ${compressedBytes} < ${originalBytes}`);
    });
  });

  // ==========================================================================
  // 3. Authenticated Upload Endpoint (POST /api/v1/vendor/upload)
  // ==========================================================================
  describe('3. Authenticated Upload Endpoint (POST /api/v1/vendor/upload)', () => {
    it('successfully uploads valid JPEG, compresses to WebP, and returns public HTTPS URL and key', async () => {
      const { cookie, shop } = await registerTestVendor('jpeg');
      const payload = createMultipartPayload('produce.jpg', 'image/jpeg', REAL_VALID_JPEG);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: {
          cookie,
          ...payload.headers
        },
        payload: payload.body
      });

      assert.strictEqual(res.statusCode, 201);
      const data = res.json();
      assert.strictEqual(data.statusCode, 201);
      assert.ok(data.url.startsWith('https://images-test.aweermarket.ae/products/'));
      assert.ok(data.key.startsWith(`products/${shop.id}/`));
      assert.ok(data.key.endsWith('.webp'));
      assert.strictEqual(data.mimeType, 'image/webp');
      assert.strictEqual(data.format, 'webp');
      assert.strictEqual(data.width, 100);
      assert.strictEqual(data.height, 100);
      assert.ok(data.size > 0);
      assert.strictEqual(data.originalSize, REAL_VALID_JPEG.length);

      // Crucial: Ensure NO secrets or raw bucket credentials leaked in response
      assert.strictEqual(data.secretAccessKey, undefined);
      assert.strictEqual(data.accessKeyId, undefined);
      assert.strictEqual(data.endpoint, undefined);
    });

    it('successfully uploads PNG image and compresses to WebP with transparency', async () => {
      const { cookie, shop } = await registerTestVendor('png');
      const payload = createMultipartPayload('produce.png', 'image/png', REAL_VALID_PNG);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: {
          cookie,
          ...payload.headers
        },
        payload: payload.body
      });

      assert.strictEqual(res.statusCode, 201);
      const data = res.json();
      assert.ok(data.key.endsWith('.webp'));
      assert.strictEqual(data.mimeType, 'image/webp');
      assert.strictEqual(data.format, 'webp');
      assert.ok(data.width > 0);
      assert.ok(data.height > 0);
    });

    it('successfully uploads WebP image and optimizes it', async () => {
      const { cookie, shop } = await registerTestVendor('webp');
      const payload = createMultipartPayload('produce.webp', 'image/webp', REAL_VALID_WEBP);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: {
          cookie,
          ...payload.headers
        },
        payload: payload.body
      });

      assert.strictEqual(res.statusCode, 201);
      const data = res.json();
      assert.ok(data.key.endsWith('.webp'));
      assert.strictEqual(data.mimeType, 'image/webp');
      assert.strictEqual(data.format, 'webp');
    });

    it('rejects unauthenticated request (401 Unauthorized)', async () => {
      const payload = createMultipartPayload('produce.jpg', 'image/jpeg', VALID_JPEG);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: payload.headers,
        payload: payload.body
      });

      assert.strictEqual(res.statusCode, 401);
    });

    it('rejects unauthorized role (e.g. BUYER role attempting vendor upload)', async () => {
      const buyerToken = signSessionToken(
        { userId: 'buyer_123', email: 'buyer@test.ae', role: UserRole.BUYER },
        getSecretForRole(UserRole.BUYER)
      );

      const payload = createMultipartPayload('produce.jpg', 'image/jpeg', VALID_JPEG);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: {
          cookie: `aweer_session=${buyerToken}`,
          ...payload.headers
        },
        payload: payload.body
      });

      assert.strictEqual(res.statusCode, 403);
    });

    it('rejects vendor upload when stall/shop is inactive in database', async () => {
      const { cookie, shop } = await registerTestVendor('inactive');
      // Set stall inactive in DB
      const dbShop = await findShopById(shop.id);
      if (dbShop) {
        dbShop.isActive = false;
      }

      const payload = createMultipartPayload('produce.jpg', 'image/jpeg', VALID_JPEG);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: {
          cookie,
          ...payload.headers
        },
        payload: payload.body
      });

      assert.strictEqual(res.statusCode, 403);
      assert.match(res.json().message, /no active shop/i);
    });

    it('rejects forged file (text content disguised as image/jpeg)', async () => {
      const { cookie } = await registerTestVendor('fake');
      const fakeJpg = Buffer.from('Plain text forged as jpeg');
      const payload = createMultipartPayload('fake.jpg', 'image/jpeg', fakeJpg);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: {
          cookie,
          ...payload.headers
        },
        payload: payload.body
      });

      assert.strictEqual(res.statusCode, 400);
      assert.match(res.json().message, /unsupported file type/i);
    });

    it('rejects SVG file uploads', async () => {
      const { cookie } = await registerTestVendor('svg');
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>');
      const payload = createMultipartPayload('vector.svg', 'image/svg+xml', svg);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: {
          cookie,
          ...payload.headers
        },
        payload: payload.body
      });

      assert.strictEqual(res.statusCode, 400);
    });

    it('handles R2 storage error gracefully without false success or secret leakage', async () => {
      mockS3ShouldFail = true;
      const { cookie } = await registerTestVendor('fail');
      const payload = createMultipartPayload('produce.jpg', 'image/jpeg', REAL_VALID_JPEG);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: {
          cookie,
          ...payload.headers
        },
        payload: payload.body
      });

      assert.strictEqual(res.statusCode, 500);
      const data = res.json();
      assert.strictEqual(data.statusCode, 500);
      assert.match(data.message, /failed to upload image to storage/i);
      assert.strictEqual(data.secretAccessKey, undefined);
    });

    it('rejects image exceeding Sharp 25 megapixels pixel limit with 400 Bad Request', async () => {
      const { cookie } = await registerTestVendor('hugepix');
      sentCommands = [];

      // 6000 x 5000 = 30 million pixels
      const hugeImage = await sharp({
        create: { width: 6000, height: 5000, channels: 3, background: { r: 10, g: 20, b: 30 } }
      }).jpeg().toBuffer();

      const payload = createMultipartPayload('huge.jpg', 'image/jpeg', hugeImage);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: {
          cookie,
          ...payload.headers
        },
        payload: payload.body
      });

      assert.strictEqual(res.statusCode, 400);
      const data = res.json();
      assert.match(data.message, /25 megapixels/i);
      assert.strictEqual(sentCommands.length, 0, 'S3 must NEVER be called when pixel limit is exceeded');
    });

    it('rejects corrupt image stream during compression with 400 Bad Request without calling S3', async () => {
      const { cookie } = await registerTestVendor('corruptstream');
      sentCommands = [];

      // Valid JPEG header bytes but truncated / corrupt body
      const corruptWithValidHeader = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x00, 0x00, 0x00
      ]);

      const payload = createMultipartPayload('corrupt.jpg', 'image/jpeg', corruptWithValidHeader);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: {
          cookie,
          ...payload.headers
        },
        payload: payload.body
      });

      assert.strictEqual(res.statusCode, 400);
      const data = res.json();
      assert.match(data.message, /compression failed/i);
      assert.strictEqual(sentCommands.length, 0, 'S3 must NEVER be called on compression failure');
    });

    it('enforces upload rate limit (HTTP 429) when upload quota is exceeded', async () => {
      configureAuthRateLimit({ uploadMaxAttempts: 2, uploadWindowMs: 60 * 1000 });
      const { cookie } = await registerTestVendor('ratelimit');
      const payload = createMultipartPayload('produce.jpg', 'image/jpeg', REAL_VALID_JPEG);

      // 1st upload: allowed (201)
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: { cookie, ...payload.headers },
        payload: payload.body
      });
      assert.strictEqual(res1.statusCode, 201);
      assert.strictEqual(res1.headers['x-ratelimit-remaining'], '1');

      // 2nd upload: allowed (201)
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: { cookie, ...payload.headers },
        payload: payload.body
      });
      assert.strictEqual(res2.statusCode, 201);
      assert.strictEqual(res2.headers['x-ratelimit-remaining'], '0');

      // 3rd upload: BLOCKED with 429 Too Many Requests
      const res3 = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: { cookie, ...payload.headers },
        payload: payload.body
      });
      assert.strictEqual(res3.statusCode, 429);
      assert.strictEqual(res3.headers['x-ratelimit-remaining'], '0');
      assert.ok(res3.headers['retry-after']);
      assert.match(res3.json().message, /rate limit exceeded/i);

      // Verify that unrelated vendor routes (e.g. GET /vendor/shop) are NOT blocked!
      const shopRes = await app.inject({
        method: 'GET',
        url: '/api/v1/vendor/shop',
        headers: { cookie }
      });
      assert.strictEqual(shopRes.statusCode, 200);
    });

    it('isolates upload rate limits between different vendors sharing the same IP', async () => {
      configureAuthRateLimit({ uploadMaxAttempts: 2, uploadMaxIpAttempts: 10, uploadWindowMs: 60 * 1000 });
      const { cookie: cookieA } = await registerTestVendor('isoA');
      const { cookie: cookieB } = await registerTestVendor('isoB');
      const payload = createMultipartPayload('produce.jpg', 'image/jpeg', REAL_VALID_JPEG);
      const sharedHeaders = {
        ...payload.headers,
        'x-forwarded-for': '203.0.113.150'
      };

      // Vendor A uploads 2 images (reaches quota)
      for (let i = 0; i < 2; i++) {
        const resA = await app.inject({
          method: 'POST',
          url: '/api/v1/vendor/upload',
          headers: { cookie: cookieA, ...sharedHeaders },
          payload: payload.body
        });
        assert.strictEqual(resA.statusCode, 201);
      }

      // Vendor A 3rd upload is BLOCKED (429)
      const resA3 = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: { cookie: cookieA, ...sharedHeaders },
        payload: payload.body
      });
      assert.strictEqual(resA3.statusCode, 429);
      assert.match(resA3.json().message, /upload quota of 2 images per minute reached/i);

      // Vendor A spams additional rejected attempts
      for (let i = 0; i < 3; i++) {
        const resASpam = await app.inject({
          method: 'POST',
          url: '/api/v1/vendor/upload',
          headers: { cookie: cookieA, ...sharedHeaders },
          payload: payload.body
        });
        assert.strictEqual(resASpam.statusCode, 429);
      }

      // Vendor B on the SAME IP uploads: SUCCESS (Vendor A's exhaustion does NOT block Vendor B)
      const resB1 = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: { cookie: cookieB, ...sharedHeaders },
        payload: payload.body
      });
      assert.strictEqual(resB1.statusCode, 201);
      assert.strictEqual(resB1.headers['x-ratelimit-remaining'], '1');

      // Vendor B uploads their 2nd image: SUCCESS
      const resB2 = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: { cookie: cookieB, ...sharedHeaders },
        payload: payload.body
      });
      assert.strictEqual(resB2.statusCode, 201);
      assert.strictEqual(resB2.headers['x-ratelimit-remaining'], '0');
    });

    it('enforces shared-IP aggregate protection when total uploads across accounts exceed IP ceiling', async () => {
      // Configure low IP ceiling of 3 across accounts, with per-vendor quota of 2
      configureAuthRateLimit({ uploadMaxAttempts: 2, uploadMaxIpAttempts: 3, uploadWindowMs: 60 * 1000 });
      const { cookie: cookieA } = await registerTestVendor('sybilA');
      const { cookie: cookieB } = await registerTestVendor('sybilB');
      const payload = createMultipartPayload('produce.jpg', 'image/jpeg', REAL_VALID_JPEG);
      const sharedHeaders = {
        ...payload.headers,
        'x-forwarded-for': '203.0.113.200'
      };

      // Vendor A uploads 2 images (allowed under user limit 2 and IP limit 3)
      for (let i = 0; i < 2; i++) {
        const resA = await app.inject({
          method: 'POST',
          url: '/api/v1/vendor/upload',
          headers: { cookie: cookieA, ...sharedHeaders },
          payload: payload.body
        });
        assert.strictEqual(resA.statusCode, 201);
      }

      // Vendor B uploads 1 image (total on IP = 3, allowed)
      const resB1 = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: { cookie: cookieB, ...sharedHeaders },
        payload: payload.body
      });
      assert.strictEqual(resB1.statusCode, 201);

      // Vendor B attempts 2nd image: Vendor B user quota has remaining capacity (1/2),
      // but total IP count has reached ceiling (3/3): BLOCKED at IP layer!
      const resB2 = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/upload',
        headers: { cookie: cookieB, ...sharedHeaders },
        payload: payload.body
      });
      assert.strictEqual(resB2.statusCode, 429);
      assert.match(resB2.json().message, /too many aggregate upload requests from this IP/i);
    });
  });

  // ==========================================================================
  // 4. Scoped Orphan Deletion & Strict Key Validation (DELETE /api/v1/vendor/upload)
  // ==========================================================================
  describe('4. Scoped Orphan Deletion & Strict Key Validation (DELETE /api/v1/vendor/upload)', () => {
    it('deletes an uploaded object with valid UUIDv4 in the vendor shop namespace', async () => {
      const { cookie, shop } = await registerTestVendor('del');
      const validUuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const key = `products/${shop.id}/${validUuid}.jpg`;

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/vendor/upload',
        headers: { cookie },
        payload: { key }
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().key, key);
      assert.strictEqual(sentCommands.length, 1);
      assert.strictEqual(sentCommands[0].input.Key, key);
    });

    it('REJECTS path traversal sequence (..) with 400 Bad Request and does not call S3', async () => {
      const { cookie, shop } = await registerTestVendor('trav');
      sentCommands = [];

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/vendor/upload',
        headers: { cookie },
        payload: { key: `products/${shop.id}/../victim-shop/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg` }
      });

      assert.strictEqual(res.statusCode, 400);
      assert.match(res.json().message, /path traversal/i);
      assert.strictEqual(sentCommands.length, 0); // S3 was NEVER contacted!
    });

    it('REJECTS URL-encoded traversal (%2e%2e) with 400 Bad Request', async () => {
      const { cookie, shop } = await registerTestVendor('enc');
      sentCommands = [];

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/vendor/upload',
        headers: { cookie },
        payload: { key: `products/${shop.id}/%2e%2e/victim/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg` }
      });

      assert.strictEqual(res.statusCode, 400);
      assert.match(res.json().message, /encoded characters/i);
      assert.strictEqual(sentCommands.length, 0);
    });

    it('REJECTS public URL passed as deletion key with 400 Bad Request', async () => {
      const { cookie, shop } = await registerTestVendor('url');
      sentCommands = [];

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/vendor/upload',
        headers: { cookie },
        payload: { key: `https://images.aweermarket.ae/products/${shop.id}/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg` }
      });

      assert.strictEqual(res.statusCode, 400);
      assert.match(res.json().message, /public urls cannot be used as storage deletion keys/i);
      assert.strictEqual(sentCommands.length, 0);
    });

    it('REJECTS malformed UUID and invalid extensions without calling S3', async () => {
      const { cookie, shop } = await registerTestVendor('malformed');
      sentCommands = [];

      // Non-UUID filename
      const res1 = await app.inject({
        method: 'DELETE',
        url: '/api/v1/vendor/upload',
        headers: { cookie },
        payload: { key: `products/${shop.id}/arbitrary-name.jpg` }
      });
      assert.strictEqual(res1.statusCode, 400);

      // Invalid extension (.exe)
      const res2 = await app.inject({
        method: 'DELETE',
        url: '/api/v1/vendor/upload',
        headers: { cookie },
        payload: { key: `products/${shop.id}/f47ac10b-58cc-4372-a567-0e02b2c3d479.exe` }
      });
      assert.strictEqual(res2.statusCode, 400);

      // Backslash path
      const res3 = await app.inject({
        method: 'DELETE',
        url: '/api/v1/vendor/upload',
        headers: { cookie },
        payload: { key: `products\\${shop.id}\\f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg` }
      });
      assert.strictEqual(res3.statusCode, 400);

      assert.strictEqual(sentCommands.length, 0);
    });

    it('REJECTS cross-shop deletion attempt (attempting to delete another stall image)', async () => {
      const { cookie } = await registerTestVendor('cross');
      sentCommands = [];
      const otherShopKey = 'products/other_shop_stall_99/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg';

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/vendor/upload',
        headers: { cookie },
        payload: { key: otherShopKey }
      });

      assert.strictEqual(res.statusCode, 403);
      assert.match(res.json().message, /cannot delete image outside of your authorized shop namespace/i);
      assert.strictEqual(sentCommands.length, 0);
    });
  });

  // ==========================================================================
  // 5. Product Creation & Persistence with Permanent R2 Image URL
  // ==========================================================================
  describe('5. Product Persistence with Public Image URL', () => {
    it('persists permanent R2 image URL in product record upon creation', async () => {
      const { cookie, shop } = await registerTestVendor('persist');
      const r2ImageUrl = `https://images-test.aweermarket.ae/products/${shop.id}/mango-uuid-999.jpg`;

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/products',
        headers: { cookie },
        payload: {
          name: 'Alphonso Mangoes Premium Batch',
          category: ProductCategory.FRESH_FRUITS,
          originCountry: 'India',
          imageUrl: r2ImageUrl,
          offer: {
            unit: WholesaleUnit.BOX,
            unitWeightKg: 5,
            priceAed: 75.0,
            minOrderQuantity: 2,
            availableStock: 120
          }
        }
      });

      assert.strictEqual(createRes.statusCode, 201);
      const product = createRes.json().product;
      assert.strictEqual(product.imageUrl, r2ImageUrl);
      assert.strictEqual(product.name, 'Alphonso Mangoes Premium Batch');

      // Verify persistence via GET /api/v1/vendor/products
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/vendor/products',
        headers: { cookie }
      });

      assert.strictEqual(listRes.statusCode, 200);
      const vendorProducts = listRes.json().products;
      const found = vendorProducts.find((p: any) => p.name === 'Alphonso Mangoes Premium Batch');
      assert.ok(found);
      assert.strictEqual(found.imageUrl, r2ImageUrl);
    });

    it('updating offer terms preserves the saved product image URL', async () => {
      const { cookie, shop } = await registerTestVendor('offer');
      const r2ImageUrl = `https://images-test.aweermarket.ae/products/${shop.id}/grapes-uuid-888.jpg`;

      const prod = await createProduct({
        name: 'Thompson Seedless Grapes',
        category: ProductCategory.FRESH_FRUITS,
        originCountry: 'Egypt',
        imageUrl: r2ImageUrl,
        offers: [
          {
            shopId: shop.id,
            shopName: shop.name,
            stallNumber: shop.stallNumber,
            unit: WholesaleUnit.CRATE,
            unitWeightKg: 10,
            priceAed: 50.0,
            minOrderQuantity: 1,
            availableStock: 50
          }
        ]
      });

      // Update offer price and stock
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/vendor/products/${prod.id}/offer`,
        headers: { cookie },
        payload: {
          priceAed: 45.0,
          availableStock: 60
        }
      });

      assert.strictEqual(patchRes.statusCode, 200);
      const updated = patchRes.json().product;
      assert.strictEqual(updated.imageUrl, r2ImageUrl);
      assert.strictEqual(updated.offers[0].priceAed, 45.0);
    });
  });
});
