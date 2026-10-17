import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import { prisma } from '../src/db/prisma.js';
import { PlanCode } from '@solradar/shared';

describe('Tracked Wallets, Copy Signals & Portfolio Integration', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await createServer();

    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: 'wallet_trader@solradar.io',
        password: 'password12345',
      },
    });
    const parsed = JSON.parse(signup.body);
    userToken = parsed.tokens.accessToken;
    userId = parsed.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('enforces plan limits on tracked wallets for free vs scout vs hunter tier', async () => {
    const targetAddress = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

    // Free user has limit of 0 tracked wallets
    const freeRes = await app.inject({
      method: 'POST',
      url: '/wallets/track',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { address: targetAddress, label: 'Top Whale' },
    });
    expect(freeRes.statusCode).toBe(400);
    expect(JSON.parse(freeRes.body).error).toContain('Plan limit reached');

    // Upgrade user to Scout (limit: 1) in database
    await prisma.user.update({
      where: { id: userId },
      data: { plan: PlanCode.SCOUT },
    });

    const scoutRes1 = await app.inject({
      method: 'POST',
      url: '/wallets/track',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { address: targetAddress, label: 'Top Whale' },
    });
    expect(scoutRes1.statusCode).toBe(200);

    // Scout adding a 2nd wallet should fail
    const scoutRes2 = await app.inject({
      method: 'POST',
      url: '/wallets/track',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { address: '9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsV', label: 'Second Whale' },
    });
    expect(scoutRes2.statusCode).toBe(400);
    expect(JSON.parse(scoutRes2.body).error).toContain('Plan limit reached');
  });

  it('records wallet trade and emits signal while dropping duplicate signatures', async () => {
    const trackedAddr = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
    const sig = `5xSignatureTest_${Date.now()}`;

    // Ingest first trade
    const res1 = await app.inject({
      method: 'POST',
      url: '/wallets/trade-webhook',
      payload: {
        address: trackedAddr,
        signature: sig,
        mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        side: 'buy',
        amountUsd: 5000,
        price: 0.0000214,
        slot: 285000100,
      },
    });
    expect(res1.statusCode).toBe(200);
    const body1 = JSON.parse(res1.body);
    expect(body1.status).toBe('recorded_and_fanned_out');

    // Re-ingest the exact same transaction signature
    const res2 = await app.inject({
      method: 'POST',
      url: '/wallets/trade-webhook',
      payload: {
        address: trackedAddr,
        signature: sig,
        mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        side: 'buy',
        amountUsd: 5000,
        price: 0.0000214,
        slot: 285000100,
      },
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.body);
    expect(body2.status).toBe('dropped_duplicate_signature');
  });

  it('aggregates read-only portfolio for public addresses without private keys', async () => {
    // Add public address
    const addRes = await app.inject({
      method: 'POST',
      url: '/portfolio/address',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { address: 'Fr8vQY2N1HkJ5t2qQp1u8z5iU7yL6K3P', label: 'Treasury Cold' },
    });
    expect(addRes.statusCode).toBe(200);

    // Read portfolio
    const portRes = await app.inject({
      method: 'GET',
      url: '/portfolio',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(portRes.statusCode).toBe(200);
    const data = JSON.parse(portRes.body);

    expect(data.addressesCount).toBeGreaterThanOrEqual(1);
    expect(data.totalValueUsd).toBeGreaterThan(0);
    expect(data.holdings).toHaveLength(3);
    expect(data.holdings[0].symbol).toBe('BONK');
  });
});
