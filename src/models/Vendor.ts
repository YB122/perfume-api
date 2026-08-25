import { Schema, model, Types, type InferSchemaType } from 'mongoose';

export const vendorSchema = new Schema(
  {
    storeName: { type: String, required: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, index: true },
    commissionRate: { type: Number, required: true, default: 15.0 }, // percentage
    status: {
      type: String,
      enum: ['pending_review', 'approved', 'suspended', 'rejected'],
      default: 'pending_review',
      index: true,
    },
    payoutDetails: {
      method: { type: String, enum: ['bank_transfer', 'instapay'] },
      accountHolderName: String,
      // ⚠️ encrypt at rest in production (field-level encryption / KMS)
      bankAccountNumber: String,
      instapayHandle: String,
    },
    stripeConnectedAccountId: { type: String, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type VendorDoc = InferSchemaType<typeof vendorSchema> & { _id: Types.ObjectId };
export const Vendor = model('Vendor', vendorSchema);
