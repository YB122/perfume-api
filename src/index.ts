import { serve } from 'bun';

import { app } from './app';
import { connectDb } from './config/db';
import { startPayoutScheduler } from './jobs/payout.job';
import { env } from './config/env';
import { logger } from './config/logger';

async function main() {
  await connectDb();
  // Payout scheduling is an in-process cron (no Redis / BullMQ).
  startPayoutScheduler();
  logger.info(`Payout scheduler armed with cron "${env.PAYOUT_BATCH_CRON}"`);

  serve({ fetch: app.fetch, port: env.PORT });
  logger.info(`perfume-api listening on :${env.PORT}`);
}

main().catch((err) => {
  logger.error({ err }, 'Startup failed');
  process.exit(1);
});
