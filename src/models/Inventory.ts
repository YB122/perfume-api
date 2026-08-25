import { Schema, model, Types, type InferSchemaType } from 'mongoose';

export const inventorySchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    quantityAvailable: { type: Number, required: true, default: 0 },
    quantityReserved: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

inventorySchema.index({ variantId: 1, vendorId: 1 }, { unique: true });

export type InventoryDoc = InferSchemaType<typeof inventorySchema> & { _id: Types.ObjectId };
export const Inventory = model('Inventory', inventorySchema);
