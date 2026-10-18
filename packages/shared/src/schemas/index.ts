import { z } from 'zod';
import { PlanCode } from '../constants/index.js';

// Auth Schemas
export const SignupDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  referralCode: z.string().optional(),
});
export type SignupDto = z.infer<typeof SignupDtoSchema>;

export const LoginDtoSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
export type LoginDto = z.infer<typeof LoginDtoSchema>;

export const TelegramLinkDtoSchema = z.object({
  initData: z.string().min(1, 'Telegram initData required'),
});
export type TelegramLinkDto = z.infer<typeof TelegramLinkDtoSchema>;

// Billing Schemas
export const CreateCheckoutDtoSchema = z.object({
  planCode: z.enum([PlanCode.SCOUT, PlanCode.HUNTER]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
export type CreateCheckoutDto = z.infer<typeof CreateCheckoutDtoSchema>;

export const CancelSubscriptionDtoSchema = z.object({
  immediate: z.boolean().default(false),
});
export type CancelSubscriptionDto = z.infer<typeof CancelSubscriptionDtoSchema>;

export const WebhookPayloadDtoSchema = z.object({
  id: z.string(),
  type: z.string(),
  created: z.number().optional(),
  data: z.record(z.any()),
});
export type WebhookPayloadDto = z.infer<typeof WebhookPayloadDtoSchema>;

// Token & Discovery Screener Schemas
export const TokenQueryDtoSchema = z.object({
  stage: z.enum(['all', 'new', 'curve', 'migrated']).default('all'),
  sortBy: z.enum(['volume_5m', 'volume_1h', 'volume_24h', 'liquidity_usd', 'mcap', 'risk_score', 'first_seen_at']).default('volume_5m'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  minMcap: z.coerce.number().optional(),
  maxMcap: z.coerce.number().optional(),
  minLiquidity: z.coerce.number().optional(),
  maxRiskScore: z.coerce.number().optional(),
  mintAuthRevokedOnly: z.coerce.boolean().optional(),
  freezeAuthRevokedOnly: z.coerce.boolean().optional(),
  lpBurnedOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
});
export type TokenQueryDto = z.infer<typeof TokenQueryDtoSchema>;

export const TokenSnapshotDtoSchema = z.object({
  mint: z.string().min(32).max(44),
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  decimals: z.number().int().min(0).max(18).default(6),
  creator: z.string().min(32).max(44).nullable().optional(),
  priceUsd: z.number().nonnegative(),
  mcapUsd: z.number().nonnegative(),
  liquidityUsd: z.number().nonnegative(),
  volume5m: z.number().nonnegative().default(0),
  volume1h: z.number().nonnegative().default(0),
  volume24h: z.number().nonnegative().default(0),
  buys5m: z.number().int().nonnegative().default(0),
  sells5m: z.number().int().nonnegative().default(0),
  holderCount: z.number().int().nonnegative().default(0),
  top10Pct: z.number().min(0).max(100).default(0),
  devHoldingPct: z.number().min(0).max(100).default(0),
  mintAuthorityRevoked: z.boolean().default(false),
  freezeAuthorityRevoked: z.boolean().default(false),
  lpBurnedOrLockedPct: z.number().min(0).max(100).default(0),
  stage: z.enum(['new', 'curve', 'migrated']).default('new'),
});
export type TokenSnapshotDto = z.infer<typeof TokenSnapshotDtoSchema>;

// Tracked Wallet Schemas
export const TrackWalletDtoSchema = z.object({
  address: z.string().min(32).max(44, 'Invalid Solana address format'),
  label: z.string().max(50).optional().default('Smart Trader'),
});
export type TrackWalletDto = z.infer<typeof TrackWalletDtoSchema>;

// Portfolio Address Schemas
export const PortfolioAddressDtoSchema = z.object({
  address: z.string().min(32).max(44, 'Invalid Solana address format'),
  label: z.string().max(50).optional().default('Trading Wallet'),
});
export type PortfolioAddressDto = z.infer<typeof PortfolioAddressDtoSchema>;

// Watchlist Schemas
export const WatchlistDtoSchema = z.object({
  mint: z.string().min(32).max(44),
  notifyOnLaunch: z.boolean().default(true),
  notifyOnSpike: z.boolean().default(true),
  notifyOnWhale: z.boolean().default(true),
  whaleThresholdUsd: z.number().nonnegative().default(2000),
});
export type WatchlistDto = z.infer<typeof WatchlistDtoSchema>;

// X / Channel Monitor Schemas
export const ChannelMonitorDtoSchema = z.object({
  channelName: z.string().min(1),
  channelType: z.enum(['telegram', 'twitter']),
  active: z.boolean().default(true),
});
export type ChannelMonitorDto = z.infer<typeof ChannelMonitorDtoSchema>;

// Snipe Alerts Schemas (Signals-Only)
export const SnipeRuleDtoSchema = z.object({
  name: z.string().min(1).max(50).default('Pump.fun Snipe Alert'),
  launchpad: z.enum(['all', 'pump.fun', 'raydium']).default('pump.fun'),
  minLiquidityUsd: z.coerce.number().min(0).default(5000),
  maxRiskScore: z.coerce.number().min(0).max(100).default(40),
  maxDevHoldingPct: z.coerce.number().min(0).max(100).default(10),
  channel: z.enum(['telegram', 'app', 'both']).default('telegram'),
});
export type SnipeRuleDto = z.infer<typeof SnipeRuleDtoSchema>;

// Telegram Login Auth Schema
export const TelegramAuthDtoSchema = z.object({
  id: z.coerce.number(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.coerce.number(),
  hash: z.string(),
});
export type TelegramAuthDto = z.infer<typeof TelegramAuthDtoSchema>;

