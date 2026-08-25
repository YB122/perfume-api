import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';

import { verifyAccessToken, ACCESS_COOKIE, type Role, type AppJwtPayload } from './jwt';
import { getCookie } from 'hono/cookie';
import { logger } from '../config/logger';

export interface AuthEnv {
  Variables: {
    user: AppJwtPayload;
  };
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  // Token may arrive via Authorization header (non-browser/API clients) or httpOnly cookie (SPA).
  const header = c.req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : getCookie(c, ACCESS_COOKIE) ?? null;
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  try {
    const payload = await verifyAccessToken(token);
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

export const requireRole =
  (...allowed: Role[]) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const user = c.get('user');
    if (!allowed.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  });

// Guards vendor-scoped resources against IDOR: the token's vendorId must match :vendorId
export const requireVendorOwnership = createMiddleware<AuthEnv>(async (c, next) => {
  const user = c.get('user');
  const paramVendorId = c.req.param('vendorId');
  if (user.role === 'super_admin') return next();
  if (user.vendorId !== paramVendorId) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
});

// Attach the resolved locale to the context for downstream handlers.
export const localeMiddleware = createMiddleware(async (c, next) => {
  const SUPPORTED = ['en', 'fr', 'ar'] as const;
  const q = c.req.query('lang');
  const h = c.req.header('accept-language')?.split(',')[0]?.split('-')[0];
  const resolved = ([q, h].find((l) => SUPPORTED.includes(l as (typeof SUPPORTED)[number])) ?? 'en') as string;
  c.set('locale', resolved);
  await next();
});

export function getLocale(c: Context): string {
  return (c.get('locale') as string) ?? 'en';
}
