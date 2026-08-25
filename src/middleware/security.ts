import type { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';
import { createMiddleware } from 'hono/factory';

import { env } from '../config/env';
import { noSqlInjectionGuard } from './sanitize';

function clientIp(c: any): string {
  const fwd = c.req.header('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return (c.env as any)?.incoming?.socket?.remoteAddress ?? 'anon';
}

// Tiny in-memory sliding-window rate limiter (per instance).
const hits = new Map<string, number[]>();
function rateLimiter(windowMs: number, limit: number) {
  return createMiddleware(async (c, next) => {
    const ip = clientIp(c);
    const now = Date.now();
    const arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= limit) {
      return c.json({ error: 'Too many requests, slow down.' }, 429);
    }
    arr.push(now);
    hits.set(ip, arr);
    await next();
  });
}

// Applies the security middlewares (plan req #9): Helmet-equivalent headers,
// CORS, compression, rate limiting, and NoSQL-injection guarding.
export function setupSecurity(app: OpenAPIHono): void {
  app.use(
    '*',
    secureHeaders({
      // Public JSON API consumed cross-origin by the storefront/dashboard SPAs.
      crossOriginResourcePolicy: 'cross-origin',
    })
  );
  app.use(
    '*',
    cors({
      origin: [
        env.NODE_ENV === 'production'
          ? 'https://dashboard.lumora.shop'
          : 'http://localhost:5173',
        env.NODE_ENV === 'production' ? 'https://lumora.shop' : 'http://localhost:3000',
        env.NODE_ENV === 'production' ? 'https://www.lumora.shop' : 'http://localhost:3000',
      ],
      credentials: true,
    })
  );
  app.use('*', compress());

  // 120 requests / minute per IP
  app.use('/v1/*', rateLimiter(60 * 1000, 120));

  // NoSQL injection guard on all API routes
  app.use('/v1/*', noSqlInjectionGuard);
}
