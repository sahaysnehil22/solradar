import { PlanCode, PLAN_CONFIGS, REFERRAL_DISCOUNT } from '../constants/index.js';

export interface CheckoutSessionResult {
  checkoutUrl: string;
  sessionId: string;
  isTestMode: boolean;
}

export interface PortalSessionResult {
  portalUrl: string;
  isTestMode: boolean;
}

export interface WebhookProcessingResult {
  eventId: string;
  type: string;
  userId: string;
  planCode: PlanCode;
  subscriptionId: string;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  amountCents: number;
}

export interface BillingProvider {
  readonly providerName: string;

  createCheckoutSession(
    userId: string,
    planCode: PlanCode,
    options?: {
      successUrl?: string;
      cancelUrl?: string;
      referralDiscountMonthsRemaining?: number;
    }
  ): Promise<CheckoutSessionResult>;

  createPortalSession(
    userId: string,
    stripeCustomerId?: string,
    returnUrl?: string
  ): Promise<PortalSessionResult>;

  handleWebhook(
    payload: any,
    signature?: string
  ): Promise<WebhookProcessingResult>;

  cancelSubscription(
    subscriptionId: string,
    immediate?: boolean
  ): Promise<{ success: boolean; cancelAtPeriodEnd: boolean }>;

  getSubscriptionStatus(
    subscriptionId: string
  ): Promise<{
    status: string;
    currentPeriodEnd: Date;
    planCode: PlanCode;
    cancelAtPeriodEnd: boolean;
  }>;
}

/**
 * NoopBillingProvider: Active implementation for testing and development.
 * Emits zero charges, creates instant test activations, and logs explicit warnings.
 */
export class NoopBillingProvider implements BillingProvider {
  public readonly providerName = 'noop';

  private logPlaceholderWarning(action: string, details?: Record<string, any>) {
    console.warn(`[BILLING PLACEHOLDER — no real charge] ${action}`, details ?? {});
  }

  async createCheckoutSession(
    userId: string,
    planCode: PlanCode,
    options?: {
      successUrl?: string;
      cancelUrl?: string;
      referralDiscountMonthsRemaining?: number;
    }
  ): Promise<CheckoutSessionResult> {
    this.logPlaceholderWarning('createCheckoutSession invoked', { userId, planCode, options });

    const sessionId = `test_sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const baseSuccessUrl = options?.successUrl || '/billing';
    const testCheckoutUrl = `${baseSuccessUrl}?session_id=${sessionId}&plan=${planCode}&status=activated_demo`;

    return {
      checkoutUrl: testCheckoutUrl,
      sessionId,
      isTestMode: true,
    };
  }

  async createPortalSession(
    userId: string,
    _stripeCustomerId?: string,
    returnUrl?: string
  ): Promise<PortalSessionResult> {
    this.logPlaceholderWarning('createPortalSession invoked', { userId, returnUrl });
    const portalUrl = returnUrl ? `${returnUrl}?portal_demo=1` : '/billing?portal_demo=1';

    return {
      portalUrl,
      isTestMode: true,
    };
  }

  async handleWebhook(payload: any, _signature?: string): Promise<WebhookProcessingResult> {
    this.logPlaceholderWarning('handleWebhook processing simulated event', {
      type: payload?.type,
      id: payload?.id,
    });

    const eventId = payload?.id || `sim_evt_${Date.now()}`;
    const type = payload?.type || 'customer.subscription.created';
    const data = payload?.data || {};

    const userId = data.userId || 'test_user_placeholder';
    const planCode = (data.planCode as PlanCode) || PlanCode.SCOUT;
    const subscriptionId = data.subscriptionId || `sub_test_${Date.now()}`;
    const status = data.status || 'active';
    const cancelAtPeriodEnd = !!data.cancelAtPeriodEnd;

    // Period end default 30 days from now
    const currentPeriodEnd = data.currentPeriodEnd
      ? new Date(data.currentPeriodEnd)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const baseAmount = PLAN_CONFIGS[planCode]?.priceCentsMonthly ?? 5000;
    const discount = data.hasReferralDiscount ? (baseAmount * REFERRAL_DISCOUNT.percentOff) / 100 : 0;
    const amountCents = Math.round(baseAmount - discount);

    return {
      eventId,
      type,
      userId,
      planCode,
      subscriptionId,
      status,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      amountCents,
    };
  }

  async cancelSubscription(
    subscriptionId: string,
    immediate = false
  ): Promise<{ success: boolean; cancelAtPeriodEnd: boolean }> {
    this.logPlaceholderWarning('cancelSubscription invoked', { subscriptionId, immediate });
    return {
      success: true,
      cancelAtPeriodEnd: !immediate,
    };
  }

  async getSubscriptionStatus(subscriptionId: string): Promise<{
    status: string;
    currentPeriodEnd: Date;
    planCode: PlanCode;
    cancelAtPeriodEnd: boolean;
  }> {
    this.logPlaceholderWarning('getSubscriptionStatus query', { subscriptionId });
    return {
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      planCode: PlanCode.SCOUT,
      cancelAtPeriodEnd: false,
    };
  }
}

/**
 * Proration math helper for plan upgrades / downgrades
 */
export function calculateProration(params: {
  currentPlanCode: PlanCode;
  newPlanCode: PlanCode;
  daysRemainingInPeriod: number;
  totalDaysInPeriod?: number;
}): {
  creditCents: number;
  chargeCents: number;
  netDueCents: number;
} {
  const totalDays = params.totalDaysInPeriod || 30;
  const currentPrice = PLAN_CONFIGS[params.currentPlanCode].priceCentsMonthly;
  const newPrice = PLAN_CONFIGS[params.newPlanCode].priceCentsMonthly;

  const fractionRemaining = Math.max(0, Math.min(1, params.daysRemainingInPeriod / totalDays));

  const creditCents = Math.round(currentPrice * fractionRemaining);
  const chargeCents = Math.round(newPrice * fractionRemaining);
  const netDueCents = Math.max(0, chargeCents - creditCents);

  return {
    creditCents,
    chargeCents,
    netDueCents,
  };
}
