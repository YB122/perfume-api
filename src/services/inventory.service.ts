import { Types, type ClientSession } from 'mongoose';

import { Inventory } from '../models/Inventory';
import { logger } from '../config/logger';

export interface ReserveItem {
  variantId: string | Types.ObjectId;
  vendorId: string | Types.ObjectId;
  quantity: number;
}

export class OutOfStockError extends Error {
  constructor(public variantId: string) {
    super(`Out of stock for variant ${variantId}`);
    this.name = 'OutOfStockError';
  }
}

// Atomic conditional update — the operation fails if there isn't enough free stock.
// This is used inside the order transaction (plan 3.1).
export async function reserveInventoryOrThrow(items: ReserveItem[], session?: ClientSession): Promise<void> {
  const reserved: ReserveItem[] = [];
  try {
    for (const item of items) {
      const result = await Inventory.findOneAndUpdate(
        {
          variantId: item.variantId,
          vendorId: item.vendorId,
          $expr: {
            $gte: [{ $subtract: ['$quantityAvailable', '$quantityReserved'] }, item.quantity],
          },
        },
        { $inc: { quantityReserved: item.quantity } },
        { new: true, session }
      );
      if (!result) {
        await releaseReservations(reserved, session);
        throw new OutOfStockError(String(item.variantId));
      }
      reserved.push(item);
    }
  } catch (err) {
    if (!(err instanceof OutOfStockError)) await releaseReservations(reserved, session);
    throw err;
  }
}

export async function releaseReservations(items: ReserveItem[], session?: ClientSession): Promise<void> {
  for (const item of items) {
    await Inventory.findOneAndUpdate(
      { variantId: item.variantId, vendorId: item.vendorId },
      { $inc: { quantityReserved: -item.quantity } },
      { session }
    ).catch((e) => logger.warn({ err: e }, 'releaseReservations failed'));
  }
}

// Confirm an order: move reserved stock into "consumed" by reducing available.
export async function consumeReserved(items: ReserveItem[], session?: ClientSession): Promise<void> {
  for (const item of items) {
    await Inventory.findOneAndUpdate(
      { variantId: item.variantId, vendorId: item.vendorId },
      { $inc: { quantityAvailable: -item.quantity, quantityReserved: -item.quantity } },
      { session }
    );
  }
}
