import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * AweerMarket Authentication Rate Limiter
 * 
 * Protects against:
 * - Credential stuffing and brute-force password guessing
 * - Scrypt CPU starvation Denial-of-Service attacks
 * - Automated registration abuse
 * 
 * Dual-Key Strategy:
 * 1. IP-Based: Tracks request volume from client socket IP address.
 * 2. Account-Based: Tracks repeated login attempts against the same normalized email.
 * 
 * Storage Characteristics:
 * - In-memory sliding-window bucket store.
 * - Instance-local: resets on process restart and is not shared across multi-process clusters.
 */

export interface RateLimitConfig {
  windowMs: number;
  maxIpAttempts: number;
  maxAccountAttempts: number;
  registerMaxIpAttempts: number;
  registerMaxAccountAttempts: number;
}

interface RateLimitRecord {
  timestamps: number[];
}

let customConfig: Partial<RateLimitConfig> = {};
const rateLimitStore = new Map<string, RateLimitRecord>();

function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.argv.includes('--test') ||
    process.execArgv.includes('--test') ||
    process.env.npm_lifecycle_event === 'test'
  );
}

export function getActiveRateLimitConfig(): RateLimitConfig {
  const isTest = isTestEnvironment();
  return {
    windowMs:
      customConfig.windowMs ??
      (Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000),
    maxIpAttempts:
      customConfig.maxIpAttempts ??
      (Number(process.env.AUTH_RATE_LIMIT_MAX_IP) || (isTest ? 1000 : 20)),
    maxAccountAttempts:
      customConfig.maxAccountAttempts ??
      (Number(process.env.AUTH_RATE_LIMIT_MAX_ACCOUNT) || (isTest ? 500 : 5)),
    registerMaxIpAttempts:
      customConfig.registerMaxIpAttempts ??
      (Number(process.env.AUTH_RATE_LIMIT_REGISTER_MAX_IP) || (isTest ? 1000 : 10)),
    registerMaxAccountAttempts:
      customConfig.registerMaxAccountAttempts ??
      (Number(process.env.AUTH_RATE_LIMIT_REGISTER_MAX_ACCOUNT) || (isTest ? 500 : 3))
  };
}

/**
 * Allows isolated test suites to configure tight limits deterministically.
 */
export function configureAuthRateLimit(overrides: Partial<RateLimitConfig>): void {
  customConfig = { ...customConfig, ...overrides };
}

/**
 * Resets rate limit configuration back to environment / default settings.
 */
export function resetAuthRateLimitConfig(): void {
  customConfig = {};
}

/**
 * Clears the in-memory bucket store between tests.
 */
export function resetAuthRateLimitStore(): void {
  rateLimitStore.clear();
}

/**
 * Returns current snapshot size of the in-memory bucket store (for monitoring/tests).
 */
export function getAuthRateLimitStoreSize(): number {
  return rateLimitStore.size;
}

interface CheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds: number;
  key: string;
}

function checkBucket(key: string, maxAttempts: number, windowMs: number): CheckResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter out expired timestamps outside the sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > cutoff);

  const resetSeconds = Math.ceil(
    (record.timestamps.length > 0 ? record.timestamps[0] + windowMs : now + windowMs) / 1000
  );
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((record.timestamps.length > 0 ? record.timestamps[0] + windowMs - now : windowMs) / 1000)
  );

  if (record.timestamps.length >= maxAttempts) {
    return {
      allowed: false,
      limit: maxAttempts,
      remaining: 0,
      resetSeconds,
      retryAfterSeconds,
      key
    };
  }

  // Record this attempt in the sliding window
  record.timestamps.push(now);
  const remaining = Math.max(0, maxAttempts - record.timestamps.length);

  return {
    allowed: true,
    limit: maxAttempts,
    remaining,
    resetSeconds,
    retryAfterSeconds: 0,
    key
  };
}

/**
 * Extracts client IP securely.
 * Note: Does NOT trust X-Forwarded-For unless Fastify trustProxy is explicitly enabled.
 */
function getClientIp(request: FastifyRequest): string {
  return request.ip || request.raw.socket.remoteAddress || '127.0.0.1';
}

/**
 * Extracts and normalizes target email from request body to prevent casing/formatting bypass.
 */
function getTargetEmail(request: FastifyRequest): string | null {
  const body = request.body as Record<string, unknown> | null | undefined;
  if (body && typeof body.email === 'string') {
    const normalized = body.email.toLowerCase().trim();
    return normalized.length > 0 ? normalized : null;
  }
  return null;
}

function sendRateLimitExceeded(
  reply: FastifyReply,
  result: CheckResult,
  customMessage?: string
): FastifyReply {
  reply.header('Retry-After', String(result.retryAfterSeconds));
  reply.header('X-RateLimit-Limit', String(result.limit));
  reply.header('X-RateLimit-Remaining', '0');
  reply.header('X-RateLimit-Reset', String(result.resetSeconds));

  return reply.status(429).send({
    statusCode: 429,
    error: 'Too Many Requests',
    message: customMessage || 'Rate limit exceeded: too many authentication attempts. Please try again later.'
  });
}

function setRateLimitHeaders(reply: FastifyReply, result: CheckResult): void {
  reply.header('X-RateLimit-Limit', String(result.limit));
  reply.header('X-RateLimit-Remaining', String(result.remaining));
  reply.header('X-RateLimit-Reset', String(result.resetSeconds));
}

/**
 * PreHandler hook for Login Endpoints (Buyer, Vendor, SuperAdmin).
 * Enforces dual IP and normalized Account limits.
 */
export async function rateLimitLogin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const config = getActiveRateLimitConfig();
  const ip = getClientIp(request);
  const email = getTargetEmail(request);

  // 1. Check IP bucket
  const ipResult = checkBucket(
    `login:ip:${ip}`,
    config.maxIpAttempts,
    config.windowMs
  );
  if (!ipResult.allowed) {
    sendRateLimitExceeded(reply, ipResult);
    return;
  }

  // 2. Check Account bucket (if email provided)
  if (email) {
    const accountResult = checkBucket(
      `login:account:${email}`,
      config.maxAccountAttempts,
      config.windowMs
    );
    if (!accountResult.allowed) {
      sendRateLimitExceeded(reply, accountResult);
      return;
    }
    setRateLimitHeaders(reply, accountResult);
    return;
  }

  setRateLimitHeaders(reply, ipResult);
}

/**
 * PreHandler hook for Registration Endpoints (Buyer, Vendor).
 * Enforces registration attempt limits per IP and per normalized email.
 */
export async function rateLimitRegister(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const config = getActiveRateLimitConfig();
  const ip = getClientIp(request);
  const email = getTargetEmail(request);

  // 1. Check IP bucket
  const ipResult = checkBucket(
    `register:ip:${ip}`,
    config.registerMaxIpAttempts,
    config.windowMs
  );
  if (!ipResult.allowed) {
    sendRateLimitExceeded(
      reply,
      ipResult,
      'Rate limit exceeded: too many registration attempts from this IP address. Please try again later.'
    );
    return;
  }

  // 2. Check Account bucket (if email provided)
  if (email) {
    const accountResult = checkBucket(
      `register:account:${email}`,
      config.registerMaxAccountAttempts,
      config.windowMs
    );
    if (!accountResult.allowed) {
      sendRateLimitExceeded(
        reply,
        accountResult,
        'Rate limit exceeded: too many registration attempts for this email address. Please try again later.'
      );
      return;
    }
    setRateLimitHeaders(reply, accountResult);
    return;
  }

  setRateLimitHeaders(reply, ipResult);
}

// Background memory hygiene: periodically remove expired entries
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;
const pruneTimer = setInterval(() => {
  const now = Date.now();
  const config = getActiveRateLimitConfig();
  for (const [key, record] of rateLimitStore.entries()) {
    record.timestamps = record.timestamps.filter((ts) => ts > now - config.windowMs);
    if (record.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}, PRUNE_INTERVAL_MS);

if (pruneTimer.unref) {
  pruneTimer.unref(); // Ensures process termination is never blocked
}
