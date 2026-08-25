import { z } from 'zod';

export const addToCartSchema = z.object({
  productId: z.string(),
  variantId: z.string(),
  vendorId: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
  variantLabel: z.string().optional(),
});

export const checkoutSchema = z.object({
  paymentMethod: z.enum(['card', 'cash_on_delivery']),
  shippingAddress: z.object({
    fullName: z.string().min(1),
    phone: z.string().min(1),
    city: z.string().min(1),
    addressLine: z.string().min(1),
  }),
  items: z.array(addToCartSchema).optional(),
  idempotencyKey: z.string().optional(),
});
