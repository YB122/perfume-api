import { z } from 'zod';
import { CONCENTRATIONS } from '../models/Product';

export const variantInputSchema = z.object({
  sizeMl: z.number().positive(),
  concentration: z.enum(CONCENTRATIONS),
  sku: z.string().min(1),
  price: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().optional(),
  images: z.array(z.object({ url: z.string(), cloudinaryPublicId: z.string() })).optional(),
});

export const localizedInputSchema = z.object({
  en: z.string().min(1),
  fr: z.string().min(1),
  ar: z.string().min(1),
});

export const createProductSchema = z.object({
  name: localizedInputSchema,
  slug: localizedInputSchema,
  description: localizedInputSchema,
  brand: z.string().optional(),
  categoryIds: z.array(z.string()).optional(),
  variants: z.array(variantInputSchema).min(1),
});

export const productFilterSchema = z.object({
  q: z.string().optional(),
  vendorId: z.string().optional(),
  categoryId: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  lang: z.enum(['en', 'fr', 'ar']).optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});
