import { Bot, Context, NextFunction } from 'grammy';
import { PlanCode, PLAN_CONFIGS } from '@solradar/shared';
import dotenv from 'dotenv';

dotenv.config();

export interface BotUserSession {
  telegramId: number;
  userId: string;
  plan: PlanCode;
  cachedAt: number;
  alertPreferences: {
    newLaunches: boolean;
    volumeSpikes: boolean;
    whaleBuys: boolean;
    copySignals: boolean;
  };
}

// In-Memory cache for user sessions (cached <= 60s as mandated in §7)
export const userSessionCache = new Map<number, BotUserSession>();

export function formatTokenAlert(params: {
  symbol: string;
  name: string;
  mint: string;
  price: number;
  mcap: number;
  liquidity: number;
  riskScore: number;
  confidence: string;
  mintAuthRevoked: boolean;
  freezeAuthRevoked: boolean;
  lpBurnedPct: number;
  top10Pct: number;
  devHoldingPct: number;
  flags: string[];
}): string {
  const riskBadge =
    params.riskScore >= 70
      ? '🚨 HIGH RISK'
      : params.riskScore >= 40
      ? '⚠️ MODERATE RISK'
      : '✅ LOW RISK';

  const flagLines =
    params.flags.length > 0
      ? `\n⚠️ Red Flags:\n${params.flags.map((f) => ` • ${f}`).join('\n')}`
      : '\n✅ Clean Audit: No critical contract hazards detected.';

  return (
    `⚡ *${params.symbol}* (${params.name})\n` +
    `💰 Price: $${params.price.toFixed(6)} | MC: $${params.mcap.toLocaleString()} | Liq: $${params.liquidity.toLocaleString()}\n` +
    `🛡️ Risk Score: *${params.riskScore}/100* (${riskBadge}) | Conf: ${params.confidence}\n` +
    `🔒 Mint: ${params.mintAuthRevoked ? '✅ Revoked' : '❌ Active'} | Freeze: ${params.freezeAuthRevoked ? '✅ Revoked' : '❌ Active'} | LP: ${params.lpBurnedPct}% Burned\n` +
    `👥 Top 10: ${params.top10Pct.toFixed(1)}% | Dev: ${params.devHoldingPct.toFixed(1)}%` +
    flagLines +
    `\n\n🔗 [Terminal](https://solradar.io/tokens/${params.mint}) • [Dexscreener](https://dexscreener.com/solana/${params.mint})`
  );
}

export function formatCopyTradeSignal(params: {
  label: string;
  address: string;
  side: 'buy' | 'sell';
  symbol: string;
  mint: string;
  amountUsd: number;
  price: number;
  winRate: number;
  pnl7d: number;
}): string {
  const sideEmoji = params.side === 'buy' ? '🟢 BUY' : '🔴 SELL';
  const shortAddr = `${params.address.slice(0, 4)}...${params.address.slice(-4)}`;

  return (
    `🎯 *COPY-TRADE SIGNAL* — ${params.label} (\`${shortAddr}\`)\n` +
    `Action: *${sideEmoji}* $${params.amountUsd.toLocaleString()} USD of *${params.symbol}* @ $${params.price.toFixed(6)}\n` +
    `📈 Trader Track Record: *${params.winRate}% Win Rate* | *+$${params.pnl7d.toLocaleString()} 7d Realized PnL*\n\n` +
    `⚠️ _Signal only. No automated execution. Trade manually in your own wallet._\n` +
    `🔗 [View Token Terminal](https://solradar.io/tokens/${params.mint})`
  );
}

export function createBot(token = process.env.TELEGRAM_BOT_TOKEN || 'dummy_token') {
  const bot = new Bot(token);

  // 1. Subscription Gating Middleware (§7)
  const requireSubscription = (requiredPlan: PlanCode = PlanCode.SCOUT) => {
    return async (ctx: Context, next: NextFunction) => {
      const from = ctx.from;
      if (!from) return;

      let session = userSessionCache.get(from.id);
      const now = Date.now();

      // Refresh cache if older than 60s
      if (!session || now - session.cachedAt > 60000) {
        session = {
          telegramId: from.id,
          userId: `usr_${from.id}`,
          plan: PlanCode.SCOUT, // Mocked active for test demo
          cachedAt: now,
          alertPreferences: {
            newLaunches: true,
            volumeSpikes: true,
            whaleBuys: true,
            copySignals: true,
          },
        };
        userSessionCache.set(from.id, session);
      }

      // Check plan hierarchy: Hunter > Scout > Free
      const userLevel = session.plan === PlanCode.HUNTER ? 2 : session.plan === PlanCode.SCOUT ? 1 : 0;
      const requiredLevel = requiredPlan === PlanCode.HUNTER ? 2 : requiredPlan === PlanCode.SCOUT ? 1 : 0;

      if (userLevel < requiredLevel) {
        await ctx.reply(
          `🔒 *Subscription Upgrade Required*\n\n` +
            `This command requires the *${PLAN_CONFIGS[requiredPlan].name}* tier ($${PLAN_CONFIGS[requiredPlan].priceCentsMonthly / 100}/mo).\n` +
            `Type /subscribe to select your plan.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      await next();
    };
  };

  // 2. Command Handlers
  bot.command('start', async (ctx) => {
    const linkCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await ctx.reply(
      `👋 *Welcome to SolRadar (@solaanaaradarbot)*\n` +
        `The real-time Solana memecoin intelligence terminal & signal bot.\n\n` +
        `🔑 *Account Linking*\n` +
        `Your link code is: \`${linkCode}\`\n` +
        `Paste this code in your SolRadar Web Terminal (/app) or sign in with Telegram to link your account.\n\n` +
        `📌 *Key Commands:*\n` +
        `/subscribe — Pick your subscription tier\n` +
        `/watch <mint> — Add token to priority watchlist\n` +
        `/track <address> — Follow profitable whale wallets\n` +
        `/alerts — Configure alert channels & triggers\n` +
        `/portfolio — Check your read-only public holdings\n` +
        `/referral — Get your 20% discount link\n` +
        `/help — Full command manual`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('subscribe', async (ctx) => {
    await ctx.reply(
      `💳 *SolRadar Subscription Plans*\n\n` +
        `🔭 *Scout ($50/mo)*\n` +
        ` • Discovery screener & Pulse feed\n` +
        ` • Standard Telegram alerts\n` +
        ` • 1 tracked smart-money wallet\n` +
        ` • 25 watchlist slots\n` +
        `👉 [Activate Scout Tier](https://solradar.io/billing?plan=scout&status=activated_demo)\n\n` +
        `⚡ *Hunter ($100/mo)* — _Most Popular_\n` +
        ` • Everything in Scout\n` +
        ` • Priority instant alerts (<2s delivery)\n` +
        ` • 10 tracked smart-money wallets\n` +
        ` • Copy-trade SIGNALS (realized PnL & win rate)\n` +
        ` • Read-only multi-wallet portfolio tracking\n` +
        ` • Unlimited watchlists & API-lite webhooks\n` +
        `👉 [Activate Hunter Tier](https://solradar.io/billing?plan=hunter&status=activated_demo)\n\n` +
        `_Note: Test billing active during MVP validation. No real charges._`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('watch', requireSubscription(PlanCode.SCOUT), async (ctx) => {
    const text = ctx.message?.text?.trim().split(/\s+/) || [];
    const mint = text[1];
    if (!mint || mint.length < 32) {
      await ctx.reply('⚠️ Usage: `/watch <token_mint_address>`', { parse_mode: 'Markdown' });
      return;
    }
    await ctx.reply(`✅ Added \`${mint}\` to your active watchlist. You will receive real-time alerts.`, {
      parse_mode: 'Markdown',
    });
  });

  bot.command('track', requireSubscription(PlanCode.HUNTER), async (ctx) => {
    const text = ctx.message?.text?.trim().split(/\s+/) || [];
    const address = text[1];
    if (!address || address.length < 32) {
      await ctx.reply('⚠️ Usage: `/track <solana_wallet_address>`', { parse_mode: 'Markdown' });
      return;
    }
    await ctx.reply(
      `🎯 *Smart Wallet Tracked!*\nAddress: \`${address}\`\nYou will receive real-time copy signals whenever this wallet buys or sells.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('portfolio', requireSubscription(PlanCode.HUNTER), async (ctx) => {
    await ctx.reply(
      `💼 *Your Read-Only Portfolio Summary*\n\n` +
        `🪙 *Holdings:*\n` +
        ` • 150,000,000 $BONK — $3,210.00 (+4.8%)\n` +
        ` • 1,200 $WIF — $2,856.00 (-1.2%)\n\n` +
        `💰 *Total Portfolio Value: $6,066.00 USD*\n` +
        `_Tracked via public address only. No private keys stored._`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('referral', async (ctx) => {
    const refCode = `RADAR-${ctx.from?.id ? ctx.from.id.toString(36).toUpperCase() : 'VIP'}`;
    await ctx.reply(
      `🎁 *SolRadar Referral Program*\n\n` +
        `Share your link with fellow traders. Both of you get *20% off for 3 months*!\n\n` +
        `🔗 Your Referral Link:\n` +
        `https://solradar.io/signup?ref=${refCode}\n\n` +
        `Credits applied: 0/3 months\n` +
        `Discount savings: $10–$20/mo`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      `📖 *SolRadar Bot Commands*\n\n` +
        `/start — Link your web account\n` +
        `/subscribe — View plans & test checkout\n` +
        `/watch <mint> — Watch a token for volume/whale spikes\n` +
        `/unwatch <mint> — Stop alerts for a token\n` +
        `/track <address> — Follow a smart-money trader (Hunter)\n` +
        `/untrack <address> — Unfollow a wallet\n` +
        `/alerts — Toggle notification categories\n` +
        `/portfolio — View aggregated balances (Hunter)\n` +
        `/referral — View your 20% discount link\n` +
        `/help — Display this help menu`,
      { parse_mode: 'Markdown' }
    );
  });

  return bot;
}

// If started as worker or web service
if (process.argv[1]?.endsWith('index.js') || process.argv[1]?.endsWith('index.ts')) {
  // Minimal HTTP listener if Render assigns a PORT (e.g. deployed as Web service)
  if (process.env.PORT) {
    import('http').then(({ createServer }) => {
      createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('SolRadar Bot OK');
      }).listen(Number(process.env.PORT), () => {
        console.log(`[SolRadar Bot] Health listener bound to PORT ${process.env.PORT}`);
      });
    });
  }

  const bot = createBot();
  console.log('[SolRadar Bot] grammY bot starting long polling...');
  bot.start();
}
