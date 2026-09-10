import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';

import { isSuspicious, reportAndBlockIfSuspicious, isIpBlocked } from '../common/security/detectInjection';

function getIp(c: Context): string | undefined {
  const fwd = c.req.header('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return (c.env as any)?.incoming?.socket?.remoteAddress ?? undefined;
}

// Recursively remove MongoDB operator keys ($gt, $ne, ...) and dotted keys
// to prevent NoSQL injection through query/param/body objects.
function stripOperators(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(stripOperators);
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (k.startsWith('$') || k.includes('.')) continue; // drop operator/dotted keys
      out[k] = stripOperators(v);
    }
    return out;
  }
  return input;
}

export const noSqlInjectionGuard = createMiddleware(async (c, next) => {
  const ip = getIp(c);

  if (await isIpBlocked(ip)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Scan incoming strings (query + params) for injection signatures
  const query = c.req.query() as Record<string, string>;
  const params = (c.req.param() as Record<string, string>) ?? {};
  const scanTargets = [...Object.values(query), ...Object.values(params)];
  for (const value of scanTargets) {
    if (await reportAndBlockIfSuspicious(value, ip)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
  }

  // Strip operator keys from query/params before handlers see them.
  // Delegate to the original accessors (don't snapshot) so path params resolved
  // during routing remain available to downstream handlers.
  const origQuery = c.req.query.bind(c.req);
  const origParam = c.req.param.bind(c.req);
  (c.req as any).query = (name?: string) => {
    const all = stripOperators(origQuery()) as Record<string, string>;
    return name ? all[name] : all;
  };
  (c.req as any).param = (name?: string) => {
    const all = stripOperators(origParam()) as Record<string, string>;
    return name ? all[name] : all;
  };

  await next();
});

// Zod refine helper to reject suspicious strings inside schemas.
export const noInjection = (val: string, ctx: { addIssue: (i: unknown) => void }) => {
  if (isSuspicious(val)) {
    (ctx as any).addIssue({ code: 'custom', message: 'Invalid input' });
    return false;
  }
  return true;
};
