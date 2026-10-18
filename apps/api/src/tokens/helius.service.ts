import { env } from '../config/env.js';
import { logger } from '../observability/index.js';

export const PUMP_FUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
export const RAYDIUM_PROGRAM = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
export const MANDATORY_PROGRAM_ADDRESSES = [PUMP_FUN_PROGRAM, RAYDIUM_PROGRAM];

export interface TokenAssetMetadata {
  name?: string;
  symbol?: string;
  imageUrl?: string;
  description?: string;
  decimals?: number;
  supply?: number;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  creator?: string | null;
}

export interface HolderInfo {
  address: string;
  pct: number;
  amount: number;
}

export interface TokenDistributionInfo {
  holderCount: number;
  top10Pct: number;
  topHolders: HolderInfo[];
  devHoldingPct: number;
  mintAuthRevoked: boolean;
  freezeAuthRevoked: boolean;
  lpBurnedOrLockedPct: number;
  liquidityUsd?: number;
  enriched?: boolean;
}

/**
 * Normalizes IPFS or decentralized storage URLs to HTTPS gateway URLs
 */
export function normalizeImageUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('ipfs://')) {
    const hash = trimmed.replace('ipfs://', '').replace(/^ipfs\//, '');
    return `https://ipfs.io/ipfs/${hash}`;
  }

  // Handle Arweave or normal HTTP/HTTPS
  return trimmed;
}

export class HeliusOnChainService {
  private rpcUrl: string;
  private apiKey: string;
  private lastRequestTime = 0;
  private minIntervalMs = 125; // Max 8 RPS sustained (1000 / 8 = 125ms)

  constructor() {
    this.apiKey = env.HELIUS_API_KEY || '';
    if (this.apiKey) {
      this.rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;
    } else {
      this.rpcUrl = env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
    }
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;
    if (timeSinceLast < this.minIntervalMs) {
      await this.sleep(this.minIntervalMs - timeSinceLast);
    }
    this.lastRequestTime = Date.now();
  }

  private getActiveRpcUrl(): string {
    const key = env.HELIUS_API_KEY || '';
    if (key) {
      return `https://mainnet.helius-rpc.com/?api-key=${key}`;
    }
    return env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
  }



  /**
   * RPC call helper with sustained <= 8 RPS rate-limiting, exponential backoff, and <= 10s timeout.
   */
  async callRpc(method: string, params: any[], maxAttempts = 3): Promise<any> {
    const url = this.getActiveRpcUrl();

    let lastError: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.throttle();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s per attempt (<=10s)

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `solradar-${Date.now()}`,
            method,
            params,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (res.status === 429) {
          // Rate limited: backoff exponentially
          const backoffMs = Math.min(3000, 500 * Math.pow(2, attempt - 1));
          logger.warn(`Helius RPC 429 on ${method}. Backing off for ${backoffMs}ms (attempt ${attempt}/${maxAttempts})...`);
          await this.sleep(backoffMs);
          continue;
        }

        if (!res.ok) {
          throw new Error(`RPC ${method} returned HTTP ${res.status}`);
        }

        const json: any = await res.json();
        if (json.error) {
          throw new Error(`RPC ${method} error: ${JSON.stringify(json.error)}`);
        }

        return json.result;
      } catch (err: any) {
        clearTimeout(timeout);
        lastError = err;
        if (attempt < maxAttempts) {
          const delay = 300 * attempt;
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error(`RPC ${method} failed after ${maxAttempts} attempts`);
  }

  /**
   * Fix 1: Helius DAS getAsset API for real metadata, image URL, and description
   * POST https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}
   * {"jsonrpc":"2.0","id":"1","method":"getAsset","params":{"id":"<mint>"}}
   */
  async fetchTokenAsset(mint: string, maxAttempts = 3): Promise<TokenAssetMetadata | null> {
    const key = env.HELIUS_API_KEY || '';

    // 1. If Helius API Key is configured, use Helius DAS getAsset
    if (key) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await this.throttle();
        try {
          const dasUrl = `https://mainnet.helius-rpc.com/?api-key=${key}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 7000);

          const res = await fetch(dasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'getAsset',
              method: 'getAsset',
              params: { id: mint },
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (res.status === 429) {
            await this.sleep(500 * attempt);
            continue;
          }

          if (res.ok) {
            const json: any = await res.json();
            const result = json?.result;
            if (result) {
              const rawImage =
                result.content?.links?.image ||
                result.content?.files?.[0]?.uri ||
                result.content?.json_uri;

              let imageUrl = normalizeImageUrl(rawImage);

              // If json_uri was an offchain json metadata link, resolve it if imageUrl is still empty
              if (!imageUrl && result.content?.json_uri) {
                try {
                  const metaRes = await fetch(normalizeImageUrl(result.content.json_uri)!);
                  if (metaRes.ok) {
                    const metaJson: any = await metaRes.json();
                    imageUrl = normalizeImageUrl(metaJson.image);
                  }
                } catch {}
              }

              const name = result.content?.metadata?.name;
              const symbol = result.content?.metadata?.symbol;
              const description = result.content?.metadata?.description;
              const supply = result.token_info?.supply ? Number(result.token_info.supply) : undefined;
              const decimals = result.token_info?.decimals ?? 6;
              const mintAuth = result.token_info?.mint_authority;
              const freezeAuth = result.token_info?.freeze_authority;
              const creator = result.creators?.[0]?.address || result.authorities?.[0]?.address || null;

              return {
                name,
                symbol,
                imageUrl: imageUrl || undefined,
                description,
                decimals,
                supply,
                mintAuthority: mintAuth,
                freezeAuthority: freezeAuth,
                creator,
              };
            }
          }
        } catch (err: any) {
          if (attempt === maxAttempts) {
            logger.warn(`Helius DAS getAsset error for ${mint}: ${err.message}`);
          }
        }
      }
    }

    // 2. Fallback: DexScreener Token Profiles & Pairs API for real metadata & image
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data: any = await res.json();
        const pair = data.pairs?.find((p: any) => p.chainId === 'solana');
        if (pair) {
          const rawImg = pair.info?.imageUrl;
          const imageUrl = normalizeImageUrl(rawImg);
          return {
            name: pair.baseToken?.name,
            symbol: pair.baseToken?.symbol?.replace(/^\$/, ''),
            imageUrl: imageUrl || undefined,
            decimals: 6,
          };
        }
      }
    } catch (err: any) {
      logger.warn(`DexScreener token metadata fallback error for ${mint}:`, err.message);
    }

    return null;
  }

  /**
   * Fix 2: Real Risk Score Inputs via On-Chain Queries
   * - getTokenLargestAccounts: Top-10 holder %
   * - getAccountInfo: Mint & Freeze authorities
   * - getTokenAccountsByOwner: Dev holding %
   * - LP status: Bonding curve vs Raydium burn
   */
  async fetchOnChainRiskInputs(
    mint: string,
    creatorAddress?: string | null,
    stage: string = 'new'
  ): Promise<TokenDistributionInfo> {
    let holderCount = 0;
    let top10Pct = 0.0;
    let topHolders: HolderInfo[] = [];
    let devHoldingPct = 0.0;
    let mintAuthRevoked = false;
    let freezeAuthRevoked = false;
    let lpBurnedOrLockedPct = 0;
    let liquidityUsd: number | undefined;
    let totalSupply = 1_000_000_000;
    let enriched = false;

    // 1. Fetch Mint Account Info for Mint & Freeze Authorities and Decimals
    try {
      const mintAcc = await this.callRpc('getAccountInfo', [
        mint,
        { encoding: 'jsonParsed' },
      ]);
      const parsed = mintAcc?.value?.data?.parsed?.info;
      if (parsed) {
        mintAuthRevoked = parsed.mintAuthority === null;
        freezeAuthRevoked = parsed.freezeAuthority === null;
        if (parsed.supply) {
          const dec = parsed.decimals || 6;
          totalSupply = Number(parsed.supply) / Math.pow(10, dec);
        }
        enriched = true;
      }
    } catch (err: any) {
      logger.warn(`Error fetching mint account info for ${mint}:`, err.message);
    }

    // 2. Fetch Largest Token Accounts for Real Top 10 Concentration
    try {
      const largest = await this.callRpc('getTokenLargestAccounts', [mint]);
      const accounts: any[] = largest?.value || [];

      if (accounts.length > 0) {
        // Calculate total amount from largest accounts
        const top10 = accounts.slice(0, 10);
        let top10Amount = 0;
        topHolders = top10.map((acc: any) => {
          const amount = acc.uiAmount ?? (Number(acc.amount) / Math.pow(10, acc.decimals || 6));
          top10Amount += amount;
          const pct = totalSupply > 0 ? (amount / totalSupply) * 100 : 0;
          return {
            address: acc.address,
            amount,
            pct: Math.min(100, Math.round(pct * 100) / 100),
          };
        });

        if (totalSupply > 0) {
          top10Pct = Math.min(100, Math.max(0, (top10Amount / totalSupply) * 100));
        }

        // Use real count of largest accounts as lower bound for active holders
        holderCount = Math.max(accounts.length, 1);
        enriched = true;
      }
    } catch (err: any) {
      logger.warn(`Error fetching largest accounts for ${mint}:`, err.message);
    }

    // 3. Dev Holding % via getTokenAccountsByOwner
    if (creatorAddress && creatorAddress !== '11111111111111111111111111111111') {
      try {
        const devAccounts = await this.callRpc('getTokenAccountsByOwner', [
          creatorAddress,
          { mint },
          { encoding: 'jsonParsed' },
        ]);
        const list: any[] = devAccounts?.value || [];
        let devBalance = 0;
        for (const item of list) {
          const parsed = item.account?.data?.parsed?.info;
          if (parsed?.tokenAmount?.uiAmount) {
            devBalance += parsed.tokenAmount.uiAmount;
          }
        }
        if (totalSupply > 0) {
          devHoldingPct = Math.min(100, (devBalance / totalSupply) * 100);
        }
      } catch (err: any) {
        logger.warn(`Error fetching dev accounts for ${mint}:`, err.message);
      }
    }

    // 4. LP Burned % & Liquidity:
    // For pump.fun tokens in bonding curve: LP isn't burned yet (it's in curve) -> 0%
    // For migrated tokens: 100% burned upon Raydium migration
    const isPumpFun = mint.endsWith('pump');
    if (stage === 'migrated') {
      lpBurnedOrLockedPct = 100;
    } else if (isPumpFun || stage === 'curve' || stage === 'new') {
      lpBurnedOrLockedPct = 0;
    }

    // 5. Query DexScreener for live real liquidity reserves
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data: any = await res.json();
        const pair = data.pairs?.find((p: any) => p.chainId === 'solana');
        if (pair?.liquidity?.usd) {
          liquidityUsd = Number(pair.liquidity.usd);
        }
      }
    } catch {}

    return {
      holderCount: Math.round(holderCount),
      top10Pct: Math.round(top10Pct * 10) / 10,
      topHolders,
      devHoldingPct: Math.round(devHoldingPct * 10) / 10,
      mintAuthRevoked,
      freezeAuthRevoked,
      lpBurnedOrLockedPct,
      liquidityUsd,
      enriched,
    };
  }
}

export const heliusOnChainService = new HeliusOnChainService();
