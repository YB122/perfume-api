import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { Types } from 'mongoose';

import { Wishlist } from '../models/Wishlist';
import { Product } from '../models/Product';
import { addToWishlistSchema } from '../schemas/wishlist.schema';
import { authMiddleware, localeMiddleware, type AuthEnv } from '../lib/auth';
import { localize } from '../lib/i18n';

export const wishlistRouter = new OpenAPIHono<AuthEnv>();

wishlistRouter.use('*', authMiddleware);

wishlistRouter.openapi(
  {
    method: 'get',
    path: '/',
    tags: ['wishlist'],
    security: [{ Bearer: [] }],
    summary: 'Get current user wishlist',
    middleware: [localeMiddleware] as any,
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: z.any() } } },
    },
  },
  async (c) => {
    const userId = c.get('user').sub;
    const wl = (await Wishlist.findOne({ userId }).lean()) as any;
    const items = wl?.items ?? [];

    const data = await Promise.all(
      items.map(async (it: any) => {
        const p = (await Product.findOne({ _id: it.productId, deletedAt: null }).lean()) as any;
        const variant = p?.variants?.find(
          (v: any) => v._id.toString() === (it.variantId?.toString?.() ?? '')
        );
        const image = variant?.images?.[0]?.url ?? p?.variants?.[0]?.images?.[0]?.url;
        const price = variant?.price ?? p?.variants?.[0]?.price;
        return {
          productId: String(it.productId),
          variantId: it.variantId ? String(it.variantId) : null,
          addedAt: it.addedAt,
          product: p
            ? {
                id: String(p._id),
                name: localize(p.name, c),
                brand: p.brand,
                vendorId: String(p.vendorId),
                image,
                price,
              }
            : null,
        };
      })
    );

    return c.json({ items: data, count: data.length }, 200);
  }
);

wishlistRouter.openapi(
  {
    method: 'post',
    path: '/items',
    tags: ['wishlist'],
    security: [{ Bearer: [] }],
    summary: 'Add product to wishlist (idempotent)',
    request: { body: { content: { 'application/json': { schema: addToWishlistSchema } } } },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: z.any() } } },
      404: { description: 'Product not found' },
    },
  },
  async (c) => {
    const body = c.req.valid('json');
    const userId = c.get('user').sub;
    const product = await Product.findOne({ _id: body.productId, deletedAt: null });
    if (!product) return c.json({ error: 'Product not found' }, 404) as any;

    // Ensure the doc exists, then keep at most one entry per product (idempotent).
    await Wishlist.updateOne(
      { userId },
      [
        { $setOnInsert: { userId: new Types.ObjectId(userId) } },
        { $pull: { items: { productId: new Types.ObjectId(body.productId) } } },
      ],
      { upsert: true }
    );
    await Wishlist.updateOne(
      { userId },
      {
        $push: {
          items: {
            productId: new Types.ObjectId(body.productId),
            variantId: body.variantId ? new Types.ObjectId(body.variantId) : null,
          },
        },
      }
    );

    return c.json({ inWishlist: true }, 200);
  }
);

wishlistRouter.openapi(
  {
    method: 'delete',
    path: '/items/{productId}',
    tags: ['wishlist'],
    security: [{ Bearer: [] }],
    summary: 'Remove product from wishlist',
    request: { params: z.object({ productId: z.string() }) },
    responses: {
      200: {
        description: 'OK',
        content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } },
      },
    },
  },
  async (c) => {
    const productId = c.req.param('productId');
    await Wishlist.updateOne(
      { userId: c.get('user').sub },
      { $pull: { items: { productId: new Types.ObjectId(productId) } } }
    );
    return c.json({ ok: true }, 200);
  }
);
