import { createServer } from './server.js';
import { env } from './config/env.js';
import { logger } from './observability/index.js';

async function main() {
  try {
    const app = await createServer();
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`SolRadar API server booted successfully on port ${env.PORT}`, {
      environment: env.NODE_ENV,
      billingProvider: env.BILLING_PROVIDER,
    });
  } catch (error) {
    logger.error('Failed to start SolRadar API server', error);
    process.exit(1);
  }
}

main();
