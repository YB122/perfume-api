import { sign, verify } from 'hono/jwt';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';

import { env, isProd } from '../config/env';

export type Role = 'super_admin' | 'vendor_admin' | 'vendor_staff' | 'customer';

export interface AppJwtPayload {
  sub: string; // user id
  role: Role;
  vendorId?: string;
  exp?: number;
}

export const ACCESS_COOKIE = 'lumora_access';
export const REFRESH_COOKIE = 'lumora_refresh';
export const WEB_ACCESS_COOKIE = 'lumora_access_web';
export const WEB_REFRESH_COOKIE = 'lumora_refresh_web';

function isWebClient(c: Parameters<typeof getCookie>[0]): boolean {
  return (c.req.header('x-client') ?? '').toLowerCase() === 'web';
}

const refreshSecret = () => env.REFRESH_TOKEN_SECRET ?? env.JWT_SECRET;

export async function signAccessToken(payload: Omit<AppJwtPayload, 'exp'>): Promise<string> {
  return sign(
    { ...payload, exp: getExpiry(env.JWT_EXPIRES_IN) } as Record<string, unknown>,
    env.JWT_SECRET,
    'HS256'
  );
}

export async function verifyAccessToken(token: string): Promise<AppJwtPayload> {
  return (await (verify as any)(token, env.JWT_SECRET, 'HS256')) as unknown as AppJwtPayload;
}

export async function signRefreshToken(payload: Omit<AppJwtPayload, 'exp'>): Promise<string> {
  return sign(
    { ...payload, exp: getExpiry(env.REFRESH_TOKEN_EXPIRES_IN) } as Record<string, unknown>,
    refreshSecret(),
    'HS256'
  );
}

export async function verifyRefreshToken(token: string): Promise<AppJwtPayload> {
  return (await (verify as any)(token, refreshSecret(), 'HS256')) as unknown as AppJwtPayload;
}

function cookieOpts(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSec,
  };
}

// Tokens are delivered only via httpOnly cookies (XSS-safe). The SPA cannot read them.
// The storefront (web) receives cookies suffixed with `_web` so its sessions are
// isolated from the dashboard's `lumora_access` / `lumora_refresh` cookies.
export function setAuthCookies(
  c: Parameters<typeof setCookie>[0],
  accessToken: string,
  refreshToken: string
): void {
  const now = Math.floor(Date.now() / 1000);
  const web = isWebClient(c);
  const accessName = web ? WEB_ACCESS_COOKIE : ACCESS_COOKIE;
  const refreshName = web ? WEB_REFRESH_COOKIE : REFRESH_COOKIE;
  setCookie(c, accessName, accessToken, cookieOpts(getExpiry(env.JWT_EXPIRES_IN) - now));
  setCookie(c, refreshName, refreshToken, cookieOpts(getExpiry(env.REFRESH_TOKEN_EXPIRES_IN) - now));
}

export function clearAuthCookies(c: Parameters<typeof setCookie>[0]): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, WEB_ACCESS_COOKIE, WEB_REFRESH_COOKIE]) {
    deleteCookie(c, name, { path: '/' });
  }
}

function getExpiry(human: string): number {
  const m = human.match(/^(\d+)([dhm])$/);
  if (!m) return Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const n = Number(m[1]);
  const sec = m[2] === 'd' ? 86400 : m[2] === 'h' ? 3600 : 60;
  return Math.floor(Date.now() / 1000) + n * sec;
}
