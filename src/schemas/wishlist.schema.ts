import { z } from '@hono/zod-openapi';

export const addToWishlistSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
});
