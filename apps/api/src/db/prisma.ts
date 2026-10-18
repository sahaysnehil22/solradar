import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../observability/index.js';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

export const realPrisma =
  globalThis.__prismaClient ??
  new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalThis.__prismaClient = realPrisma;
}

/**
 * In-memory fallback repository providing exact Prisma-compatible methods
 * when running tests or development without an active PostgreSQL instance.
 */
const pendingEventIds = new Set<string>();

class InMemoryDbAdapter {
  public users = new Map<string, any>();
  public telegramAccounts = new Map<string, any>();
  public subscriptions = new Map<string, any>();
  public payments = new Map<string, any>();
  public paymentEvents = new Map<string, any>();
  public referrals = new Map<string, any>();
  public referralCredits = new Map<string, any>();
  public trackedWallets = new Map<string, any>();
  public walletTrades = new Map<string, any>();
  public tokens = new Map<string, any>();
  public tokenSnapshots = new Map<string, any>();
  public riskReports = new Map<string, any>();
  public alerts = new Map<string, any>();
  public alertDeliveries = new Map<string, any>();
  public watchlists = new Map<string, any>();
  public portfolioAddresses = new Map<string, any>();
  public portfolioSnapshots = new Map<string, any>();
  public snipeRules = new Map<string, any>();
  public snipeTriggers = new Map<string, any>();
  public systemCounters = new Map<string, any>();

  private rowLocks = new Set<string>();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    this.systemCounters.set('rpc_budget_burn_daily', { id: 'cnt_1', key: 'rpc_budget_burn_daily', value: BigInt(0) });
    this.systemCounters.set('webhook_ingest_count', { id: 'cnt_2', key: 'webhook_ingest_count', value: BigInt(0) });
    this.systemCounters.set('alert_fanout_count', { id: 'cnt_3', key: 'alert_fanout_count', value: BigInt(0) });
  }

  async acquireRowLock(key: string, timeoutMs = 2000): Promise<() => void> {
    const start = Date.now();
    while (this.rowLocks.has(key)) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Lock acquisition timeout for row: ${key}`);
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    this.rowLocks.add(key);
    return () => {
      this.rowLocks.delete(key);
    };
  }

  get user() {
    return {
      findUnique: async ({ where }: any) => {
        if (where.id) return this.users.get(where.id) || null;
        if (where.email) {
          for (const u of this.users.values()) {
            if (u.email === where.email) return u;
          }
        }
        return null;
      },
      findFirst: async ({ where }: any) => {
        for (const u of this.users.values()) {
          let match = true;
          if (where.email && u.email !== where.email) match = false;
          if (where.id && u.id !== where.id) match = false;
          if (match) return u;
        }
        return null;
      },
      findMany: async () => Array.from(this.users.values()),
      create: async ({ data }: any) => {
        const id = data.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const record = {
          id,
          email: data.email,
          passwordHash: data.passwordHash,
          telegramId: data.telegramId ?? null,
          role: data.role || 'user',
          plan: data.plan || 'scout',
          status: data.status || 'active',
          createdAt: data.createdAt || new Date(),
          updatedAt: new Date(),
        };
        this.users.set(id, record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const u = await this.user.findUnique({ where });
        if (!u) throw new Error('User not found');
        Object.assign(u, data, { updatedAt: new Date() });
        return u;
      },
      count: async () => this.users.size,
    };
  }

  get telegramAccount() {
    return {
      findUnique: async ({ where }: any) => {
        if (where.telegramId) {
          const tId = BigInt(where.telegramId);
          for (const t of this.telegramAccounts.values()) {
            if (t.telegramId === tId) return t;
          }
        }
        return null;
      },
      create: async ({ data }: any) => {
        const id = data.id || `tg_${Date.now()}`;
        const record = {
          id,
          userId: data.userId,
          telegramId: BigInt(data.telegramId),
          username: data.username || null,
          linkedAt: new Date(),
        };
        this.telegramAccounts.set(id, record);
        return record;
      },
    };
  }

  get subscription() {
    return {
      findUnique: async ({ where }: any) => {
        if (where.id) return this.subscriptions.get(where.id) || null;
        if (where.providerSubscriptionId) {
          for (const s of this.subscriptions.values()) {
            if (s.providerSubscriptionId === where.providerSubscriptionId) return s;
          }
        }
        return null;
      },
      findFirst: async ({ where }: any) => {
        for (const s of this.subscriptions.values()) {
          let match = true;
          if (where.userId && s.userId !== where.userId) match = false;
          if (where.status && s.status !== where.status) match = false;
          if (match) return s;
        }
        return null;
      },
      findMany: async () => Array.from(this.subscriptions.values()),
      create: async ({ data }: any) => {
        const id = data.id || `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          userId: data.userId,
          providerSubscriptionId: data.providerSubscriptionId || `sub_prov_${Date.now()}`,
          planId: data.planId || data.planCode || 'scout',
          status: data.status || 'active',
          currentPeriodEnd: data.currentPeriodEnd || new Date(Date.now() + 30 * 86400000),
          cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.subscriptions.set(id, record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const s = await this.subscription.findUnique({ where });
        if (!s) throw new Error('Subscription not found');
        Object.assign(s, data, { updatedAt: new Date() });
        return s;
      },
      count: async () => this.subscriptions.size,
    };
  }

  get paymentEvent() {
    return {
      findUnique: async ({ where }: any) => {
        if (where.id) return this.paymentEvents.get(where.id) || null;
        if (where.providerEventId) {
          for (const p of this.paymentEvents.values()) {
            if (p.providerEventId === where.providerEventId) return p;
          }
        }
        return null;
      },
      findMany: async ({ where }: any = {}) => {
        let list = Array.from(this.paymentEvents.values());
        if (where?.providerEventId) list = list.filter((p) => p.providerEventId === where.providerEventId);
        return list;
      },
      create: async ({ data }: any) => {
        if (pendingEventIds.has(data.providerEventId) || this.paymentEvents.has(data.providerEventId)) {
          const err: any = new Error('Unique constraint failed on the fields: (`provider_event_id`)');
          err.code = 'P2002';
          throw err;
        }
        pendingEventIds.add(data.providerEventId);
        const existing = await this.paymentEvent.findUnique({ where: { providerEventId: data.providerEventId } });
        if (existing) {
          const err: any = new Error('Unique constraint failed on the fields: (`provider_event_id`)');
          err.code = 'P2002';
          throw err;
        }
        const id = data.id || `pe_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          providerEventId: data.providerEventId,
          type: data.type,
          payload: data.payload || {},
          processedAt: new Date(),
        };
        this.paymentEvents.set(id, record);
        return record;
      },
      count: async () => this.paymentEvents.size,
    };
  }

  get payment() {
    return {
      create: async ({ data }: any) => {
        const id = data.id || `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = { ...data, id, createdAt: new Date() };
        this.payments.set(id, record);
        return record;
      },
      count: async () => this.payments.size,
    };
  }

  get referral() {
    return {
      findUnique: async ({ where }: any) => {
        if (where.code) {
          for (const r of this.referrals.values()) {
            if (r.code === where.code) return r;
          }
        }
        if (where.id) return this.referrals.get(where.id) || null;
        return null;
      },
      findFirst: async ({ where }: any) => {
        for (const r of this.referrals.values()) {
          let match = true;
          if (where.referrerUserId && r.referrerUserId !== where.referrerUserId) match = false;
          if (where.code && r.code !== where.code) match = false;
          if (match) return r;
        }
        return null;
      },
      findMany: async ({ where }: any = {}) => {
        let list = Array.from(this.referrals.values());
        if (where?.referrerUserId) list = list.filter((r) => r.referrerUserId === where.referrerUserId);
        if (where?.status) list = list.filter((r) => r.status === where.status);
        return list;
      },
      create: async ({ data }: any) => {
        const id = data.id || `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          code: data.code,
          referrerUserId: data.referrerUserId,
          refereeUserId: data.refereeUserId || null,
          status: data.status || 'pending',
          createdAt: new Date(),
        };
        this.referrals.set(id, record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const r = await this.referral.findUnique({ where });
        if (!r) throw new Error('Referral not found');
        Object.assign(r, data);
        return r;
      },
      count: async () => this.referrals.size,
    };
  }

  get referralCredit() {
    return {
      findUnique: async ({ where }: any) => this.referralCredits.get(where.id) || null,
      findFirst: async ({ where }: any) => {
        for (const c of this.referralCredits.values()) {
          let match = true;
          if (where.userId && c.userId !== where.userId) match = false;
          if (where.status && c.status !== where.status) match = false;
          if (match) return c;
        }
        return null;
      },
      findMany: async ({ where }: any = {}) => {
        let results = Array.from(this.referralCredits.values());
        if (where?.userId) results = results.filter((c) => c.userId === where.userId);
        if (where?.status) results = results.filter((c) => c.status === where.status);
        return results;
      },
      create: async ({ data }: any) => {
        const id = data.id || `rc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          userId: data.userId,
          referralId: data.referralId,
          percentOff: data.percentOff ?? 20,
          monthsTotal: data.monthsTotal ?? 3,
          monthsApplied: data.monthsApplied ?? 0,
          status: data.status || 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.referralCredits.set(id, record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const c = this.referralCredits.get(where.id);
        if (!c) throw new Error('Referral credit not found');
        Object.assign(c, data, { updatedAt: new Date() });
        return c;
      },
      count: async () => this.referralCredits.size,
    };
  }

  get trackedWallet() {
    return {
      findUnique: async ({ where }: any) => {
        if (where.id) return this.trackedWallets.get(where.id) || null;
        if (where.userId_address) {
          for (const w of this.trackedWallets.values()) {
            if (w.userId === where.userId_address.userId && w.address === where.userId_address.address) return w;
          }
        }
        return null;
      },
      findFirst: async ({ where }: any) => {
        for (const w of this.trackedWallets.values()) {
          let match = true;
          if (where.userId && w.userId !== where.userId) match = false;
          if (where.address && w.address !== where.address) match = false;
          if (match) return w;
        }
        return null;
      },
      findMany: async ({ where }: any = {}) => {
        let list = Array.from(this.trackedWallets.values());
        if (where?.userId) list = list.filter((w) => w.userId === where.userId);
        if (where?.address) list = list.filter((w) => w.address === where.address);
        return list;
      },
      count: async ({ where }: any = {}) => {
        if (where?.userId) {
          return Array.from(this.trackedWallets.values()).filter((w) => w.userId === where.userId).length;
        }
        return this.trackedWallets.size;
      },
      create: async ({ data }: any) => {
        const id = data.id || `tw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          userId: data.userId,
          address: data.address,
          label: data.label || 'Smart Trader',
          createdAt: new Date(),
        };
        this.trackedWallets.set(id, record);
        return record;
      },
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (const [id, w] of this.trackedWallets.entries()) {
          if (w.userId === where.userId && (!where.address || w.address === where.address)) {
            this.trackedWallets.delete(id);
            count++;
          }
        }
        return { count };
      },
    };
  }

  get walletTrade() {
    return {
      findUnique: async ({ where }: any) => {
        if (where.signature) {
          for (const t of this.walletTrades.values()) {
            if (t.signature === where.signature) return t;
          }
        }
        if (where.id) return this.walletTrades.get(where.id) || null;
        return null;
      },
      create: async ({ data }: any) => {
        const id = data.id || `wt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          trackedWalletId: data.trackedWalletId,
          signature: data.signature,
          mint: data.mint,
          side: data.side,
          amountUsd: Number(data.amountUsd),
          price: Number(data.price),
          slot: BigInt(data.slot || 0),
          detectedAt: new Date(),
        };
        this.walletTrades.set(id, record);
        return record;
      },
      count: async () => this.walletTrades.size,
    };
  }

  get token() {
    return {
      findUnique: async ({ where }: any) => {
        if (where.mint) {
          for (const t of this.tokens.values()) {
            if (t.mint === where.mint) return t;
          }
        }
        if (where.id) return this.tokens.get(where.id) || null;
        return null;
      },
      findMany: async () => Array.from(this.tokens.values()),
      create: async ({ data }: any) => {
        const id = data.id || `tok_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          mint: data.mint,
          symbol: data.symbol,
          name: data.name,
          imageUrl: data.imageUrl || null,
          decimals: data.decimals ?? 6,
          creator: data.creator || null,
          priceHistory: data.priceHistory || [],
          createdAtSlot: data.createdAtSlot ? BigInt(data.createdAtSlot) : null,
          firstSeenAt: data.firstSeenAt || new Date(),
        };
        this.tokens.set(id, record);
        return record;
      },
      update: async ({ where, data }: any) => {
        let record = where.id ? this.tokens.get(where.id) : null;
        if (!record && where.mint) {
          for (const t of this.tokens.values()) {
            if (t.mint === where.mint) {
              record = t;
              break;
            }
          }
        }
        if (!record) throw new Error('Token not found');
        const updated = { ...record, ...data };
        this.tokens.set(record.id, updated);
        return updated;
      },
      deleteMany: async ({ where }: any = {}) => {
        let deleted = 0;
        for (const [id, t] of Array.from(this.tokens.entries())) {
          if (where?.OR) {
            const matches = where.OR.some((cond: any) => {
              if (cond.symbol && t.symbol === cond.symbol) return true;
              if (cond.name && t.name === cond.name) return true;
              return false;
            });
            if (matches) {
              this.tokens.delete(id);
              deleted++;
            }
          }
        }
        return { count: deleted };
      },
      count: async ({ where }: any = {}) => {
        if (where?.NOT?.OR) {
          let count = 0;
          for (const t of this.tokens.values()) {
            const matches = where.NOT.OR.some((cond: any) => {
              if (cond.symbol && t.symbol === cond.symbol) return true;
              if (cond.name && t.name === cond.name) return true;
              return false;
            });
            if (!matches) count++;
          }
          return count;
        }
        return this.tokens.size;
      },
    };
  }

  get tokenSnapshot() {
    return {
      findMany: async ({ where }: any = {}) => {
        let list = Array.from(this.tokenSnapshots.values());
        if (where?.tokenId) {
          if (typeof where.tokenId === 'object' && Array.isArray(where.tokenId.in)) {
            const set = new Set(where.tokenId.in);
            list = list.filter((s) => set.has(s.tokenId));
          } else {
            list = list.filter((s) => s.tokenId === where.tokenId);
          }
        }
        return list;
      },
      create: async ({ data }: any) => {
        const id = data.id || `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          tokenId: data.tokenId,
          price: Number(data.price),
          mcap: Number(data.mcap),
          liquidityUsd: Number(data.liquidityUsd),
          volume5m: Number(data.volume5m ?? 0),
          volume1h: Number(data.volume1h ?? 0),
          volume24h: Number(data.volume24h ?? 0),
          buys: Number(data.buys ?? 0),
          sells: Number(data.sells ?? 0),
          holderCount: Number(data.holderCount ?? 0),
          top10Pct: Number(data.top10Pct ?? 0),
          devHoldingPct: Number(data.devHoldingPct ?? 0),
          topHolders: data.topHolders || [],
          mintAuthRevoked: Boolean(data.mintAuthRevoked),
          freezeAuthRevoked: Boolean(data.freezeAuthRevoked),
          lpBurnedOrLockedPct: Number(data.lpBurnedOrLockedPct ?? 0),
          stage: data.stage || 'new',
          takenAt: data.takenAt || new Date(),
        };
        this.tokenSnapshots.set(id, record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const record = this.tokenSnapshots.get(where.id);
        if (!record) throw new Error('TokenSnapshot not found');
        const updated = { ...record, ...data };
        this.tokenSnapshots.set(where.id, updated);
        return updated;
      },
      deleteMany: async () => {
        const count = this.tokenSnapshots.size;
        this.tokenSnapshots.clear();
        return { count };
      },
      count: async () => this.tokenSnapshots.size,
    };
  }

  get alert() {
    return {
      findUnique: async ({ where }: any) => {
        if (where.eventKey) {
          for (const a of this.alerts.values()) {
            if (a.eventKey === where.eventKey) return a;
          }
        }
        if (where.id) return this.alerts.get(where.id) || null;
        return null;
      },
      findMany: async () => Array.from(this.alerts.values()),
      create: async ({ data }: any) => {
        const id = data.id || `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          eventKey: data.eventKey,
          kind: data.kind,
          tokenId: data.tokenId || null,
          payload: data.payload || {},
          createdAt: new Date(),
        };
        this.alerts.set(id, record);
        return record;
      },
      count: async () => this.alerts.size,
    };
  }

  get alertDelivery() {
    return {
      findUnique: async ({ where }: any) => {
        if (where.userId_alertId) {
          for (const d of this.alertDeliveries.values()) {
            if (d.userId === where.userId_alertId.userId && d.alertId === where.userId_alertId.alertId) return d;
          }
        }
        if (where.id) return this.alertDeliveries.get(where.id) || null;
        return null;
      },
      create: async ({ data }: any) => {
        const existing = await this.alertDelivery.findUnique({
          where: { userId_alertId: { userId: data.userId, alertId: data.alertId } },
        });
        if (existing) {
          const err: any = new Error('Unique constraint failed on the fields: (`user_id`,`alert_id`)');
          err.code = 'P2002';
          throw err;
        }
        const id = data.id || `del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          alertId: data.alertId,
          userId: data.userId,
          channel: data.channel || 'telegram',
          status: data.status || 'sent',
          sentAt: new Date(),
        };
        this.alertDeliveries.set(id, record);
        return record;
      },
      count: async () => this.alertDeliveries.size,
    };
  }

  get portfolioAddress() {
    return {
      findFirst: async ({ where }: any) => {
        for (const p of this.portfolioAddresses.values()) {
          let match = true;
          if (where.userId && p.userId !== where.userId) match = false;
          if (where.address && p.address !== where.address) match = false;
          if (match) return p;
        }
        return null;
      },
      findMany: async ({ where }: any = {}) => {
        let list = Array.from(this.portfolioAddresses.values());
        if (where?.userId) list = list.filter((p) => p.userId === where.userId);
        return list;
      },
      create: async ({ data }: any) => {
        const id = data.id || `port_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          userId: data.userId,
          address: data.address,
          label: data.label || 'Trading Wallet',
          createdAt: new Date(),
        };
        this.portfolioAddresses.set(id, record);
        return record;
      },
    };
  }

  get snipeRule() {
    return {
      findMany: async ({ where }: any = {}) => {
        let list = Array.from(this.snipeRules.values());
        if (where?.userId) list = list.filter((r) => r.userId === where.userId);
        if (where?.status) list = list.filter((r) => r.status === where.status);
        return list;
      },
      findUnique: async ({ where }: any) => {
        return this.snipeRules.get(where.id) || null;
      },
      create: async ({ data }: any) => {
        const id = data.id || `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          userId: data.userId,
          name: data.name || 'Pump.fun Snipe Alert',
          launchpad: data.launchpad || 'pump.fun',
          minLiquidityUsd: data.minLiquidityUsd ?? 5000,
          maxRiskScore: data.maxRiskScore ?? 40,
          maxDevHoldingPct: data.maxDevHoldingPct ?? 10,
          channel: data.channel || 'telegram',
          status: data.status || 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.snipeRules.set(id, record);
        return record;
      },
      delete: async ({ where }: any) => {
        const existing = this.snipeRules.get(where.id);
        this.snipeRules.delete(where.id);
        return existing || { id: where.id };
      },
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (const [id, r] of this.snipeRules.entries()) {
          if (!where?.id || r.id === where.id) {
            this.snipeRules.delete(id);
            count++;
          }
        }
        return { count };
      },
    };
  }

  get snipeTrigger() {
    return {
      findMany: async ({ where }: any = {}) => {
        let list = Array.from(this.snipeTriggers.values());
        if (where?.snipeRuleId) list = list.filter((t) => t.snipeRuleId === where.snipeRuleId);
        return list;
      },
      create: async ({ data }: any) => {
        const id = data.id || `trig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          snipeRuleId: data.snipeRuleId,
          mint: data.mint,
          symbol: data.symbol,
          name: data.name,
          price: data.price,
          mcap: data.mcap,
          liquidityUsd: data.liquidityUsd,
          riskScore: data.riskScore,
          deliveredAt: new Date(),
        };
        this.snipeTriggers.set(id, record);
        return record;
      },
    };
  }

  get systemCounter() {
    return {
      findMany: async () => Array.from(this.systemCounters.values()),
      upsert: async ({ where, update, create }: any) => {
        let existing = this.systemCounters.get(where.key);
        if (existing) {
          const inc = update.value?.increment ? BigInt(update.value.increment) : BigInt(0);
          existing.value = existing.value + inc;
          existing.updatedAt = new Date();
          return existing;
        } else {
          const record = {
            id: `cnt_${Date.now()}`,
            key: create.key,
            value: BigInt(create.value ?? 0),
            updatedAt: new Date(),
          };
          this.systemCounters.set(create.key, record);
          return record;
        }
      },
    };
  }

  async $queryRaw(strings: TemplateStringsArray, ...values: any[]): Promise<any[]> {
    return [{ locked: true }];
  }

  async $transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const txLocks: (() => void)[] = [];
    const txProxy = new Proxy(this, {
      get: (target: any, prop: string | symbol) => {
        if (prop === '$queryRaw') {
          return async (strings: TemplateStringsArray, ...values: any[]) => {
            const query = strings.join('?');
            if (query.includes('FOR UPDATE')) {
              const lockKey = values[0] ? String(values[0]) : 'global';
              const release = await target.acquireRowLock(lockKey, 2000);
              txLocks.push(release);
            }
            return [{ locked: true }];
          };
        }
        return target[prop];
      },
    });

    try {
      return await fn(txProxy);
    } finally {
      for (const release of txLocks) {
        release();
      }
    }
  }

  async $connect() {
    return true;
  }

  async $disconnect() {
    return true;
  }
}

export const inMemoryDb = new InMemoryDbAdapter();

let useRealPrisma = false;
let connectionChecked = false;

export async function checkPrismaConnection(): Promise<boolean> {
  if (connectionChecked) return useRealPrisma;
  try {
    await realPrisma.$connect();
    useRealPrisma = true;
    logger.info('Connected successfully to PostgreSQL database via Prisma');

    // Blocker 1: Ensure real data pipeline migration columns exist idempotently
    try {
      await realPrisma.$executeRawUnsafe(`
        ALTER TABLE "tokens" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
        ALTER TABLE "tokens" ADD COLUMN IF NOT EXISTS "price_history" JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE "token_snapshots" ADD COLUMN IF NOT EXISTS "top_holders" JSONB DEFAULT '[]'::jsonb;
      `);
      logger.info('Verified and ensured real data pipeline database columns (tokens.image_url, tokens.price_history, token_snapshots.top_holders).');
    } catch (migErr: any) {
      logger.warn('Non-fatal: Database column verification handled:', migErr.message);
    }
  } catch (err: any) {
    useRealPrisma = false;
    if (env.NODE_ENV === 'production') {
      logger.error('CRITICAL: Failed to connect to PostgreSQL in production:', err.message);
      process.exit(1);
    } else {
      logger.warn('PostgreSQL database not reachable. Operating with in-memory transactional database engine.');
    }
  }
  connectionChecked = true;
  return useRealPrisma;
}

// Proxied PrismaClient that routes to real PostgreSQL when active or in-memory adapter when offline
export const prisma: PrismaClient = new Proxy(realPrisma, {
  get(target: any, prop: string | symbol) {
    if (useRealPrisma && prop in target) {
      const value = target[prop];
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    }

    if (prop in inMemoryDb) {
      const value = (inMemoryDb as any)[prop];
      if (typeof value === 'function') {
        return value.bind(inMemoryDb);
      }
      return value;
    }

    const targetVal = target[prop];
    if (typeof targetVal === 'function') {
      return targetVal.bind(target);
    }
    return targetVal;
  },
}) as any;

/**
 * Row-level locking helpers for PostgreSQL $transaction:
 * Uses SELECT ... FOR UPDATE via tx.$queryRaw where Prisma lacks native record-level locks.
 */
export async function lockUserForUpdate(tx: any, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
}

export async function lockSubscriptionForUpdate(tx: any, subscriptionId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM subscriptions WHERE id = ${subscriptionId} FOR UPDATE`;
}

export async function lockReferralCreditForUpdate(tx: any, creditId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM referral_credits WHERE id = ${creditId} FOR UPDATE`;
}

export async function lockReferralForUpdate(tx: any, referralId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM referrals WHERE id = ${referralId} FOR UPDATE`;
}
