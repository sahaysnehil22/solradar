import { RISK_THRESHOLDS } from '../constants/index.js';

export type ConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW';

export interface RiskEvaluationInput {
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  lpBurnedOrLockedPct: number;
  top10Pct: number;
  devHoldingPct: number;
  liquidityUsd: number;
  mcapUsd: number;
  volume5m: number;
  buys5m: number;
  sells5m: number;
  holderCount: number;
  tokenAgeMinutes?: number;
  isBundledSniperLaunch?: boolean;
}

export interface RiskDiagnosticFlag {
  code: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  deductionPoints: number;
}

export interface RiskReportOutput {
  momentumScore: number; // 0 to 100
  riskScore: number; // 0 to 100 (100 = extreme risk/danger, 0 = safe)
  confidence: ConfidenceTier;
  modelVersion: string;
  scoredAt: Date;
  flags: RiskDiagnosticFlag[];
  summary: string;
}

export const RISK_MODEL_VERSION = '1.0.0';

/**
 * Calculates deterministic Risk & Momentum scores with actionable diagnostic flags.
 */
export function evaluateTokenRisk(input: RiskEvaluationInput): RiskReportOutput {
  const flags: RiskDiagnosticFlag[] = [];
  let riskScore = 0;

  // 1. Mint Authority Check
  if (!input.mintAuthorityRevoked) {
    const deduction = 30;
    riskScore += deduction;
    flags.push({
      code: 'FLAG_MINT_AUTHORITY_ENABLED',
      severity: 'CRITICAL',
      title: 'Mint Authority Active',
      description: 'The token creator can mint unlimited additional tokens at will, posing immediate dilution risk.',
      deductionPoints: deduction,
    });
  }

  // 2. Freeze Authority Check
  if (!input.freezeAuthorityRevoked) {
    const deduction = 25;
    riskScore += deduction;
    flags.push({
      code: 'FLAG_FREEZE_AUTHORITY_ENABLED',
      severity: 'CRITICAL',
      title: 'Freeze Authority Active',
      description: 'The creator retains authority to freeze user accounts and prevent selling (honeypot vector).',
      deductionPoints: deduction,
    });
  }

  // 3. LP Lock / Burn Status
  if (input.lpBurnedOrLockedPct < 50) {
    const deduction = 30;
    riskScore += deduction;
    flags.push({
      code: 'FLAG_LP_UNLOCKED',
      severity: 'CRITICAL',
      title: 'Liquidity Pool Unlocked',
      description: `Only ${input.lpBurnedOrLockedPct.toFixed(1)}% of LP is burned or locked. High risk of liquidity rug pull.`,
      deductionPoints: deduction,
    });
  } else if (input.lpBurnedOrLockedPct < 90) {
    const deduction = 15;
    riskScore += deduction;
    flags.push({
      code: 'FLAG_LP_PARTIALLY_LOCKED',
      severity: 'WARNING',
      title: 'LP Only Partially Locked',
      description: `${input.lpBurnedOrLockedPct.toFixed(1)}% LP locked/burned. Remaining pool can be drained.`,
      deductionPoints: deduction,
    });
  }

  // 4. Top 10 Holder Concentration
  if (input.top10Pct >= RISK_THRESHOLDS.TOP10_CONCENTRATION_EXTREME_PCT) {
    const deduction = 25;
    riskScore += deduction;
    flags.push({
      code: 'FLAG_EXTREME_TOP10_CONCENTRATION',
      severity: 'CRITICAL',
      title: 'Extreme Holder Concentration',
      description: `Top 10 holders control ${input.top10Pct.toFixed(1)}% of the supply. Coordinated dumps will crash price.`,
      deductionPoints: deduction,
    });
  } else if (input.top10Pct >= RISK_THRESHOLDS.TOP10_CONCENTRATION_DANGER_PCT) {
    const deduction = 15;
    riskScore += deduction;
    flags.push({
      code: 'FLAG_HIGH_TOP10_CONCENTRATION',
      severity: 'WARNING',
      title: 'High Top 10 Concentration',
      description: `Top 10 wallets hold ${input.top10Pct.toFixed(1)}% of circulating tokens.`,
      deductionPoints: deduction,
    });
  }

  // 5. Dev Balance
  if (input.devHoldingPct >= RISK_THRESHOLDS.DEV_HOLDING_DANGER_PCT) {
    const deduction = 20;
    riskScore += deduction;
    flags.push({
      code: 'FLAG_DEV_HOLDING_EXCESS',
      severity: 'CRITICAL',
      title: 'Creator Holds Excess Supply',
      description: `Deployer wallet holds ${input.devHoldingPct.toFixed(1)}% of supply (safe threshold: < 5%).`,
      deductionPoints: deduction,
    });
  }

  // 6. Liquidity Depth
  if (input.liquidityUsd < RISK_THRESHOLDS.MIN_SAFE_LIQUIDITY_USD) {
    const deduction = 15;
    riskScore += deduction;
    flags.push({
      code: 'FLAG_LOW_LIQUIDITY',
      severity: 'WARNING',
      title: 'Thin Liquidity',
      description: `Total liquidity is only $${input.liquidityUsd.toLocaleString()} USD. High slippage on trades.`,
      deductionPoints: deduction,
    });
  }

  // 7. Bundled Sniper Launch
  if (input.isBundledSniperLaunch) {
    const deduction = 20;
    riskScore += deduction;
    flags.push({
      code: 'FLAG_BUNDLED_SNIPER_LAUNCH',
      severity: 'CRITICAL',
      title: 'Bundled Insider Sniping Detected',
      description: 'Multiple top holders were funded by identical master wallets in the same block as genesis.',
      deductionPoints: deduction,
    });
  }

  // Clamp risk score to [0, 100]
  riskScore = Math.min(100, Math.max(0, riskScore));

  // Momentum Calculation (0 to 100)
  // Factors: buy/sell pressure ratio, volume velocity, transaction count
  let momentumScore = 50;
  const totalTx = input.buys5m + input.sells5m;
  if (totalTx > 0) {
    const buyRatio = input.buys5m / totalTx;
    // buyRatio 0.5 = neutral, 1.0 = strong momentum (+30), 0 = severe dump (-30)
    momentumScore += Math.round((buyRatio - 0.5) * 60);
  }

  // Volume velocity factor (volume compared to liquidity)
  if (input.liquidityUsd > 0) {
    const volLiqRatio = input.volume5m / input.liquidityUsd;
    if (volLiqRatio > 0.5) momentumScore += 15;
    else if (volLiqRatio > 0.2) momentumScore += 10;
  }

  // Clamp momentum score to [0, 100]
  momentumScore = Math.min(100, Math.max(0, momentumScore));

  // Determine Confidence Tier based on data points and age
  let confidence: ConfidenceTier = 'HIGH';
  if (input.holderCount < 20 || (input.tokenAgeMinutes && input.tokenAgeMinutes < 5)) {
    confidence = 'LOW';
  } else if (input.holderCount < 100 || (input.tokenAgeMinutes && input.tokenAgeMinutes < 30)) {
    confidence = 'MEDIUM';
  }

  // Summary statement
  let summary = 'Normal risk parameters observed.';
  if (riskScore >= 75) {
    summary = 'EXTREME RISK: Severe red flags detected (active authorities or high insider concentration).';
  } else if (riskScore >= 45) {
    summary = 'MODERATE RISK: Caution advised due to unlocked liquidity or high top-10 concentration.';
  } else if (momentumScore >= 70) {
    summary = 'STRONG MOMENTUM: High buyer interest with relatively healthy safety checks.';
  }

  return {
    momentumScore,
    riskScore,
    confidence,
    modelVersion: RISK_MODEL_VERSION,
    scoredAt: new Date(),
    flags,
    summary,
  };
}
