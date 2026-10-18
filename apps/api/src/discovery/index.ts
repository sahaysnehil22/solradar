import { pumpFunDiscovery, PumpFunDiscoveryService, PumpFunCoin } from './pumpfun.js';
import {
  dexScreenerDiscovery,
  DexScreenerDiscoveryService,
  DexScreenerTokenMetadata,
  DexScreenerBoostItem,
} from './dexscreener.js';
import { logger } from '../observability/index.js';

export {
  pumpFunDiscovery,
  PumpFunDiscoveryService,
  PumpFunCoin,
  dexScreenerDiscovery,
  DexScreenerDiscoveryService,
  DexScreenerTokenMetadata,
  DexScreenerBoostItem,
};

/**
 * Starts all active discovery pipelines (pump.fun 15s poller + DexScreener trending boosts & metadata).
 */
export function startDiscoveryPipelines(): void {
  logger.info('[Discovery] Launching free API token discovery pipelines (pump.fun + DexScreener)...');
  pumpFunDiscovery.start();
  dexScreenerDiscovery.start();
}

/**
 * Stops all discovery pipelines gracefully.
 */
export function stopDiscoveryPipelines(): void {
  logger.info('[Discovery] Stopping token discovery pipelines...');
  pumpFunDiscovery.stop();
  dexScreenerDiscovery.stop();
}
