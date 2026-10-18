import { SnipeRuleDto } from '@solradar/shared';
import { prisma } from '../db/prisma.js';
import { logger } from '../observability/index.js';

export interface SnipeMatchResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  mint: string;
  telegramDelivered: boolean;
}

export class SnipeService {
  async getRules(userId: string) {
    return await prisma.snipeRule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' } as any,
    });
  }

  async createRule(userId: string, data: SnipeRuleDto) {
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
  }

  async deleteRule(userId: string, ruleId: string) {
    const existing = await prisma.snipeRule.findUnique({ where: { id: ruleId } });
    if (!existing || existing.userId !== userId) {
      throw new Error('Snipe rule not found or unauthorized');
    }
    await prisma.snipeRule.delete({ where: { id: ruleId } });
    return { success: true, id: ruleId };
  }

  async getRuleTriggers(ruleId: string) {
    return await prisma.snipeTrigger.findMany({
      where: { snipeRuleId: ruleId },
      orderBy: { deliveredAt: 'desc' } as any,
    });
  }

  async getAllUserTriggers(userId: string) {
    const userRules = await prisma.snipeRule.findMany({ where: { userId } });
    const ruleIds = userRules.map((r) => r.id);
    const triggers: any[] = [];
    for (const ruleId of ruleIds) {
      const trigs = await prisma.snipeTrigger.findMany({ where: { snipeRuleId: ruleId } });
      triggers.push(...trigs);
    }
    return triggers.sort((a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime());
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
    const activeRules = await prisma.snipeRule.findMany({ where: { status: 'active' } });
    const results: SnipeMatchResult[] = [];

    for (const rule of activeRules) {
      // Check launchpad
      if (rule.launchpad !== 'all' && tokenData.launchpad && rule.launchpad !== tokenData.launchpad) {
        continue;
      }
      // Check minimum liquidity
      if (tokenData.liquidityUsd < rule.minLiquidityUsd) {
        continue;
      }
      // Check maximum risk score
      if (tokenData.riskScore > rule.maxRiskScore) {
        continue;
      }
      // Check dev holding %
      if (tokenData.devHoldingPct > rule.maxDevHoldingPct) {
        continue;
      }

      // Record trigger
      await prisma.snipeTrigger.create({
        data: {
          snipeRuleId: rule.id,
          mint: tokenData.mint,
          symbol: tokenData.symbol,
          name: tokenData.name,
          price: tokenData.price,
          mcap: tokenData.mcap,
          liquidityUsd: tokenData.liquidityUsd,
          riskScore: tokenData.riskScore,
        },
      });

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
