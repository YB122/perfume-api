import { env } from '../config/env';
import { logger } from '../config/logger';
import { notifyAdminForBankTransfer } from './notify.service';
import { Order } from '../models/Order';
import { PayoutBatch } from '../models/PayoutBatch';

// Generates settlement batches for delivered + collected sub-orders (plan 3.3).
export async function generatePayoutBatches(): Promise<number> {
  const eligible = await Order.aggregate([
    { $unwind: '$subOrders' },
    {
      $match: {
        'subOrders.status': 'delivered',
        'subOrders.payoutStatus': 'pending',
        paymentStatus: { $in: ['paid'] },
      },
    },
    {
      $group: {
        _id: '$subOrders.vendorId',
        totalPayout: { $sum: '$subOrders.vendorPayoutAmount' },
        subOrderIds: { $push: '$subOrders._id' },
      },
    },
  ]);

  for (const group of eligible) {
    const batch = await PayoutBatch.create({
      vendorId: group._id,
      totalAmount: group.totalPayout,
      status: 'pending_transfer',
      subOrderIds: group.subOrderIds,
    });

    await Order.updateMany(
      { 'subOrders._id': { $in: group.subOrderIds } },
      {
        $set: {
          'subOrders.$[elem].payoutStatus': 'included_in_batch',
          'subOrders.$[elem].payoutBatchId': batch._id,
        },
      },
      { arrayFilters: [{ 'elem._id': { $in: group.subOrderIds } }] }
    );

    await notifyAdminForBankTransfer(batch).catch((e) => logger.warn({ err: e }, 'notify failed'));
  }
  return eligible.length;
}

// --- Dependency-free cron scheduler (replaces BullMQ + Redis queue) ---
function parseField(token: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  const t = token.trim();
  if (t === '*') {
    for (let i = min; i <= max; i++) out.add(i);
    return out;
  }
  for (const part of t.split(',')) {
    if (part.includes('/')) {
      const seg = part.split('/');
      const step = Number(seg[1]);
      const range = seg[0] ?? '*';
      let rMin = min;
      let rMax = max;
      if (range !== '*' && range.includes('-')) {
        const bounds = range.split('-').map(Number);
        rMin = bounds[0] ?? min;
        rMax = bounds[1] ?? max;
      } else if (range !== '*') {
        rMin = rMax = Number(range);
      }
      for (let i = rMin; i <= rMax; i += step) out.add(i);
    } else if (part.includes('-')) {
      const bounds = part.split('-').map(Number);
      const a = bounds[0] ?? min;
      const b = bounds[1] ?? max;
      for (let i = a; i <= b; i++) out.add(i);
    } else {
      out.add(Number(part));
    }
  }
  return out;
}

export function nextCronRun(expr: string, from: Date): Date {
  const fields = expr.trim().split(/\s+/);
  const m = fields[0] ?? '*';
  const h = fields[1] ?? '*';
  const dom = fields[2] ?? '*';
  const mon = fields[3] ?? '*';
  const dow = fields[4] ?? '*';
  const minutes = parseField(m, 0, 59);
  const hours = parseField(h, 0, 23);
  const doms = parseField(dom, 1, 31);
  const mons = parseField(mon, 1, 12);
  const dows = parseField(dow, 0, 6); // 0 = Sunday

  const d = new Date(from.getTime() + 60_000); // start at the next minute
  d.setSeconds(0, 0);

  for (let i = 0; i < 4 * 366 * 24 * 60; i++) {
    const minute = d.getMinutes();
    const hour = d.getHours();
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const wday = d.getDay();
    if (
      minutes.has(minute) &&
      hours.has(hour) &&
      doms.has(day) &&
      mons.has(month) &&
      (dows.has(wday) || dow === '7')
    ) {
      return d;
    }
    d.setMinutes(d.getMinutes() + 1);
  }
  return from; // fallback: no match found
}

let timer: ReturnType<typeof setTimeout> | null = null;

export function startPayoutScheduler(): void {
  const scheduleNext = () => {
    const next = nextCronRun(env.PAYOUT_BATCH_CRON, new Date());
    const delay = next.getTime() - Date.now();
    timer = setTimeout(async () => {
      try {
        const n = await generatePayoutBatches();
        logger.info({ count: n }, 'payout batches generated');
      } catch (e) {
        logger.warn({ err: e }, 'payout batch generation failed');
      }
      scheduleNext();
    }, delay);
  };
  scheduleNext();
}

export function stopPayoutScheduler(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}
