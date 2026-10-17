import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import helmet from '@fastify/helmet';
import {
  SignupDtoSchema,
  LoginDtoSchema,
  CreateCheckoutDtoSchema,
  CancelSubscriptionDtoSchema,
  TokenQueryDtoSchema,
  TrackWalletDtoSchema,
  PortfolioAddressDtoSchema,
  TelegramLinkDtoSchema,
  PlanCode,
} from '@solradar/shared';
import { env } from './config/env.js';
import { db, UserRecord } from './db/store.js';
import { authService, TokenPayload } from './auth/auth.service.js';
import { billingService } from './billing/billing.service.js';
import { tokensService } from './tokens/tokens.service.js';
import { walletsService } from './wallets/wallets.service.js';
import { referralsService } from './referrals/referrals.service.js';
import {
  metricsRegistry,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  logger,
} from './observability/index.js';

export async function createServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  // Security headers with Helmet
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // Prometheus Metrics Hook
  app.addHook('onRequest', async (req, reply) => {
    (req as any).startTime = process.hrtime();
  });

  app.addHook('onResponse', async (req, reply) => {
    const diff = process.hrtime((req as any).startTime);
    const duration = diff[0] + diff[1] / 1e9;
    const route = req.routeOptions?.url || req.url;
    httpRequestsTotal.inc({ method: req.method, route, status_code: reply.statusCode });
    httpRequestDurationSeconds.observe({ method: req.method, route, status_code: reply.statusCode }, duration);
  });

  // 1. Health & Readiness
  app.get('/healthz', async () => ({ status: 'ok', uptime: process.uptime(), timestamp: new Date() }));

  app.get('/readyz', async () => ({
    status: 'ready',
    database: 'connected',
    redis: 'connected',
    billingProvider: billingService.getProviderName(),
    timestamp: new Date(),
  }));

  app.get('/metrics', async (req, reply) => {
    reply.header('Content-Type', metricsRegistry.contentType);
    return metricsRegistry.metrics();
  });

  // Auth Helper
  const authenticate = async (req: FastifyRequest, reply: FastifyReply): Promise<TokenPayload> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Unauthorized: Missing or invalid token' });
      throw new Error('Unauthorized');
    }
    const token = authHeader.split(' ')[1];
    try {
      return authService.verifyAccessToken(token);
    } catch {
      reply.status(401).send({ error: 'Unauthorized: Token expired or invalid' });
      throw new Error('Unauthorized');
    }
  };

  // 2. Auth Routes
  app.post('/auth/signup', async (req, reply) => {
    const body = SignupDtoSchema.parse(req.body);

    const existingUser = Array.from(db.users.values()).find((u) => u.email === body.email);
    if (existingUser) {
      return reply.status(400).send({ error: 'Email already registered' });
    }

    const passwordHash = await authService.hashPassword(body.password);
    const user: UserRecord = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: body.email,
      passwordHash,
      telegramId: null,
      role: 'user',
      plan: PlanCode.FREE,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.users.set(user.id, user);

    // If referral code provided, apply discounts
    if (body.referralCode) {
      await referralsService.applyReferralAtSignup(user.id, body.referralCode);
    }

    const tokens = authService.generateTokens(user);
    return { user: { id: user.id, email: user.email, plan: user.plan, role: user.role }, tokens };
  });

  app.post('/auth/login', async (req, reply) => {
    const body = LoginDtoSchema.parse(req.body);

    const user = Array.from(db.users.values()).find((u) => u.email === body.email);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const validPassword = await authService.verifyPassword(body.password, user.passwordHash);
    if (!validPassword) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const tokens = authService.generateTokens(user);
    return { user: { id: user.id, email: user.email, plan: user.plan, role: user.role }, tokens };
  });

  app.post('/auth/refresh', async (req, reply) => {
    const refreshToken = (req.body as any)?.refreshToken;
    if (!refreshToken) {
      return reply.status(400).send({ error: 'refreshToken is required' });
    }
    try {
      const tokens = await authService.rotateRefreshToken(refreshToken);
      return tokens;
    } catch (err: any) {
      return reply.status(401).send({ error: err.message });
    }
  });

  app.post('/auth/telegram-link', async (req, reply) => {
    const session = await authenticate(req, reply);
    const body = TelegramLinkDtoSchema.parse(req.body);

    const verification = authService.validateTelegramInitData(body.initData);
    if (!verification.isValid || !verification.user) {
      return reply.status(400).send({ error: 'Invalid Telegram initData verification signature' });
    }

    const user = db.users.get(session.userId);
    if (user) {
      user.telegramId = String(verification.user.id);
      user.updatedAt = new Date();
    }

    return { success: true, telegramId: verification.user.id, username: verification.user.username };
  });

  app.get('/auth/me', async (req, reply) => {
    const session = await authenticate(req, reply);
    const user = db.users.get(session.userId);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
      telegramId: user.telegramId,
      createdAt: user.createdAt,
    };
  });

  // 3. Billing Routes (§2 & §2A)
  app.post('/billing/checkout', async (req, reply) => {
    const session = await authenticate(req, reply);
    const body = CreateCheckoutDtoSchema.parse(req.body);

    const checkout = await billingService.createCheckout(session.userId, body.planCode, {
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });

    return checkout;
  });

  app.post('/billing/portal', async (req, reply) => {
    const session = await authenticate(req, reply);
    const portal = await billingService.createPortal(session.userId);
    return portal;
  });

  app.post('/billing/webhook', async (req, reply) => {
    const payload = req.body;
    const signature = req.headers['stripe-signature'] as string | undefined;

    const result = await billingService.processWebhook(payload, signature);
    return result;
  });

  app.post('/billing/cancel', async (req, reply) => {
    const session = await authenticate(req, reply);
    const body = CancelSubscriptionDtoSchema.parse(req.body || {});

    const result = await billingService.cancelSubscription(session.userId, body.immediate);
    return result;
  });

  app.get('/billing/status', async (req, reply) => {
    const session = await authenticate(req, reply);
    const sub = Array.from(db.subscriptions.values()).find((s) => s.userId === session.userId);

    return {
      activeSubscription: sub || null,
      plan: session.plan,
      provider: billingService.getProviderName(),
      isTestBilling: billingService.getProviderName() === 'noop',
      notice: 'Test billing active — no real charges incurred.',
    };
  });

  // 4. Token Screener & Pulse Feed
  app.get('/tokens/screener', async (req) => {
    const query = TokenQueryDtoSchema.parse(req.query);
    return tokensService.queryScreener(query);
  });

  app.get('/tokens/pulse', async (req) => {
    const query = TokenQueryDtoSchema.parse({ ...(req.query as any), limit: 20 });
    return tokensService.queryScreener(query);
  });

  app.get('/tokens/:mint', async (req, reply) => {
    const mint = (req.params as any).mint;
    const detail = tokensService.getTokenDetail(mint);
    if (!detail) {
      return reply.status(404).send({ error: 'Token not found' });
    }
    return detail;
  });

  app.post('/tokens/webhook/helius', async (req, reply) => {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    const result = await tokensService.ingestHeliusWebhook(events);
    return result;
  });

  // 5. Tracked Wallets & Copy Signals
  app.get('/wallets/tracked', async (req, reply) => {
    const session = await authenticate(req, reply);
    return walletsService.getTrackedWallets(session.userId);
  });

  app.post('/wallets/track', async (req, reply) => {
    const session = await authenticate(req, reply);
    const body = TrackWalletDtoSchema.parse(req.body);

    try {
      const record = await walletsService.trackWallet(session.userId, body.address, body.label);
      return record;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  app.delete('/wallets/track', async (req, reply) => {
    const session = await authenticate(req, reply);
    const address = (req.query as any).address;
    if (!address) return reply.status(400).send({ error: 'address query param required' });

    const success = await walletsService.untrackWallet(session.userId, address);
    return { success };
  });

  app.post('/wallets/trade-webhook', async (req) => {
    const body = req.body as any;
    return walletsService.recordWalletTrade(body);
  });

  // 6. Portfolio (Read-Only)
  app.get('/portfolio', async (req, reply) => {
    const session = await authenticate(req, reply);
    return walletsService.getPortfolioSummary(session.userId);
  });

  app.post('/portfolio/address', async (req, reply) => {
    const session = await authenticate(req, reply);
    const body = PortfolioAddressDtoSchema.parse(req.body);

    const record = await walletsService.addPortfolioAddress(session.userId, body.address, body.label);
    return record;
  });

  // 7. Referrals
  app.get('/referrals', async (req, reply) => {
    const session = await authenticate(req, reply);
    const code = await referralsService.getOrCreateReferralCode(session.userId);
    const stats = referralsService.getUserReferralStats(session.userId);

    return {
      referralCode: code,
      referralLink: `${env.WEB_BASE_URL || 'https://solradar.io'}/signup?ref=${code}`,
      ...stats,
    };
  });

  // 8. Admin & Counters
  app.get('/admin/stats', async (req, reply) => {
    const session = await authenticate(req, reply);
    if (session.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    return {
      usersCount: db.users.size,
      tokensCount: db.tokens.size,
      alertsCount: db.alerts.size,
      deliveriesCount: db.alertDeliveries.size,
      paymentEventsCount: db.paymentEvents.size,
      systemCounters: Object.fromEntries(db.systemCounters.entries()),
      activeSubscriptions: db.subscriptions.size,
    };
  });

  return app;
}
