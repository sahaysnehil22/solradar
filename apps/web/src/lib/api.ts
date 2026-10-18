/**
 * SolRadar Web API Client
 * Non-custodial signals and memecoin intelligence.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface UserSession {
  id: string;
  email: string;
  telegramId?: string | null;
  username?: string | null;
  plan: 'free' | 'scout' | 'hunter';
  role: 'user' | 'admin';
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sr_access_token');
}

export function setStoredSession(token: string, user: UserSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('sr_access_token', token);
  localStorage.setItem('sr_user', JSON.stringify(user));
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('sr_access_token');
  localStorage.removeItem('sr_user');
}

export function getStoredUser(): UserSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('sr_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let errMsg = `Request failed: ${res.status}`;
    try {
      const errJson = await res.json();
      errMsg = errJson.error || errJson.message || errMsg;
    } catch {
      // noop
    }
    throw new Error(errMsg);
  }

  return res.json() as Promise<T>;
}

// 1. Tokens & Screener
export async function getTokens(params: {
  stage?: string;
  sortBy?: string;
  sortDir?: string;
  search?: string;
  minLiquidity?: number;
  maxRiskScore?: number;
  mintAuthRevokedOnly?: boolean;
  freezeAuthRevokedOnly?: boolean;
  lpBurnedOnly?: boolean;
  limit?: number;
  offset?: number;
} = {}) {
  const q = new URLSearchParams();
  if (params.stage) q.set('stage', params.stage);
  if (params.sortBy) q.set('sortBy', params.sortBy);
  if (params.sortDir) q.set('sortDir', params.sortDir);
  if (params.search) q.set('search', params.search);
  if (params.minLiquidity) q.set('minLiquidity', String(params.minLiquidity));
  if (params.maxRiskScore !== undefined) q.set('maxRiskScore', String(params.maxRiskScore));
  if (params.mintAuthRevokedOnly) q.set('mintAuthRevokedOnly', 'true');
  if (params.freezeAuthRevokedOnly) q.set('freezeAuthRevokedOnly', 'true');
  if (params.lpBurnedOnly) q.set('lpBurnedOnly', 'true');
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));

  return request<{ data: any[]; total: number }>(`/api/tokens?${q.toString()}`);
}

export async function getPulseLaunches(limit = 30) {
  return request<{ data: any[]; total: number }>(`/api/pulse?limit=${limit}`);
}

export async function getTokenDetail(mint: string) {
  return request<any>(`/api/tokens/${mint}`);
}

// 2. Snipe Alerts (Signals-Only)
export async function getSnipeRules() {
  return request<any[]>('/api/snipe-rules');
}

export async function createSnipeRule(rule: {
  name: string;
  launchpad?: string;
  minLiquidityUsd?: number;
  maxRiskScore?: number;
  maxDevHoldingPct?: number;
  channel?: string;
}) {
  return request<any>('/api/snipe-rules', {
    method: 'POST',
    body: JSON.stringify(rule),
  });
}

export async function deleteSnipeRule(ruleId: string) {
  return request<any>(`/api/snipe-rules/${ruleId}`, {
    method: 'DELETE',
  });
}

export async function getSnipeTriggers() {
  return request<any[]>('/api/snipe-triggers');
}

// 3. Smart Wallets
export async function getTrackedWallets() {
  return request<any[]>('/api/wallets');
}

export async function trackWallet(address: string, label?: string) {
  return request<any>('/api/wallets', {
    method: 'POST',
    body: JSON.stringify({ address, label }),
  });
}

export async function untrackWallet(address: string) {
  return request<any>(`/api/wallets/${address}`, {
    method: 'DELETE',
  });
}

export async function getWalletSignals(walletId: string) {
  return request<any[]>(`/api/wallets/${walletId}/signals`);
}

// 4. Portfolio (Read-Only)
export async function getPortfolioSummary() {
  return request<any>('/api/portfolio');
}

export async function addPortfolioAddress(address: string, label?: string) {
  return request<any>('/api/portfolio/address', {
    method: 'POST',
    body: JSON.stringify({ address, label }),
  });
}

// 5. Referrals
export async function getReferralsData() {
  return request<any>('/api/referrals');
}

export async function getReferralLink() {
  return request<{ referralCode: string; referralLink: string }>('/api/referrals/link');
}

export async function getReferralLedger() {
  return request<any>('/api/referrals/ledger');
}

export async function getReferralHistory() {
  return request<any[]>('/api/referrals/history');
}

// 6. Auth
export async function loginWithTelegram(authData: {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}) {
  const res = await request<{ user: UserSession; tokens: { accessToken: string; refreshToken: string } }>('/api/auth/telegram', {
    method: 'POST',
    body: JSON.stringify(authData),
  });
  setStoredSession(res.tokens.accessToken, res.user);
  return res;
}

export async function getMe() {
  return request<UserSession>('/api/auth/me');
}

export async function logoutUser() {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore
  }
  clearStoredSession();
}

// 7. Admin
export async function getAdminStats() {
  return request<any>('/admin/stats');
}

/**
 * Deep links for non-custodial manual execution in external terminals.
 * Never touches private keys, never signs transactions.
 */
export function getTradeDeepLinks(mint: string) {
  return {
    axiom: `https://axiom.trade/trade/${mint}`,
    bullx: `https://bullx.io/terminal?chainId=1399811149&address=${mint}`,
    photon: `https://photon-sol.tinyastro.io/en/lp/${mint}`,
    jupiter: `https://jup.ag/swap/SOL-${mint}`,
    dexscreener: `https://dexscreener.com/solana/${mint}`,
    solscan: `https://solscan.io/token/${mint}`,
  };
}
