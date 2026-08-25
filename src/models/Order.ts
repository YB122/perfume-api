import { Schema, model, Types, type InferSchemaType } from 'mongoose';

export const SUB_ORDER_STATUSES = [
  'awaiting_confirmation',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'cancelled_by_vendor',
  'cancelled_by_customer',
  'refunded',
] as const;
export type SubOrderStatus = (typeof SUB_ORDER_STATUSES)[number];

const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    productNameSnapshot: String,
    productNameSnapshotLocale: { type: String, enum: ['en', 'fr', 'ar'] },
    variantLabelSnapshot: String,
    unitPriceSnapshot: Number,
    quantity: Number,
  },
  { _id: false }
);

const subOrderSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    items: [orderItemSchema],
    subtotal: Number,
    commissionAmount: Number,
    vendorPayoutAmount: Number,
    status: { type: String, enum: SUB_ORDER_STATUSES, default: 'awaiting_confirmation', index: true },
    payoutStatus: { type: String, enum: ['pending', 'included_in_batch', 'paid'], default: 'pending' },
    payoutBatchId: { type: Schema.Types.ObjectId, ref: 'PayoutBatch', default: null },
  },
  { timestamps: true }
);

export const orderSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subOrders: [subOrderSchema],
    totalAmount: Number,
    paymentMethod: { type: String, enum: ['card', 'cash_on_delivery'] },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    stripePaymentIntentId: { type: String, default: null },
    shippingAddress: {
      fullName: String,
      phone: String,
      city: String,
      addressLine: String,
    },
    idempotencyKey: { type: String, index: true },
  },
  { timestamps: true }
);

export type OrderDoc = InferSchemaType<typeof orderSchema> & { _id: Types.ObjectId };
export const Order = model('Order', orderSchema);
