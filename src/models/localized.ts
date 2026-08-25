import { Schema, model, type InferSchemaType } from 'mongoose';

export const LOCALES = ['en', 'fr', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const localizedStringSchema = new Schema(
  {
    en: { type: String, required: true },
    fr: { type: String, required: true },
    ar: { type: String, required: true },
  },
  { _id: false }
);

export type LocalizedString = InferSchemaType<typeof localizedStringSchema>;
