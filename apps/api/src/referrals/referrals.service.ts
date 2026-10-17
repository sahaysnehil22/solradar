import crypto from 'crypto';
import { REFERRAL_DISCOUNT } from '@solradar/shared';
import { db, ReferralCreditRecord } from '../db/store.js';

export class ReferralsService {
  async getOrCreateReferralCode(userId: string): Promise<string> {
    for (const ref of db.referrals.values()) {
      if (ref.referrerUserId === userId) {
        return ref.code;
      }
    }

    const code = `RADAR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const referral = {
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code,
      referrerUserId: userId,
      refereeUserId: null,
      status: 'pending',
      createdAt: new Date(),
    };
    db.referrals.set(code, referral);

    return code;
  }

  async applyReferralAtSignup(refereeUserId: string, referralCode: string) {
    const referral = db.referrals.get(referralCode);
    if (!referral) return null;
    if (referral.referrerUserId === refereeUserId) return null; // Cannot refer self

    const releaseLock = await db.acquireRowLock(`referral:${referral.id}`);
    try {
      referral.refereeUserId = refereeUserId;
      referral.status = 'applied';

      // 1. Grant referee 20% off for 3 months
      const refereeCredit: ReferralCreditRecord = {
        id: `rc_${Date.now()}_referee`,
        userId: refereeUserId,
        referralId: referral.id,
        percentOff: REFERRAL_DISCOUNT.percentOff,
        monthsTotal: REFERRAL_DISCOUNT.monthsDuration,
        monthsApplied: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      db.referralCredits.set(refereeCredit.id, refereeCredit);

      // 2. Grant referrer 20% off for 3 months
      const referrerCredit: ReferralCreditRecord = {
        id: `rc_${Date.now()}_referrer`,
        userId: referral.referrerUserId,
        referralId: referral.id,
        percentOff: REFERRAL_DISCOUNT.percentOff,
        monthsTotal: REFERRAL_DISCOUNT.monthsDuration,
        monthsApplied: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      db.referralCredits.set(referrerCredit.id, referrerCredit);

      return { success: true, referrerUserId: referral.referrerUserId, refereeUserId };
    } finally {
      releaseLock();
    }
  }

  getUserReferralStats(userId: string) {
    const referrals = Array.from(db.referrals.values()).filter((r) => r.referrerUserId === userId);
    const credits = Array.from(db.referralCredits.values()).filter((c) => c.userId === userId && c.status === 'active');

    return {
      totalReferrals: referrals.length,
      activeCredits: credits,
      percentOff: REFERRAL_DISCOUNT.percentOff,
      monthsRemaining: credits.reduce((acc, c) => acc + (c.monthsTotal - c.monthsApplied), 0),
    };
  }
}

export const referralsService = new ReferralsService();
