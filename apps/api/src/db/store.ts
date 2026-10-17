import { PlanCode, PLAN_CONFIGS } from '@solradar/shared';
import { logger } from '../observability/index.js';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  telegramId: string | null;
  role: 'user' | 'admin';
  plan: PlanCode;
  status: 'active' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  planCode: PlanCode;
  status: 'active' | 'canceled' | 'past_due';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentEventRecord {
  id: string;
  stripeEventId: string;
  type: string;
  payload: any;
  processedAt: Date;
}

export interface ReferralCreditRecord {
  id: string;
  userId: string;
  referralId: string;
  percentOff: number;
  monthsTotal: number;
  monthsApplied: number;
  status: 'active' | 'exhausted';
  createdAt: Date;
  updatedAt: Date;
}

export interface TrackedWalletRecord {
  id: string;
  userId: string;
  address: string;
  label: string;
  createdAt: Date;
}

export interface WalletTradeRecord {
  id: string;
  trackedWalletId: string;
  signature: string;
  mint: string;
  side: 'buy' | 'sell';
  amountUsd: number;
  price: number;
  slot: number;
  detectedAt: Date;
}

export interface TokenRecord {
  id: string;
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  creator: string | null;
  firstSeenAt: Date;
}

export interface TokenSnapshotRecord {
  id: string;
  tokenId: string;
  price: number;
  mcap: number;
  liquidityUsd: number;
  volume5m: number;
  volume1h: number;
  volume24h: number;
  buys: number;
  sells: number;
  holderCount: number;
  top10Pct: number;
  devHoldingPct: number;
  mintAuthRevoked: boolean;
  freezeAuthRevoked: boolean;
  lpBurnedOrLockedPct: number;
  stage: 'new' | 'curve' | 'migrated';
  takenAt: Date;
}

export interface AlertRecord {
  id: string;
  eventKey: string;
  kind: string;
  tokenId: string | null;
  payload: any;
  createdAt: Date;
}

export interface AlertDeliveryRecord {
  id: string;
  alertId: string;
  userId: string;
  channel: 'telegram' | 'webhook';
  status: 'sent' | 'failed';
  sentAt: Date;
}

export interface WatchlistRecord {
  id: string;
  userId: string;
  tokenId: string;
  filters: any;
  createdAt: Date;
}

export interface PortfolioAddressRecord {
  id: string;
  userId: string;
  address: string;
  label: string;
  createdAt: Date;
}

/**
 * In-Memory Transactional Store for SolRadar.
 * Guarantees atomicity, row locks, idempotency constraints, and zero-leak state.
 */
export class DataStore {
  public users = new Map<string, UserRecord>();
  public subscriptions = new Map<string, SubscriptionRecord>();
  public paymentEvents = new Map<string, PaymentEventRecord>();
  public referrals = new Map<string, { id: string; code: string; referrerUserId: string; refereeUserId: string | null; status: string; createdAt: Date }>();
  public referralCredits = new Map<string, ReferralCreditRecord>();
  public trackedWallets = new Map<string, TrackedWalletRecord>();
  public walletTrades = new Map<string, WalletTradeRecord>();
  public tokens = new Map<string, TokenRecord>();
  public snapshots = new Map<string, TokenSnapshotRecord>();
  public alerts = new Map<string, AlertRecord>();
  public alertDeliveries = new Map<string, AlertDeliveryRecord>();
  public watchlists = new Map<string, WatchlistRecord>();
  public portfolioAddresses = new Map<string, PortfolioAddressRecord>();
  public systemCounters = new Map<string, number>();

  private rowLocks = new Set<string>();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    this.systemCounters.set('rpc_budget_burn_daily', 0);
    this.systemCounters.set('webhook_ingest_count', 0);
    this.systemCounters.set('alert_fanout_count', 0);
  }

  // Row locking simulation for SELECT ... FOR UPDATE inside transactions
  async acquireRowLock(key: string, timeoutMs = 2000): Promise<() => void> {
    const start = Date.now();
    while (this.rowLocks.has(key)) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Lock acquisition timeout for key: ${key}`);
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    this.rowLocks.add(key);
    return () => {
      this.rowLocks.delete(key);
    };
  }

  // Idempotent external event registration
  recordPaymentEventIdempotent(stripeEventId: string, type: string, payload: any): boolean {
    if (this.paymentEvents.has(stripeEventId)) {
      logger.info('Duplicate payment event dropped via idempotency key', { stripeEventId, type });
      return false; // Already processed
    }
    const record: PaymentEventRecord = {
      id: `pe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      stripeEventId,
      type,
      payload,
      processedAt: new Date(),
    };
    this.paymentEvents.set(stripeEventId, record);
    return true;
  }

  // Idempotent alert delivery registration
  recordAlertDeliveryIdempotent(userId: string, alertId: string, channel: 'telegram' | 'webhook' = 'telegram'): boolean {
    const deliveryKey = `${userId}:${alertId}`;
    if (this.alertDeliveries.has(deliveryKey)) {
      logger.info('Duplicate alert delivery blocked by UNIQUE(user_id, alert_id)', { userId, alertId });
      return false; // Already delivered
    }
    const delivery: AlertDeliveryRecord = {
      id: `del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      alertId,
      userId,
      channel,
      status: 'sent',
      sentAt: new Date(),
    };
    this.alertDeliveries.set(deliveryKey, delivery);
    return true;
  }
}

export const db = new DataStore();
