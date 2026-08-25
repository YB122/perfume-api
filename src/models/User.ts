import { Schema, model, Types, type InferSchemaType } from 'mongoose';

export const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    phone: { type: String },
    role: {
      type: String,
      enum: ['super_admin', 'vendor_admin', 'vendor_staff', 'customer'],
      default: 'customer',
      index: true,
    },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', default: null },
    // soft-delete instead of hard-delete to preserve referential integrity
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User = model('User', userSchema);
