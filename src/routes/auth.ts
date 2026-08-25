import { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute, z } from '@hono/zod-openapi';

import { authResponseSchema, loginSchema, registerSchema } from '../schemas/auth.schema';
import { authMiddleware } from '../lib/auth';
import {
  registerCustomer,
  login,
  AuthError,
  getUserById,
  issueTokensFromPayload,
} from '../services/auth.service';
import {
  REFRESH_COOKIE,
  setAuthCookies,
  clearAuthCookies,
  verifyRefreshToken,
} from '../lib/jwt';
import { getCookie } from 'hono/cookie';
import type { AppJwtPayload } from '../lib/jwt';

export const authRouter = new OpenAPIHono();

const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  tags: ['auth'],
  summary: 'Register a new customer',
  request: { body: { content: { 'application/json': { schema: registerSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: authResponseSchema } } },
    400: { description: 'Bad request' },
  },
});

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['auth'],
  summary: 'Login (sets httpOnly auth cookies)',
  request: { body: { content: { 'application/json': { schema: loginSchema } } } },
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: authResponseSchema } } },
    401: { description: 'Unauthorized' },
  },
});

const refreshRoute = createRoute({
  method: 'post',
  path: '/refresh',
  tags: ['auth'],
  summary: 'Rotate access token from refresh cookie',
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: authResponseSchema } } },
    401: { description: 'Unauthorized' },
  },
});

const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  tags: ['auth'],
  summary: 'Clear auth cookies',
  responses: {
    200: { description: 'OK' },
  },
});

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['auth'],
  security: [{ Bearer: [] }],
  middleware: [authMiddleware] as any,
  summary: 'Current user',
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: authResponseSchema } } },
    401: { description: 'Unauthorized' },
  },
});

authRouter.openapi(registerRoute, async (c) => {
  try {
    const body = c.req.valid('json');
    const result = await registerCustomer(body);
    setAuthCookies(c, result.accessToken, result.refreshToken);
    return c.json({ user: result.user }, 201);
  } catch (err) {
    if (err instanceof AuthError) return c.json({ error: err.message }, err.status as any);
    throw err;
  }
});

authRouter.openapi(loginRoute, async (c) => {
  try {
    const body = c.req.valid('json');
    const result = await login(body);
    setAuthCookies(c, result.accessToken, result.refreshToken);
    return c.json({ user: result.user });
  } catch (err) {
    if (err instanceof AuthError) return c.json({ error: err.message }, err.status as any);
    throw err;
  }
});

authRouter.openapi(refreshRoute, async (c) => {
  const rt = getCookie(c, REFRESH_COOKIE);
  if (!rt) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const payload = await verifyRefreshToken(rt);
    const tokens = await issueTokensFromPayload(payload);
    setAuthCookies(c, tokens.accessToken, tokens.refreshToken);
    return c.json({ user: tokens.user });
  } catch {
    clearAuthCookies(c);
    return c.json({ error: 'Unauthorized' }, 401);
  }
});

authRouter.openapi(logoutRoute, async (c) => {
  clearAuthCookies(c);
  return c.json({ ok: true });
});

authRouter.openapi(meRoute, async (c) => {
  const sub = (c.get('user' as any) as AppJwtPayload).sub;
  const user = await getUserById(sub);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ user });
});

// silence unused import warning for authMiddleware (used by mounted routers)
void authMiddleware;
