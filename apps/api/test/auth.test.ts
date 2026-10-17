import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';

describe('Auth & Session Rotation Flow', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('signs up user and issues JWT access token + refresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: 'trader1@solradar.io',
        password: 'securepassword123',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user.email).toBe('trader1@solradar.io');
    expect(body.tokens.accessToken).toBeDefined();
    expect(body.tokens.refreshToken).toBeDefined();
  });

  it('rejects duplicate email signup', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: 'trader1@solradar.io',
        password: 'securepassword123',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toContain('already registered');
  });

  it('authenticates login with valid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'trader1@solradar.io',
        password: 'securepassword123',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.tokens.accessToken).toBeDefined();
  });

  it('rotates refresh token and invalidates old token on reuse', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'trader1@solradar.io',
        password: 'securepassword123',
      },
    });
    const { refreshToken } = JSON.parse(loginRes.body).tokens;

    // First rotation succeeds
    const rotateRes1 = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(rotateRes1.statusCode).toBe(200);
    const newRefreshToken = JSON.parse(rotateRes1.body).refreshToken;
    expect(newRefreshToken).not.toBe(refreshToken);

    // Reuse attack with old refresh token should be rejected and revoke family!
    const rotateRes2 = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(rotateRes2.statusCode).toBe(401);
    expect(JSON.parse(rotateRes2.body).error).toContain('reuse detected');
  });
});
