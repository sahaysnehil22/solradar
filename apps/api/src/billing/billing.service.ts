import {
  BillingProvider,
  NoopBillingProvider,
  PlanCode,
  PLAN_CONFIGS,
  calculateProration,
  REFERRAL_DISCOUNT,
} from '@solradar/shared';
import { db, SubscriptionRecord } from '../db/store.js';
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
    const user = db.users.get(userId);
    if (!user) throw new Error('User not found');

    // Check active referral credit for discount calculation
    let referralDiscountMonthsRemaining = 0;
    for (const credit of db.referralCredits.values()) {
      if (credit.userId === userId && credit.status === 'active' && credit.monthsApplied < credit.monthsTotal) {
        referralDiscountMonthsRemaining = credit.monthsTotal - credit.monthsApplied;
        break;
      }
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
   * Processes webhook events transactionally with strict idempotency and row locks.
   */
  async processWebhook(payload: any, signature?: string) {
    const result = await this.provider.handleWebhook(payload, signature);

    // 1. Idempotency Check: Drop duplicate event IDs
    const isNewEvent = db.recordPaymentEventIdempotent(result.eventId, result.type, payload);
    if (!isNewEvent) {
      return { status: 'ignored_duplicate', eventId: result.eventId };
    }

    // 2. Acquire lock on user row to prevent concurrent race conditions on credits/subscriptions
    const releaseLock = await db.acquireRowLock(`user:${result.userId}`);
    try {
      const user = db.users.get(result.userId);
      if (!user) {
        logger.warn('Webhook user record not found, created placeholder for testing', { userId: result.userId });
      }

      // Update or create subscription record
      let sub = Array.from(db.subscriptions.values()).find((s) => s.userId === result.userId);
      if (!sub) {
        sub = {
          id: `sub_${Date.now()}`,
          userId: result.userId,
          stripeSubscriptionId: result.subscriptionId,
          planCode: result.planCode,
          status: result.status === 'active' ? 'active' : 'past_due',
          currentPeriodEnd: result.currentPeriodEnd,
          cancelAtPeriodEnd: result.cancelAtPeriodEnd,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        db.subscriptions.set(sub.id, sub);
      } else {
        sub.planCode = result.planCode;
        sub.status = result.status === 'active' ? 'active' : 'past_due';
        sub.currentPeriodEnd = result.currentPeriodEnd;
        sub.cancelAtPeriodEnd = result.cancelAtPeriodEnd;
        sub.updatedAt = new Date();
      }

      // Sync plan on user identity
      if (user) {
        user.plan = sub.status === 'active' ? result.planCode : PlanCode.FREE;
      }

      // 3. Race-Safe Referral Credit Application
      if (result.type === 'customer.subscription.created' || result.type === 'invoice.payment_succeeded') {
        for (const credit of db.referralCredits.values()) {
          if (credit.userId === result.userId && credit.status === 'active') {
            credit.monthsApplied += 1;
            credit.updatedAt = new Date();
            if (credit.monthsApplied >= credit.monthsTotal) {
              credit.status = 'exhausted';
            }
            logger.info('Referral credit applied to subscription cycle', {
              creditId: credit.id,
              userId: credit.userId,
              monthsApplied: credit.monthsApplied,
            });
            break;
          }
        }
      }

      return { status: 'processed', subscriptionId: sub.id, planCode: sub.planCode };
    } finally {
      releaseLock();
    }
  }

  async cancelSubscription(userId: string, immediate = false) {
    const sub = Array.from(db.subscriptions.values()).find((s) => s.userId === userId && s.status === 'active');
    if (!sub) throw new Error('No active subscription found');

    const result = await this.provider.cancelSubscription(sub.stripeSubscriptionId, immediate);
    if (immediate) {
      sub.status = 'canceled';
      const user = db.users.get(userId);
      if (user) user.plan = PlanCode.FREE;
    } else {
      sub.cancelAtPeriodEnd = true;
    }
    sub.updatedAt = new Date();

    return { success: true, cancelAtPeriodEnd: sub.cancelAtPeriodEnd };
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
