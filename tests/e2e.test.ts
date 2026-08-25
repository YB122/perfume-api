import { beforeAll, afterAll, describe, it, expect } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Seed required env BEFORE importing the app (config/env parses process.env at import time)
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/perfume-test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'e2e-secret-e2e-secret-e2e-secret-123456';
process.env.STRIPE_SECRET_KEY = 'sk_test_e2e';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_e2e';
process.env.CLOUDINARY_CLOUD_NAME = 'c';
process.env.CLOUDINARY_API_KEY = 'k';
process.env.CLOUDINARY_API_SECRET = 's';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  const { connectDb } = await import('../src/config/db');
  await connectDb();
});

afterAll(async () => {
  const { disconnectDb } = await import('../src/config/db');
  await disconnectDb();
  await mongo.stop();
});

describe('perfume-api e2e', () => {
  it('GET /health returns ok', async () => {
    const { app } = await import('../src/app');
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('GET /openapi.json is served', async () => {
    const { app } = await import('../src/app');
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openapi).toContain('3.');
  });

  it('registers and logs in a customer', async () => {
    const { app } = await import('../src/app');
    const email = `user_${Date.now()}@example.com`;
    const reg = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', fullName: 'Test User' }),
    });
    if (reg.status !== 201) console.error('REG BODY', await reg.text());
    expect(reg.status).toBe(201);
    const regBody = await reg.json();
    expect(regBody.user).toBeTruthy();

    const login = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    expect(login.status).toBe(200);

    // Tokens arrive via httpOnly cookies — extract the access cookie for the next request.
    const setCookies = (login.headers as any).getSetCookie?.() ?? [];
    const access = setCookies.find((c: string) => c.startsWith('lumora_access='))?.split(';')[0];
    expect(access).toBeTruthy();

    // Authenticated product listing returns an array (cookie-authenticated)
    const list = await app.request('/v1/products', {
      headers: { cookie: access },
    });
    expect(list.status).toBe(200);
    const listBody = await list.json();
    expect(Array.isArray(listBody.data)).toBe(true);
  });

  it('rejects login with wrong password (401)', async () => {
    const { app } = await import('../src/app');
    const res = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });

  it('blocks NoSQL injection probe in query (?q=$ne)', async () => {
    const { app } = await import('../src/app');
    const res = await app.request('/v1/products?q=%24ne');
    expect(res.status).toBe(403);
  });
});
