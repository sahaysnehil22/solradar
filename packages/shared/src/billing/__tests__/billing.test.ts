import { describe, it, expect, vi } from 'vitest';
import { NoopBillingProvider, calculateProration } from '../index.js';
import { PlanCode, PLAN_CONFIGS } from '../../constants/index.js';

describe('NoopBillingProvider & Proration Logic', () => {
  it('creates test checkout sessions without real payment keys', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = new NoopBillingProvider();

    const result = await provider.createCheckoutSession('user_123', PlanCode.SCOUT);

    expect(result.isTestMode).toBe(true);
    expect(result.sessionId).toMatch(/^test_sess_/);
    expect(result.checkoutUrl).toContain('status=activated_demo');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[BILLING PLACEHOLDER — no real charge]'),
      expect.anything()
    );

    consoleWarnSpy.mockRestore();
  });

  it('handles simulated webhooks and computes referral discounts accurately', async () => {
    const provider = new NoopBillingProvider();
    const result = await provider.handleWebhook({
      id: 'evt_sim_1',
      type: 'customer.subscription.created',
      data: {
        userId: 'usr_abc',
        planCode: PlanCode.HUNTER,
        hasReferralDiscount: true,
      },
    });

    expect(result.status).toBe('active');
    expect(result.planCode).toBe(PlanCode.HUNTER);
    // $100 base with 20% off = $80 = 8000 cents
    expect(result.amountCents).toBe(8000);
  });

  it('calculates upgrade proration correctly', () => {
    // Upgrading Scout ($50) to Hunter ($100) with 15 days remaining out of 30
    const proration = calculateProration({
      currentPlanCode: PlanCode.SCOUT,
      newPlanCode: PlanCode.HUNTER,
      daysRemainingInPeriod: 15,
      totalDaysInPeriod: 30,
    });

    // Scout remaining value: 5000 * 0.5 = 2500 credit
    // Hunter remaining cost: 10000 * 0.5 = 5000 charge
    // Net due: 2500 cents ($25)
    expect(proration.creditCents).toBe(2500);
    expect(proration.chargeCents).toBe(5000);
    expect(proration.netDueCents).toBe(2500);
  });
});
