import { Schema, model, Types, type InferSchemaType } from 'mongoose';

export const reviewSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: String,
    body: String,
    locale: { type: String, enum: ['en', 'fr', 'ar'] },
  },
  { timestamps: true }
);

export type ReviewDoc = InferSchemaType<typeof reviewSchema> & { _id: Types.ObjectId };
export const Review = model('Review', reviewSchema);
