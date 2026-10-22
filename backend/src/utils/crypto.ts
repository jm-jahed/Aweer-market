import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { AuthSessionPayload, UserRole } from '@aweermarket/types';

const scryptAsync = promisify(crypto.scrypt);

export const MAX_PASSWORD_LENGTH = 128;
export const MAX_PASSWORD_BYTES = 512;

/**
 * OWASP-compliant secure password hashing using Node built-in scrypt.
 * Format: scrypt$<saltHex>$<derivedKeyHex>
 * Enforces strict maximum length (128 characters / 512 UTF-8 bytes) to prevent scrypt DoS.
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== 'string') {
    throw new TypeError('Password must be a string');
  }
  if (password.length === 0) {
    throw new Error('Password cannot be empty');
  }
  if (password.length > MAX_PASSWORD_LENGTH || Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new Error(`Password exceeds maximum allowed length of ${MAX_PASSWORD_LENGTH} characters`);
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Constant-time password verification using crypto.timingSafeEqual.
 * Safely rejects oversized or malformed inputs without excessive computation.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    if (
      typeof password !== 'string' ||
      typeof storedHash !== 'string' ||
      password.length === 0 ||
      password.length > MAX_PASSWORD_LENGTH ||
      Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES
    ) {
      return false;
    }

    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false;
    }
    const salt = parts[1];
    const originalHash = Buffer.from(parts[2], 'hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;

    if (originalHash.length !== derivedKey.length) {
      return false;
    }
    return crypto.timingSafeEqual(originalHash, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Generates an HMAC-SHA256 signed session token without external dependencies.
 * Format: <base64Payload>.<signatureHex>
 */
export function signSessionToken(payload: AuthSessionPayload, secret: string, expiresInMs = 24 * 60 * 60 * 1000): string {
  const now = Date.now();
  const tokenPayload: AuthSessionPayload = {
    ...payload,
    issuedAt: payload.issuedAt ?? now,
    expiresAt: payload.expiresAt ?? (now + expiresInMs)
  };

  const payloadString = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  return `${payloadString}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 signed session token using constant-time comparison.
 * Rejects expired, tampered, or invalid tokens.
 */
export function verifySessionToken(token: string, secret: string): AuthSessionPayload | null {
  try {
    if (typeof token !== 'string' || typeof secret !== 'string' || !token || !secret) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return null;
    }
    const [payloadBase64, providedSignature] = parts;

    const expectedSignature = crypto.createHmac('sha256', secret).update(payloadBase64).digest('hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const providedBuf = Buffer.from(providedSignature, 'hex');

    if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      return null;
    }

    const jsonString = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonString) as AuthSessionPayload;

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    // Enforce valid numerical expiration timestamp in the future
    if (!payload.expiresAt || typeof payload.expiresAt !== 'number' || Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
