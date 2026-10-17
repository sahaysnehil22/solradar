import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import { db } from '../src/db/store.js';
import { PlanCode } from '@solradar/shared';

describe('Billing Idempotency, Retry Storm & Credit Safety', () => {
  let app: FastifyInstance;
  let testUserId: string;

  beforeAll(async () => {
    app = await createServer();

    // Create test user
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: 'billing_trader@solradar.io',
        password: 'password12345',
      },
    });
    testUserId = JSON.parse(res.body).user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('drops duplicate webhook deliveries under simulated retry storm', async () => {
    const eventId = `evt_retry_storm_${Date.now()}`;
    const payload = {
      id: eventId,
      type: 'customer.subscription.created',
      data: {
        userId: testUserId,
        planCode: PlanCode.SCOUT,
        subscriptionId: `sub_test_${eventId}`,
        status: 'active',
      },
    };

    // Simulate 5 concurrent webhook calls hitting the endpoint simultaneously
    const stormPromises = Array.from({ length: 5 }).map(() =>
      app.inject({
        method: 'POST',
        url: '/billing/webhook',
        payload,
      })
    );

    const responses = await Promise.all(stormPromises);
    const results = responses.map((r) => JSON.parse(r.body));

    // Exactly one should process, and four should be safely ignored as duplicate!
    const processed = results.filter((r) => r.status === 'processed');
    const duplicates = results.filter((r) => r.status === 'ignored_duplicate');

    expect(processed).toHaveLength(1);
    expect(duplicates).toHaveLength(4);

    // Verify user is upgraded to Scout
    const updatedUser = db.users.get(testUserId);
    expect(updatedUser?.plan).toBe(PlanCode.SCOUT);
  });

  it('applies referral discount safely without double-counting', async () => {
    // Referrer signs up
    const referrerRes = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: 'referrer@solradar.io',
        password: 'password12345',
      },
    });
    const referrerToken = JSON.parse(referrerRes.body).tokens.accessToken;

    // Get referral code
    const codeRes = await app.inject({
      method: 'GET',
      url: '/referrals',
      headers: { authorization: `Bearer ${referrerToken}` },
    });
    const { referralCode } = JSON.parse(codeRes.body);

    // Referee signs up with code
    const refereeRes = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: 'referee@solradar.io',
        password: 'password12345',
        referralCode,
      },
    });
    const refereeUserId = JSON.parse(refereeRes.body).user.id;

    // Verify referral credit was created
    const refereeCredits = Array.from(db.referralCredits.values()).filter((c) => c.userId === refereeUserId);
    expect(refereeCredits).toHaveLength(1);
    expect(refereeCredits[0].percentOff).toBe(20);
    expect(refereeCredits[0].monthsTotal).toBe(3);
    expect(refereeCredits[0].monthsApplied).toBe(0);

    // Simulate first invoice payment webhook
    await app.inject({
      method: 'POST',
      url: '/billing/webhook',
      payload: {
        id: `evt_inv_1_${Date.now()}`,
        type: 'invoice.payment_succeeded',
        data: {
          userId: refereeUserId,
          planCode: PlanCode.HUNTER,
          subscriptionId: `sub_ref_${Date.now()}`,
          status: 'active',
        },
      },
    });

    expect(refereeCredits[0].monthsApplied).toBe(1);
    expect(refereeCredits[0].status).toBe('active');
  }, 15000);
});
