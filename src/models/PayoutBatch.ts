import { Schema, model, Types, type InferSchemaType } from 'mongoose';

export const payoutBatchSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending_transfer', 'transferred', 'failed'],
      default: 'pending_transfer',
    },
    subOrderIds: [{ type: Schema.Types.ObjectId }],
    note: String,
  },
  { timestamps: true }
);

export type PayoutBatchDoc = InferSchemaType<typeof payoutBatchSchema> & { _id: Types.ObjectId };
export const PayoutBatch = model('PayoutBatch', payoutBatchSchema);
