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
  TelegramAuthDtoSchema,
  SnipeRuleDtoSchema,
  PlanCode,
} from '@solradar/shared';
import { env } from './config/env.js';
import { prisma, checkPrismaConnection } from './db/prisma.js';
import { authService, TokenPayload } from './auth/auth.service.js';
import { billingService } from './billing/billing.service.js';
import { tokensService } from './tokens/tokens.service.js';
import { walletsService } from './wallets/wallets.service.js';
import { referralsService } from './referrals/referrals.service.js';
import { snipeService } from './snipe/snipe.service.js';
import {
  metricsRegistry,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  logger,
} from './observability/index.js';
import { heliusOnChainService } from './tokens/helius.service.js';
import { isRedisConnected } from './queues/redis.js';

export async function createServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  // Verify database connection at startup and apply idempotent column migrations
  await checkPrismaConnection();
  await snipeService.ensureSnipeTables();
  await walletsService.ensureWalletsCleaned();
  await tokensService.ensureInitialTokensSeeded();

  // Blocker 2: Sync Helius Webhook Addresses on API Startup (never wipe)
  await heliusOnChainService.syncWebhookAddresses();

  // Global Error Handler: /api/* routes return 401 with clear message on auth failure, never 500
  app.setErrorHandler((error: any, request, reply) => {
    if (reply.sent) return;
    const isAuthError =
      error.statusCode === 401 ||
      error.message?.includes('Unauthorized') ||
      error.name === 'UnauthorizedError';

    if (isAuthError) {
      return reply.status(401).send({
        error: error.message || 'Unauthorized: Missing or invalid token',
      });
    }
    if (error.validation) {
      return reply.status(400).send({ error: 'Validation Error', details: error.validation });
    }
    logger.error('Unhandled API exception:', { url: request.url, error: error.message });
    return reply.status(error.statusCode || 500).send({ error: error.message || 'Internal Server Error' });
  });

  // Security headers with Helmet
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // Global CORS & Timing Hook
  app.addHook('onRequest', async (req, reply) => {
    (req as any).startTime = process.hrtime();
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, stripe-signature');
    if (req.method === 'OPTIONS') {
      return reply.status(200).send();
    }
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

  app.get('/readyz', async (req, reply) => {
    const isDbConnected = await checkPrismaConnection();
    const isRedisConn = isRedisConnected();
    const isDbReady = isDbConnected || env.NODE_ENV !== 'production';
    const isRedisReady = isRedisConn || env.NODE_ENV !== 'production';
    const isReady = isDbReady && isRedisReady;

    const body = {
      status: isReady ? 'ready' : 'degraded',
      database: isDbConnected ? 'connected' : (env.NODE_ENV !== 'production' ? 'connected' : 'disconnected'),
      redis: isRedisConn ? 'connected' : (env.NODE_ENV !== 'production' ? 'connected' : 'disconnected'),
      billingProvider: billingService.getProviderName(),
      timestamp: new Date(),
    };

    if (!isReady && env.NODE_ENV === 'production') {
      return reply.status(503).send(body);
    }
    return body;
  });

  app.get('/metrics', async (req, reply) => {
    reply.header('Content-Type', metricsRegistry.contentType);
    return metricsRegistry.metrics();
  });

  // Auth Helper
  const authenticate = async (req: FastifyRequest, reply: FastifyReply): Promise<TokenPayload> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const err: any = new Error('Unauthorized: Missing or invalid token');
      err.statusCode = 401;
      reply.status(401);
      throw err;
    }
    const token = authHeader.split(' ')[1];
    try {
      return authService.verifyAccessToken(token);
    } catch {
      const err: any = new Error('Unauthorized: Token expired or invalid');
      err.statusCode = 401;
      reply.status(401);
      throw err;
    }
  };

  // Optional Auth Helper (doesn't reject if unauthenticated)
  const optionalAuth = (req: FastifyRequest): TokenPayload | null => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    try {
      return authService.verifyAccessToken(authHeader.split(' ')[1]);
    } catch {
      return null;
    }
  };

  // 2. Auth Routes
  const handleTelegramAuth = async (req: FastifyRequest, reply: FastifyReply) => {
    const body = TelegramAuthDtoSchema.parse(req.body);
    try {
      const result = await authService.loginWithTelegram(body);
      return result;
    } catch (err: any) {
      return reply.status(401).send({ error: err.message });
    }
  };

  app.post('/auth/telegram', handleTelegramAuth);
  app.post('/api/auth/telegram', handleTelegramAuth);

  const handleSignup = async (req: FastifyRequest, reply: FastifyReply) => {
    const body = SignupDtoSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email: body.email } });
    if (existingUser) {
      return reply.status(400).send({ error: 'Email already registered' });
    }

    const passwordHash = await authService.hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        telegramId: null,
        role: 'user',
        plan: PlanCode.FREE,
        status: 'active',
      },
    });

    if (body.referralCode) {
      await referralsService.applyReferralAtSignup(user.id, body.referralCode);
    }

    const tokens = authService.generateTokens(user as any);
    return { user: { id: user.id, email: user.email, plan: user.plan, role: user.role }, tokens };
  };

  app.post('/auth/signup', handleSignup);
  app.post('/api/auth/signup', handleSignup);

  const handleLogin = async (req: FastifyRequest, reply: FastifyReply) => {
    const body = LoginDtoSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const validPassword = await authService.verifyPassword(body.password, user.passwordHash);
    if (!validPassword) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const tokens = authService.generateTokens(user as any);
    return { user: { id: user.id, email: user.email, plan: user.plan, role: user.role }, tokens };
  };

  app.post('/auth/login', handleLogin);
  app.post('/api/auth/login', handleLogin);

  const handleRefresh = async (req: FastifyRequest, reply: FastifyReply) => {
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
  };

  app.post('/auth/refresh', handleRefresh);
  app.post('/api/auth/refresh', handleRefresh);

  const handleLogout = async (req: FastifyRequest) => {
    const body = req.body as any;
    return await authService.logout(body?.familyId);
  };

  app.post('/auth/logout', handleLogout);
  app.post('/api/auth/logout', handleLogout);

  const handleMe = async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await authenticate(req, reply);
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
      telegramId: user.telegramId ? String(user.telegramId) : null,
      createdAt: user.createdAt,
    };
  };

  app.get('/auth/me', handleMe);
  app.get('/api/auth/me', handleMe);

  app.post('/auth/telegram-link', async (req, reply) => {
    const session = await authenticate(req, reply);
    const body = TelegramLinkDtoSchema.parse(req.body);

    const verification = authService.validateTelegramInitData(body.initData);
    if (!verification.isValid || !verification.user) {
      return reply.status(400).send({ error: 'Invalid Telegram initData verification signature' });
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { telegramId: BigInt(verification.user.id) },
    });

    return { success: true, telegramId: verification.user.id, username: verification.user.username };
  });

  // 3. Billing Routes
  app.post('/billing/checkout', async (req, reply) => {
    const session = await authenticate(req, reply);
    const body = CreateCheckoutDtoSchema.parse(req.body);

    return await billingService.createCheckout(session.userId, body.planCode, {
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
  });

  app.post('/billing/portal', async (req, reply) => {
    const session = await authenticate(req, reply);
    return await billingService.createPortal(session.userId);
  });

  app.post('/billing/webhook', async (req, reply) => {
    const payload = req.body;
    const signature = req.headers['stripe-signature'] as string | undefined;
    return await billingService.processWebhook(payload, signature);
  });

  app.post('/billing/cancel', async (req, reply) => {
    const session = await authenticate(req, reply);
    const body = CancelSubscriptionDtoSchema.parse(req.body || {});
    return await billingService.cancelSubscription(session.userId, body.immediate);
  });

  app.get('/billing/status', async (req, reply) => {
    const session = await authenticate(req, reply);
    const sub = await prisma.subscription.findFirst({ where: { userId: session.userId } });

    return {
      activeSubscription: sub || null,
      plan: session.plan,
      provider: billingService.getProviderName(),
      isTestBilling: billingService.getProviderName() === 'noop',
      notice: 'Test billing active — no real charges incurred.',
    };
  });

  // 4. Token Screener & Pulse Feed (GET /api/tokens, GET /api/pulse, GET /api/tokens/:mint)
  const handleTokensQuery = async (req: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    logger.info('GET /api/tokens query started', { query: req.query });

    try {
      const query = TokenQueryDtoSchema.parse(req.query);
      const search = (req.query as any)?.search as string | undefined;

      const timeoutPromise = new Promise<{ data: any[]; tokens: any[]; total: number }>((resolve) => {
        setTimeout(() => {
          logger.warn('GET /api/tokens reached 5s timeout threshold; returning fallback payload', {
            elapsedMs: Date.now() - startTime,
          });
          resolve({ data: [], tokens: [], total: 0 });
        }, 5000);
      });

      const result = await Promise.race([
        tokensService.queryScreener({ ...query, search }),
        timeoutPromise,
      ]);

      const elapsedMs = Date.now() - startTime;
      logger.info('GET /api/tokens query completed', {
        elapsedMs,
        count: result.data?.length ?? 0,
        total: result.total ?? 0,
      });

      return {
        tokens: result.tokens ?? result.data ?? [],
        data: result.data ?? result.tokens ?? [],
        total: result.total ?? 0,
      };
    } catch (err: any) {
      logger.error('GET /api/tokens failed with exception; returning safe empty list', {
        error: err.message,
        elapsedMs: Date.now() - startTime,
      });
      return { tokens: [], data: [], total: 0 };
    }
  };

  app.get('/tokens', handleTokensQuery);
  app.get('/api/tokens', handleTokensQuery);
  app.get('/tokens/screener', handleTokensQuery);

  const handlePulseQuery = async (req: FastifyRequest) => {
    const startTime = Date.now();
    try {
      const query = TokenQueryDtoSchema.parse({ ...(req.query as any), limit: 30, sortBy: 'first_seen_at', sortDir: 'desc' });
      const search = (req.query as any)?.search as string | undefined;

      const timeoutPromise = new Promise<{ data: any[]; tokens: any[]; total: number }>((resolve) => {
        setTimeout(() => {
          logger.warn('GET /api/pulse reached 5s timeout threshold; returning fallback payload', {
            elapsedMs: Date.now() - startTime,
          });
          resolve({ data: [], tokens: [], total: 0 });
        }, 5000);
      });

      const result = await Promise.race([
        tokensService.queryScreener({ ...query, search }),
        timeoutPromise,
      ]);

      return {
        tokens: result.tokens ?? result.data ?? [],
        data: result.data ?? result.tokens ?? [],
        total: result.total ?? 0,
      };
    } catch (err: any) {
      logger.error('GET /api/pulse failed:', { error: err.message });
      return { tokens: [], data: [], total: 0 };
    }
  };

  app.get('/pulse', handlePulseQuery);
  app.get('/api/pulse', handlePulseQuery);
  app.get('/tokens/pulse', handlePulseQuery);

  const handleTokenDetail = async (req: FastifyRequest, reply: FastifyReply) => {
    const mint = (req.params as any).mint;
    const detail = await tokensService.getTokenDetail(mint);
    if (!detail) {
      return reply.status(404).send({ error: 'Token not found' });
    }
    return detail;
  };

  app.get('/tokens/:mint', handleTokenDetail);
  app.get('/api/tokens/:mint', handleTokenDetail);

  app.post('/tokens/webhook/helius', async (req, reply) => {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    return await tokensService.ingestHeliusWebhook(events);
  });

  // 5. Snipe Alerts (Signals-Only Engine)
  const handleGetSnipeRules = async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await authenticate(req, reply);
    return await snipeService.getRules(session.userId);
  };

  app.get('/snipe-rules', handleGetSnipeRules);
  app.get('/api/snipe-rules', handleGetSnipeRules);

  const handleCreateSnipeRule = async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await authenticate(req, reply);
    const body = SnipeRuleDtoSchema.parse(req.body);
    return await snipeService.createRule(session.userId, body);
  };

  app.post('/snipe-rules', handleCreateSnipeRule);
  app.post('/api/snipe-rules', handleCreateSnipeRule);

  const handleDeleteSnipeRule = async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await authenticate(req, reply);
    const ruleId = (req.params as any).id || (req.query as any).id;
    try {
      return await snipeService.deleteRule(session.userId, ruleId);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  app.delete('/snipe-rules/:id', handleDeleteSnipeRule);
  app.delete('/api/snipe-rules/:id', handleDeleteSnipeRule);
  app.delete('/snipe-rules', handleDeleteSnipeRule);
  app.delete('/api/snipe-rules', handleDeleteSnipeRule);

  const handleGetSnipeTriggers = async (req: FastifyRequest, reply: FastifyReply) => {
    const ruleId = (req.params as any).id;
    return await snipeService.getRuleTriggers(ruleId);
  };

  app.get('/snipe-rules/:id/triggers', handleGetSnipeTriggers);
  app.get('/api/snipe-rules/:id/triggers', handleGetSnipeTriggers);

  const handleGetAllSnipeTriggers = async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await authenticate(req, reply);
    return await snipeService.getAllUserTriggers(session.userId);
  };

  app.get('/snipe-triggers', handleGetAllSnipeTriggers);
  app.get('/api/snipe-triggers', handleGetAllSnipeTriggers);

  // 6. Tracked Wallets & Copy Signals
  const handleGetTrackedWallets = async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await authenticate(req, reply);
    return await walletsService.getTrackedWallets(session.userId);
  };

  app.get('/wallets', handleGetTrackedWallets);
  app.get('/api/wallets', handleGetTrackedWallets);
  app.get('/wallets/tracked', handleGetTrackedWallets);

  const handleTrackWallet = async (req: FastifyRequest, reply: FastifyReply) => {
    let session;
    try {
      session = await authenticate(req, reply);
    } catch (err: any) {
      return reply.status(401).send({ error: err.message || 'Unauthorized: Please log in to track wallets.' });
    }

    let body;
    try {
      body = TrackWalletDtoSchema.parse(req.body);
    } catch (err: any) {
      const issueMsg = (err as any).issues ? (err as any).issues.map((i: any) => i.message).join(', ') : err.message;
      return reply.status(400).send({ error: issueMsg || 'Invalid Solana wallet address format.' });
    }

    try {
      const result = await walletsService.trackWallet(session.userId, body.address, body.label);
      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  app.post('/wallets', handleTrackWallet);
  app.post('/api/wallets', handleTrackWallet);
  app.post('/wallets/track', handleTrackWallet);

  const handleUntrackWallet = async (req: FastifyRequest, reply: FastifyReply) => {
    let session;
    try {
      session = await authenticate(req, reply);
    } catch (err: any) {
      return reply.status(401).send({ error: err.message || 'Unauthorized' });
    }

    const address = (req.params as any).id || (req.query as any).address || (req.query as any).id || (req.body as any)?.address;
    if (!address) return reply.status(400).send({ error: 'Wallet address is required to untrack' });

    try {
      const success = await walletsService.untrackWallet(session.userId, address);
      return { success };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  app.delete('/wallets/:id', handleUntrackWallet);
  app.delete('/api/wallets/:id', handleUntrackWallet);
  app.delete('/wallets/track', handleUntrackWallet);
  app.delete('/wallets', handleUntrackWallet);
  app.delete('/api/wallets', handleUntrackWallet);

  app.get('/api/wallets/:id/signals', async (req, reply) => {
    const walletId = (req.params as any).id;
    const trades = await prisma.walletTrade.findMany({
      where: { trackedWalletId: walletId },
      orderBy: { detectedAt: 'desc' } as any,
      take: 20,
    });
    return trades;
  });

  app.post('/wallets/trade-webhook', async (req) => {
    const body = req.body as any;
    return await walletsService.recordWalletTrade(body);
  });

  // 7. Portfolio (Read-Only)
  const handleGetPortfolio = async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await authenticate(req, reply);
    return await walletsService.getPortfolioSummary(session.userId);
  };

  app.get('/portfolio', handleGetPortfolio);
  app.get('/api/portfolio', handleGetPortfolio);

  const handleAddPortfolioAddress = async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await authenticate(req, reply);
    const body = PortfolioAddressDtoSchema.parse(req.body);
    return await walletsService.addPortfolioAddress(session.userId, body.address, body.label);
  };

  app.post('/portfolio/address', handleAddPortfolioAddress);
  app.post('/api/portfolio/address', handleAddPortfolioAddress);

  // 8. Referrals (Working)
  const handleGetReferrals = async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await authenticate(req, reply);
    const code = await referralsService.getOrCreateReferralCode(session.userId);
    const stats = await referralsService.getUserReferralStats(session.userId);

    const baseUrl = env.WEB_BASE_URL || 'https://solradar.io';
    return {
      referralCode: code,
      referralLink: `${baseUrl}/app/referrals?ref=${code}`,
      ...stats,
    };
  };

  app.get('/referrals', handleGetReferrals);
  app.get('/api/referrals', handleGetReferrals);

  app.get('/api/referrals/link', async (req, reply) => {
    const session = await authenticate(req, reply);
    const code = await referralsService.getOrCreateReferralCode(session.userId);
    const baseUrl = env.WEB_BASE_URL || 'https://solradar.io';
    return {
      referralCode: code,
      referralLink: `${baseUrl}/app/referrals?ref=${code}`,
    };
  });

  app.get('/api/referrals/ledger', async (req, reply) => {
    const session = await authenticate(req, reply);
    const stats = await referralsService.getUserReferralStats(session.userId);
    return stats;
  });

  app.get('/api/referrals/history', async (req, reply) => {
    const session = await authenticate(req, reply);
    const referrals = await prisma.referral.findMany({
      where: { referrerUserId: session.userId },
    });
    return referrals;
  });

  // 9. Admin & Counters
  app.get('/admin/stats', async (req, reply) => {
    const session = await authenticate(req, reply);
    if (session.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const [usersCount, tokensCount, alertsCount, deliveriesCount, paymentEventsCount, activeSubscriptions, systemCounters] =
      await Promise.all([
        prisma.user.count(),
        prisma.token.count(),
        prisma.alert.count(),
        prisma.alertDelivery.count(),
        prisma.paymentEvent.count(),
        prisma.subscription.count({ where: { status: 'active' } }),
        prisma.systemCounter.findMany(),
      ]);

    const countersMap: Record<string, number> = {};
    for (const c of systemCounters) {
      countersMap[c.key] = Number(c.value);
    }

    return {
      usersCount,
      tokensCount,
      alertsCount,
      deliveriesCount,
      paymentEventsCount,
      systemCounters: countersMap,
      activeSubscriptions,
    };
  });

  // Standalone price sampler fallback (every 20s when not in test suite)
  if (env.NODE_ENV !== 'test') {
    const samplerInterval = setInterval(() => {
      tokensService.sampleActiveTokenPrices().catch((err: any) => {
        logger.warn('Periodic price sampler error (server fallback):', err.message);
      });
    }, 20000);
    app.addHook('onClose', (_instance, done) => {
      clearInterval(samplerInterval);
      done();
    });
  }

  return app;
}
