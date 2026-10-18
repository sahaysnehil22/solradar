import crypto from 'crypto';
import { REFERRAL_DISCOUNT } from '@solradar/shared';
import { prisma, lockReferralForUpdate } from '../db/prisma.js';

export class ReferralsService {
  async getOrCreateReferralCode(userId: string): Promise<string> {
    const existing = await prisma.referral.findFirst({
      where: { referrerUserId: userId },
    });
    if (existing) {
      return existing.code;
    }

    const code = `RADAR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    await prisma.referral.create({
      data: {
        code,
        referrerUserId: userId,
        refereeUserId: null,
        status: 'pending',
      },
    });

    return code;
  }

  async applyReferralAtSignup(refereeUserId: string, referralCode: string) {
    return await prisma.$transaction(async (tx) => {
      const referral = await tx.referral.findUnique({ where: { code: referralCode } });
      if (!referral) return null;
      if (referral.referrerUserId === refereeUserId) return null; // Cannot refer self

      // Row-level lock on the referral record to prevent double-claiming
      await lockReferralForUpdate(tx, referral.id);

      await tx.referral.update({
        where: { id: referral.id },
        data: {
          refereeUserId,
          status: 'applied',
        },
      });

      // 1. Grant referee 20% off for 3 months
      await tx.referralCredit.create({
        data: {
          userId: refereeUserId,
          referralId: referral.id,
          percentOff: REFERRAL_DISCOUNT.percentOff,
          monthsTotal: REFERRAL_DISCOUNT.monthsDuration,
          monthsApplied: 0,
          status: 'active',
        },
      });

      // 2. Grant referrer 20% off for 3 months
      await tx.referralCredit.create({
        data: {
          userId: referral.referrerUserId,
          referralId: referral.id,
          percentOff: REFERRAL_DISCOUNT.percentOff,
          monthsTotal: REFERRAL_DISCOUNT.monthsDuration,
          monthsApplied: 0,
          status: 'active',
        },
      });

      return { success: true, referrerUserId: referral.referrerUserId, refereeUserId };
    });
  }

  async getUserReferralStats(userId: string) {
    const referrals = await prisma.referral.findMany({ where: { referrerUserId: userId } });
    const credits = await prisma.referralCredit.findMany({ where: { userId, status: 'active' } });

    const totalDiscount = credits.length > 0 ? Math.min(credits.length * REFERRAL_DISCOUNT.percentOff, 100) : 0;
    const estimatedSavings = Number(((totalDiscount / 100) * 50).toFixed(2));

    return {
      totalReferrals: referrals.length,
      activeCredits: credits,
      effectiveDiscountPercent: totalDiscount,
      percentOff: REFERRAL_DISCOUNT.percentOff,
      monthsRemaining: credits.reduce((acc: number, c: any) => acc + (c.monthsTotal - c.monthsApplied), 0),
      estimatedSavingsUsd: estimatedSavings,
    };
  }
}

export const referralsService = new ReferralsService();
