import { Schema, model, Types, type InferSchemaType } from 'mongoose';

import { localizedStringSchema } from './localized';

export const categorySchema = new Schema(
  {
    name: { type: localizedStringSchema, required: true },
    slug: { type: localizedStringSchema, required: true },
    parentCategoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type CategoryDoc = InferSchemaType<typeof categorySchema> & { _id: Types.ObjectId };
export const Category = model('Category', categorySchema);
