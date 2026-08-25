import mongoose from 'mongoose';
import { Types } from 'mongoose';

import { Order, type OrderDoc } from '../models/Order';
import { Vendor } from '../models/Vendor';
import { Product, type VariantDoc } from '../models/Product';
import { Cart } from '../models/Cart';
import { reserveInventoryOrThrow, consumeReserved, releaseReservations, type ReserveItem } from './inventory.service';
import { calculateCommission } from './commission.service';
import { logger } from '../config/logger';

export interface CreateOrderInput {
  customerId: string;
  paymentMethod: 'card' | 'cash_on_delivery';
  shippingAddress: { fullName: string; phone: string; city: string; addressLine: string };
  idempotencyKey?: string;
}

interface CartItemLike {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  vendorId: Types.ObjectId;
  quantity: number;
  unitPrice?: number | null;
  variantLabel?: string;
}

// Creates an order inside a MongoDB multi-document transaction (plan 3.2).
export async function createOrderFromCart(
  cart: { items: CartItemLike[]; _id: Types.ObjectId },
  input: CreateOrderInput
): Promise<OrderDoc> {
  const items = cart.items as CartItemLike[];
  const session = await mongoose.startSession();
  const reserveItems: ReserveItem[] = cart.items.map((i) => ({
    variantId: i.variantId,
    vendorId: i.vendorId,
    quantity: i.quantity,
  }));

  try {
    session.startTransaction();

    if (input.idempotencyKey) {
      const dup = await Order.findOne({ idempotencyKey: input.idempotencyKey }).session(session);
      if (dup) {
        await session.abortTransaction();
        return dup as OrderDoc;
      }
    }

    await reserveInventoryOrThrow(reserveItems, session);

    const byVendor = new Map<string, CartItemLike[]>();
    for (const item of items) {
      const key = item.vendorId.toString();
      byVendor.set(key, [...(byVendor.get(key) ?? []), item]);
    }

    const subOrders = await Promise.all(
      [...byVendor.entries()].map(async ([vendorId, items]) => {
        const vendor = await Vendor.findById(vendorId).session(session);
        if (!vendor) throw new Error(`Vendor ${vendorId} not found`);

        const snapshotItems = await Promise.all(
          items.map(async (it) => {
            const product = await Product.findById(it.productId).session(session);
            const variant = product?.variants.find(
              (v: VariantDoc) => v._id.toString() === it.variantId.toString()
            );
            return {
              productId: it.productId,
              variantId: it.variantId,
              productNameSnapshot: product?.name.en,
              variantLabelSnapshot: it.variantLabel ?? `${variant?.sizeMl}ml - ${variant?.concentration}`,
              unitPriceSnapshot: Number(it.unitPrice ?? variant?.price ?? 0),
              quantity: it.quantity,
            };
          })
        );

        const subtotal = snapshotItems.reduce((s, it) => s + (it.unitPriceSnapshot ?? 0) * it.quantity, 0);
        const { platformCommission, vendorPayout } = calculateCommission({
          itemSubtotal: subtotal,
          vendorCommissionRate: vendor.commissionRate,
        });

        return {
          vendorId: new Types.ObjectId(vendorId),
          items: snapshotItems,
          subtotal,
          commissionAmount: platformCommission,
          vendorPayoutAmount: vendorPayout,
          status: 'awaiting_confirmation' as const,
        };
      })
    );

    const totalAmount = subOrders.reduce((s, so) => s + so.subtotal, 0);

    const [order] = await Order.create(
      [
        {
          customerId: new Types.ObjectId(input.customerId),
          subOrders,
          totalAmount,
          paymentMethod: input.paymentMethod,
          paymentStatus: 'pending',
          shippingAddress: input.shippingAddress,
          idempotencyKey: input.idempotencyKey,
        },
      ],
      { session }
    );

    await Cart.deleteOne({ _id: cart._id }).session(session);
    await session.commitTransaction();
    return order as unknown as OrderDoc;
  } catch (err) {
    await session.abortTransaction();
    logger.error({ err }, 'createOrderFromCart failed');
    throw err;
  } finally {
    session.endSession();
  }
}

// Called from the Stripe webhook — convert reserved -> consumed and mark paid.
export async function confirmOrderPayment(orderId: string): Promise<void> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new Error('Order not found');

    const reserveItems: ReserveItem[] = [];
    for (const so of order.subOrders) {
      for (const it of so.items) {
        reserveItems.push({ variantId: it.variantId, vendorId: so.vendorId, quantity: it.quantity ?? 0 });
      }
    }
    await consumeReserved(reserveItems, session);
    order.paymentStatus = 'paid';
    await order.save({ session });
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
