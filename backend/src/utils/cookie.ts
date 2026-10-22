/**
 * Cookie parsing and serialization utility for HTTP-only session cookies.
 * Operates without external package dependencies using native HTTP headers.
 */

export const SESSION_COOKIE_NAME = 'aweer_session';
export const SESSION_COOKIE_PATH = '/api/v1';

export interface CookieSerializeOptions {
  maxAgeSeconds?: number;
  clear?: boolean;
}

/**
 * Extracts a specific cookie value from the request 'Cookie' header.
 */
export function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return null;
  }
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawKey, ...valParts] = cookie.trim().split('=');
    if (rawKey === name) {
      return valParts.join('=');
    }
  }
  return null;
}

/**
 * Serializes the session cookie with strict security flags:
 * - HttpOnly: Prevents client-side script access (mitigates XSS-based session theft).
 * - SameSite=Lax: Prevents cross-site request forgery on third-party state mutations.
 * - Secure: Automatically enforced in production environment.
 * - Path=/api/v1: Narrow path restriction appropriate for API session boundaries.
 */
export function serializeSessionCookie(token: string, options: CookieSerializeOptions = {}): string {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = 'Lax';

  if (options.clear) {
    return `${SESSION_COOKIE_NAME}=; Path=${SESSION_COOKIE_PATH}; HttpOnly; SameSite=${sameSite}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${isProd ? '; Secure' : ''}`;
  }

  const maxAge = options.maxAgeSeconds ?? 24 * 60 * 60; // 24 hours
  return `${SESSION_COOKIE_NAME}=${token}; Path=${SESSION_COOKIE_PATH}; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}${isProd ? '; Secure' : ''}`;
}
