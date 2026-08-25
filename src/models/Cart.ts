import { Schema, model, Types, type InferSchemaType } from 'mongoose';

const cartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: Number,
    variantLabel: String,
  },
  { _id: false }
);

export const cartSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [cartItemSchema],
    paymentMethod: { type: String, enum: ['card', 'cash_on_delivery'] },
  },
  { timestamps: true }
);

export type CartDoc = InferSchemaType<typeof cartSchema> & { _id: Types.ObjectId };
export const Cart = model('Cart', cartSchema);
