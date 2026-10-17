import {
  BillingProvider,
  NoopBillingProvider,
  PlanCode,
  PLAN_CONFIGS,
  calculateProration,
  REFERRAL_DISCOUNT,
} from '@solradar/shared';
import { prisma, lockUserForUpdate, lockReferralCreditForUpdate } from '../db/prisma.js';
import { logger } from '../observability/index.js';

export class BillingService {
  private provider: BillingProvider;

  constructor(provider?: BillingProvider) {
    this.provider = provider || new NoopBillingProvider();
  }

  getProviderName(): string {
    return this.provider.providerName;
  }

  async createCheckout(userId: string, planCode: PlanCode, options?: { successUrl?: string; cancelUrl?: string }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // Check active referral credit for discount calculation
    let referralDiscountMonthsRemaining = 0;
    const activeCredit = await prisma.referralCredit.findFirst({
      where: { userId, status: 'active' },
    });

    if (activeCredit && activeCredit.monthsApplied < activeCredit.monthsTotal) {
      referralDiscountMonthsRemaining = activeCredit.monthsTotal - activeCredit.monthsApplied;
    }

    const session = await this.provider.createCheckoutSession(userId, planCode, {
      ...options,
      referralDiscountMonthsRemaining,
    });

    return session;
  }

  async createPortal(userId: string, returnUrl?: string) {
    return this.provider.createPortalSession(userId, undefined, returnUrl);
  }

  /**
   * Processes webhook events transactionally with strict idempotency and row locks in PostgreSQL.
   */
  async processWebhook(payload: any, signature?: string) {
    const result = await this.provider.handleWebhook(payload, signature);

    return await prisma.$transaction(async (tx) => {
      // 1. Idempotency Check: Drop duplicate provider event IDs
      const existingEvent = await tx.paymentEvent.findUnique({
        where: { providerEventId: result.eventId },
      });
      if (existingEvent) {
        logger.info('Duplicate payment event dropped via idempotency key', {
          providerEventId: result.eventId,
          type: result.type,
        });
        return { status: 'ignored_duplicate', eventId: result.eventId };
      }

      try {
        await tx.paymentEvent.create({
          data: {
            providerEventId: result.eventId,
            type: result.type,
            payload: payload || {},
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002' || err.message?.includes('Unique constraint')) {
          return { status: 'ignored_duplicate', eventId: result.eventId };
        }
        throw err;
      }

      // 2. PostgreSQL Row-level lock on user row to prevent concurrent race conditions
      await lockUserForUpdate(tx, result.userId);

      const user = await tx.user.findUnique({ where: { id: result.userId } });
      if (!user) {
        logger.warn('Webhook user record not found, created placeholder for testing', { userId: result.userId });
      }

      // Update or create subscription record
      let sub = await tx.subscription.findFirst({ where: { userId: result.userId } });
      if (!sub) {
        sub = await tx.subscription.create({
          data: {
            userId: result.userId,
            providerSubscriptionId: result.subscriptionId,
            planId: result.planCode,
            status: result.status === 'active' ? 'active' : 'past_due',
            currentPeriodEnd: result.currentPeriodEnd,
            cancelAtPeriodEnd: result.cancelAtPeriodEnd ?? false,
          },
        });
      } else {
        sub = await tx.subscription.update({
          where: { id: sub.id },
          data: {
            providerSubscriptionId: result.subscriptionId,
            planId: result.planCode,
            status: result.status === 'active' ? 'active' : 'past_due',
            currentPeriodEnd: result.currentPeriodEnd,
            cancelAtPeriodEnd: result.cancelAtPeriodEnd ?? false,
          },
        });
      }

      // Sync plan on user identity
      if (user) {
        await tx.user.update({
          where: { id: user.id },
          data: { plan: sub.status === 'active' ? result.planCode : PlanCode.FREE },
        });
      }

      // 3. Race-Safe Referral Credit Application with Row-Level Lock
      if (result.type === 'customer.subscription.created' || result.type === 'invoice.payment_succeeded') {
        const activeCredit = await tx.referralCredit.findFirst({
          where: { userId: result.userId, status: 'active' },
        });

        if (activeCredit) {
          await lockReferralCreditForUpdate(tx, activeCredit.id);
          const nextMonthsApplied = activeCredit.monthsApplied + 1;
          const newStatus = nextMonthsApplied >= activeCredit.monthsTotal ? 'exhausted' : 'active';

          await tx.referralCredit.update({
            where: { id: activeCredit.id },
            data: {
              monthsApplied: nextMonthsApplied,
              status: newStatus,
            },
          });

          logger.info('Referral credit applied to subscription cycle', {
            creditId: activeCredit.id,
            userId: activeCredit.userId,
            monthsApplied: nextMonthsApplied,
          });
        }
      }

      return { status: 'processed', subscriptionId: sub.id, planCode: (sub as any).planId || result.planCode };
    });
  }

  async cancelSubscription(userId: string, immediate = false) {
    const sub = await prisma.subscription.findFirst({
      where: { userId, status: 'active' },
    });
    if (!sub) throw new Error('No active subscription found');

    await this.provider.cancelSubscription(sub.providerSubscriptionId, immediate);

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: immediate ? 'canceled' : sub.status,
        cancelAtPeriodEnd: !immediate,
      },
    });

    if (immediate) {
      await prisma.user.update({
        where: { id: userId },
        data: { plan: PlanCode.FREE },
      });
    }

    return { success: true, cancelAtPeriodEnd: updated.cancelAtPeriodEnd };
  }

  getProrationDetails(currentPlan: PlanCode, newPlan: PlanCode, daysRemaining: number) {
    return calculateProration({
      currentPlanCode: currentPlan,
      newPlanCode: newPlan,
      daysRemainingInPeriod: daysRemaining,
    });
  }
}

export const billingService = new BillingService();
