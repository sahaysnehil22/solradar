export const APP_NAME = 'SolRadar';
export const APP_DESCRIPTION = 'Real-time Solana Memecoin Intelligence Terminal & Signal Platform';

export enum PlanCode {
  FREE = 'free',
  SCOUT = 'scout',
  HUNTER = 'hunter',
}

export interface PlanConfig {
  code: PlanCode;
  name: string;
  priceCentsMonthly: number;
  maxTrackedWallets: number;
  maxWatchlistTokens: number;
  instantPriorityAlerts: boolean;
  copyTradeSignals: boolean;
  portfolioTracking: boolean;
  xMonitoring: boolean;
  apiLiteWebhooks: boolean;
  telegramRateLimitPerMin: number;
}

export const PLAN_CONFIGS: Record<PlanCode, PlanConfig> = {
  [PlanCode.FREE]: {
    code: PlanCode.FREE,
    name: 'Free Demo',
    priceCentsMonthly: 0,
    maxTrackedWallets: 1, // Allow 1 wallet for evaluation as indicated in web UI (0/1 used)
    maxWatchlistTokens: 3,
    instantPriorityAlerts: false,
    copyTradeSignals: false,
    portfolioTracking: false,
    xMonitoring: false,
    apiLiteWebhooks: false,
    telegramRateLimitPerMin: 5,
  },
  [PlanCode.SCOUT]: {
    code: PlanCode.SCOUT,
    name: 'Scout',
    priceCentsMonthly: 5000, // $50/mo
    maxTrackedWallets: 3,
    maxWatchlistTokens: 25,
    instantPriorityAlerts: false,
    copyTradeSignals: false,
    portfolioTracking: false,
    xMonitoring: false,
    apiLiteWebhooks: false,
    telegramRateLimitPerMin: 15,
  },
  [PlanCode.HUNTER]: {
    code: PlanCode.HUNTER,
    name: 'Hunter',
    priceCentsMonthly: 10000, // $100/mo
    maxTrackedWallets: 10,
    maxWatchlistTokens: 1000, // Unlimited watchlist
    instantPriorityAlerts: true,
    copyTradeSignals: true,
    portfolioTracking: true,
    xMonitoring: true,
    apiLiteWebhooks: true,
    telegramRateLimitPerMin: 20,
  },
};

export const REFERRAL_DISCOUNT = {
  percentOff: 20,
  monthsDuration: 3,
};

export const TELEGRAM_GLOBAL_BURST_LIMIT_PER_MIN = 3000;
export const TELEGRAM_USER_RATE_LIMIT_PER_MIN = 20;

export const RISK_THRESHOLDS = {
  HIGH_RISK_CUTOFF: 70,
  MODERATE_RISK_CUTOFF: 40,
  TOP10_CONCENTRATION_DANGER_PCT: 40,
  TOP10_CONCENTRATION_EXTREME_PCT: 60,
  DEV_HOLDING_DANGER_PCT: 5,
  MIN_SAFE_LIQUIDITY_USD: 10000,
};

export const TELEGRAM_BOT_USERNAME = 'solaanaaradarbot';
export const TELEGRAM_BOT_ID = '8943169326';
export const TELEGRAM_BOT_URL = 'https://t.me/solaanaaradarbot';

