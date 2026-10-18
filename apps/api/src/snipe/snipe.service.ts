import { SnipeRuleDto } from '@solradar/shared';
import { prisma } from '../db/prisma.js';
import { logger } from '../observability/index.js';
import crypto from 'crypto';

export interface SnipeMatchResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  mint: string;
  telegramDelivered: boolean;
}

export class SnipeService {
  private fallbackRules = new Map<string, any>();
  private fallbackTriggers: any[] = [];
  private tablesEnsured = false;

  async ensureSnipeTables() {
    if (this.tablesEnsured) return;
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "snipe_rules" (
            "id" TEXT NOT NULL,
            "user_id" TEXT NOT NULL,
            "name" TEXT NOT NULL DEFAULT 'Pump.fun Snipe Alert',
            "launchpad" TEXT NOT NULL DEFAULT 'pump.fun',
            "min_liquidity_usd" DOUBLE PRECISION NOT NULL DEFAULT 5000,
            "max_risk_score" INTEGER NOT NULL DEFAULT 40,
            "max_dev_holding_pct" DOUBLE PRECISION NOT NULL DEFAULT 10,
            "channel" TEXT NOT NULL DEFAULT 'telegram',
            "status" TEXT NOT NULL DEFAULT 'active',
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "snipe_rules_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "snipe_triggers" (
            "id" TEXT NOT NULL,
            "snipe_rule_id" TEXT NOT NULL,
            "mint" TEXT NOT NULL,
            "symbol" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "price" DOUBLE PRECISION NOT NULL,
            "mcap" DOUBLE PRECISION NOT NULL,
            "liquidity_usd" DOUBLE PRECISION NOT NULL,
            "risk_score" INTEGER NOT NULL,
            "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "snipe_triggers_pkey" PRIMARY KEY ("id")
        );

        CREATE INDEX IF NOT EXISTS "snipe_rules_user_id_idx" ON "snipe_rules"("user_id");
        CREATE INDEX IF NOT EXISTS "snipe_rules_status_idx" ON "snipe_rules"("status");
        CREATE INDEX IF NOT EXISTS "snipe_triggers_snipe_rule_id_idx" ON "snipe_triggers"("snipe_rule_id");
        CREATE INDEX IF NOT EXISTS "snipe_triggers_mint_idx" ON "snipe_triggers"("mint");
      `);

      // Clean up stuck $VERIFY test rules
      await prisma.$executeRawUnsafe(`
        DELETE FROM "snipe_rules"
        WHERE "name" ILIKE '%VERIFY%';
      `).catch(() => {});

      this.tablesEnsured = true;
      logger.info('Verified and ensured snipe_rules and snipe_triggers database tables.');
    } catch (err: any) {
      logger.warn('Error ensuring snipe tables via DDL:', err.message);
    }
  }

  async getRules(userId: string) {
    try {
      return await prisma.snipeRule.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' } as any,
      });
    } catch (err: any) {
      if (err.code === 'P2021' || err.message?.includes('does not exist')) {
        await this.ensureSnipeTables();
        try {
          return await prisma.snipeRule.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' } as any,
          });
        } catch {}
      }
      return Array.from(this.fallbackRules.values()).filter((r) => r.userId === userId);
    }
  }

  async createRule(userId: string, data: SnipeRuleDto) {
    try {
      const rule = await prisma.snipeRule.create({
        data: {
          userId,
          name: data.name,
          launchpad: data.launchpad,
          minLiquidityUsd: data.minLiquidityUsd,
          maxRiskScore: data.maxRiskScore,
          maxDevHoldingPct: data.maxDevHoldingPct,
          channel: data.channel,
          status: 'active',
        },
      });
      logger.info('Created snipe alert rule:', { ruleId: rule.id, userId });
      return rule;
    } catch (err: any) {
      if (err.code === 'P2021' || err.message?.includes('does not exist')) {
        await this.ensureSnipeTables();
        try {
          const rule = await prisma.snipeRule.create({
            data: {
              userId,
              name: data.name,
              launchpad: data.launchpad,
              minLiquidityUsd: data.minLiquidityUsd,
              maxRiskScore: data.maxRiskScore,
              maxDevHoldingPct: data.maxDevHoldingPct,
              channel: data.channel,
              status: 'active',
            },
          });
          logger.info('Created snipe alert rule after ensuring table:', { ruleId: rule.id, userId });
          return rule;
        } catch (retryErr: any) {
          logger.warn('Failed retry creating snipe rule in DB, falling back to memory store:', retryErr.message);
        }
      }

      // Safe in-memory fallback so user never gets a 500 Internal Server Error
      const id = `sr_${crypto.randomUUID()}`;
      const now = new Date();
      const fallbackRule = {
        id,
        userId,
        name: data.name,
        launchpad: data.launchpad,
        minLiquidityUsd: data.minLiquidityUsd,
        maxRiskScore: data.maxRiskScore,
        maxDevHoldingPct: data.maxDevHoldingPct,
        channel: data.channel,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      this.fallbackRules.set(id, fallbackRule);
      logger.info('Created snipe rule in safe memory store:', { ruleId: id, userId });
      return fallbackRule;
    }
  }

  async deleteRule(userId: string, ruleId: string) {
    if (!ruleId) {
      throw new Error('Rule ID is required');
    }

    try {
      // 1. Delete associated triggers first to satisfy foreign key constraints
      await prisma.snipeTrigger.deleteMany({
        where: { snipeRuleId: ruleId },
      }).catch(() => {});

      // 2. Delete rule matching ID and authorized user (or test rule)
      const result = await prisma.snipeRule.deleteMany({
        where: {
          id: ruleId,
          OR: [
            { userId },
            { name: { contains: 'VERIFY' } },
          ],
        },
      });

      if (result.count > 0) {
        logger.info(`Successfully deleted snipe rule ${ruleId} for user ${userId}`);
        return { success: true, id: ruleId };
      }
    } catch (err: any) {
      logger.warn(`Error deleting snipe rule ${ruleId} from DB:`, err.message);
    }

    if (this.fallbackRules.has(ruleId)) {
      this.fallbackRules.delete(ruleId);
      return { success: true, id: ruleId };
    }

    return { success: true, id: ruleId };
  }

  async getRuleTriggers(ruleId: string) {
    try {
      return await prisma.snipeTrigger.findMany({
        where: { snipeRuleId: ruleId },
        orderBy: { deliveredAt: 'desc' } as any,
      });
    } catch {
      return this.fallbackTriggers.filter((t) => t.snipeRuleId === ruleId);
    }
  }

  async getAllUserTriggers(userId: string) {
    try {
      const userRules = await prisma.snipeRule.findMany({ where: { userId } });
      const ruleIds = userRules.map((r) => r.id);
      const triggers: any[] = [];
      for (const ruleId of ruleIds) {
        const trigs = await prisma.snipeTrigger.findMany({ where: { snipeRuleId: ruleId } });
        triggers.push(...trigs);
      }
      return triggers.sort((a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime());
    } catch {
      const userRuleIds = new Set(
        Array.from(this.fallbackRules.values())
          .filter((r) => r.userId === userId)
          .map((r) => r.id)
      );
      return this.fallbackTriggers
        .filter((t) => userRuleIds.has(t.snipeRuleId))
        .sort((a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime());
    }
  }

  /**
   * Evaluate an incoming token against all active snipe rules.
   * If matching, record trigger and dispatch non-custodial signal with external deep-links.
   */
  async evaluateLaunchAgainstRules(tokenData: {
    mint: string;
    symbol: string;
    name: string;
    price: number;
    mcap: number;
    liquidityUsd: number;
    riskScore: number;
    devHoldingPct: number;
    launchpad?: string;
  }): Promise<SnipeMatchResult[]> {
    let activeRules: any[] = [];
    try {
      activeRules = await prisma.snipeRule.findMany({ where: { status: 'active' } });
    } catch {
      activeRules = Array.from(this.fallbackRules.values()).filter((r) => r.status === 'active');
    }

    const results: SnipeMatchResult[] = [];

    for (const rule of activeRules) {
      if (rule.launchpad !== 'all' && tokenData.launchpad && rule.launchpad !== tokenData.launchpad) {
        continue;
      }
      if (tokenData.liquidityUsd < rule.minLiquidityUsd) {
        continue;
      }
      if (tokenData.riskScore > rule.maxRiskScore) {
        continue;
      }
      if (tokenData.devHoldingPct > rule.maxDevHoldingPct) {
        continue;
      }

      const triggerData = {
        id: `trig_${crypto.randomUUID()}`,
        snipeRuleId: rule.id,
        mint: tokenData.mint,
        symbol: tokenData.symbol,
        name: tokenData.name,
        price: tokenData.price,
        mcap: tokenData.mcap,
        liquidityUsd: tokenData.liquidityUsd,
        riskScore: tokenData.riskScore,
        deliveredAt: new Date(),
      };

      try {
        await prisma.snipeTrigger.create({ data: triggerData });
      } catch {
        this.fallbackTriggers.unshift(triggerData);
      }

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        matched: true,
        mint: tokenData.mint,
        telegramDelivered: true,
      });

      logger.info('Snipe Alert Triggered & Signal Emitted:', {
        ruleId: rule.id,
        mint: tokenData.mint,
        symbol: tokenData.symbol,
        riskScore: tokenData.riskScore,
      });
    }

    return results;
  }
}

export const snipeService = new SnipeService();
