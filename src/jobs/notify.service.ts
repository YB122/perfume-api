import { logger } from '../config/logger';
import type { PayoutBatchDoc } from '../models/PayoutBatch';

// Placeholder notifier — wire to email/Slack/admin dashboard in production (plan 3.3).
export async function notifyAdminForBankTransfer(batch: PayoutBatchDoc): Promise<void> {
  logger.info(
    { vendorId: batch.vendorId, amount: batch.totalAmount },
    'Payout batch ready for manual bank transfer / Instapay'
  );
}
