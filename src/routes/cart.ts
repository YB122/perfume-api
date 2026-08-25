import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { Types } from 'mongoose';

import { Cart } from '../models/Cart';
import { Product } from '../models/Product';
import { addToCartSchema, checkoutSchema } from '../schemas/order.schema';
import { authMiddleware, type AuthEnv } from '../lib/auth';
import { createOrderFromCart } from '../services/order.service';
import { createPaymentIntent } from '../services/payment.service';

export const cartRouter = new OpenAPIHono<AuthEnv>();
export const checkoutRouter = new OpenAPIHono<AuthEnv>();

cartRouter.use('*', authMiddleware);
checkoutRouter.use('*', authMiddleware);

cartRouter.openapi(
  {
    method: 'get',
    path: '/',
    tags: ['cart'],
    security: [{ Bearer: [] }],
    summary: 'Get customer cart',
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.any() } } } },
  },
  async (c) => {
    const cart = await Cart.findOne({ customerId: c.get('user').sub }).lean();
    return c.json((cart as any) ?? { items: [] }, 200);
  }
);

cartRouter.openapi(
  {
    method: 'post',
    path: '/items',
    tags: ['cart'],
    security: [{ Bearer: [] }],
    summary: 'Add item to cart',
    request: { body: { content: { 'application/json': { schema: addToCartSchema } } } },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.any() } } } },
  },
  async (c) => {
    const body = c.req.valid('json');
    const customerId = c.get('user').sub;
    const product = await Product.findOne({ _id: body.productId, deletedAt: null });
    const variant = product?.variants.find((v: any) => v._id.toString() === body.variantId);
    if (!product || !variant) return c.json({ error: 'Product/variant not found' }, 404) as any;

    const cart = await Cart.findOneAndUpdate(
      { customerId },
      {
        $setOnInsert: { customerId },
        $push: {
          items: {
            productId: product._id,
            variantId: variant._id,
            vendorId: product.vendorId,
            quantity: body.quantity,
            unitPrice: body.unitPrice ?? variant.price,
            variantLabel: body.variantLabel ?? `${variant.sizeMl}ml - ${variant.concentration}`,
          },
        },
      },
      { upsert: true, new: true }
    );
    return c.json(cart as any, 200);
  }
);

cartRouter.openapi(
  {
    method: 'delete',
    path: '/items/{variantId}',
    tags: ['cart'],
    security: [{ Bearer: [] }],
    summary: 'Remove cart item',
    request: { params: z.object({ variantId: z.string() }) },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } } } },
  },
  async (c) => {
    await Cart.updateOne({ customerId: c.get('user').sub }, { $pull: { items: { variantId: c.req.param('variantId') } } });
    return c.json({ ok: true }, 200);
  }
);

checkoutRouter.openapi(
  {
    method: 'post',
    path: '/',
    tags: ['checkout'],
    security: [{ Bearer: [] }],
    summary: 'Checkout (create order)',
    request: { body: { content: { 'application/json': { schema: checkoutSchema } } } },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.any() } } } },
  },
  async (c) => {
    const body = c.req.valid('json');
    const customerId = c.get('user').sub;

    let cart: { _id: Types.ObjectId; items: any[] };
    if (body.items && body.items.length) {
      cart = { _id: new Types.ObjectId(), items: body.items as any };
    } else {
      const dbCart = await Cart.findOne({ customerId });
      if (!dbCart || dbCart.items.length === 0) return c.json({ error: 'Cart is empty' }, 400) as any;
      cart = dbCart as any;
    }

    const order = await createOrderFromCart(cart as any, {
      customerId,
      paymentMethod: body.paymentMethod,
      shippingAddress: body.shippingAddress,
      idempotencyKey: body.idempotencyKey,
    });

    if (body.paymentMethod === 'card') {
      const { clientSecret } = await createPaymentIntent(String(order._id), order.totalAmount ?? 0);
      return c.json({ orderId: String(order._id), clientSecret, paymentMethod: 'card' }, 200);
    }
    return c.json({ orderId: String(order._id), paymentMethod: 'cash_on_delivery' }, 200);
  }
);
