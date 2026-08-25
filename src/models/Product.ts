import { Schema, model, Types, type InferSchemaType } from 'mongoose';

import { localizedStringSchema } from './localized';

export const CONCENTRATIONS = ['parfum', 'edp', 'edt', 'edc', 'attar'] as const;

const variantSchema = new Schema(
  {
    sizeMl: { type: Number, required: true },
    concentration: { type: String, enum: CONCENTRATIONS, required: true },
    sku: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    compareAtPrice: { type: Number },
    images: [{ url: String, cloudinaryPublicId: String }],
  },
  { _id: true }
);

export const productSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    name: { type: localizedStringSchema, required: true },
    slug: { type: localizedStringSchema, required: true },
    description: { type: localizedStringSchema, required: true },
    brand: { type: String },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    variants: [variantSchema],
    status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft' },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Unique slugs per locale
productSchema.index({ 'slug.en': 1 }, { unique: true, sparse: true });
productSchema.index({ 'slug.fr': 1 }, { unique: true, sparse: true });
productSchema.index({ 'slug.ar': 1 }, { unique: true, sparse: true });

// Per-language text indexes (no Arabic stemmer — see plan 7.4)
productSchema.index(
  { 'name.en': 'text', 'description.en': 'text' },
  { default_language: 'english', name: 'search_en' }
);
productSchema.index(
  { 'name.fr': 'text', 'description.fr': 'text' },
  { default_language: 'french', name: 'search_fr' }
);

export type VariantDoc = InferSchemaType<typeof variantSchema> & { _id: Types.ObjectId };
export type ProductDoc = InferSchemaType<typeof productSchema> & { _id: Types.ObjectId };
export const Product = model('Product', productSchema);
