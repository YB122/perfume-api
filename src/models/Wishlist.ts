import { Schema, model, Types, type InferSchemaType } from 'mongoose';

const wishlistItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export const wishlistSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [wishlistItemSchema],
  },
  { timestamps: true }
);

export type WishlistDoc = InferSchemaType<typeof wishlistSchema> & { _id: Types.ObjectId };
export const Wishlist = model('Wishlist', wishlistSchema);
