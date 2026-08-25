import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';

import { Review } from '../models/Review';
import { Order } from '../models/Order';
import { authMiddleware, type AuthEnv } from '../lib/auth';

export const reviewsRouter = new OpenAPIHono<AuthEnv>();

reviewsRouter.use('*', authMiddleware);

reviewsRouter.openapi(
  {
    method: 'post',
    path: '/',
    tags: ['reviews'],
    security: [{ Bearer: [] }],
    summary: 'Create a verified-purchase review',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              productId: z.string(),
              orderId: z.string(),
              rating: z.number().min(1).max(5),
              title: z.string().optional(),
              body: z.string().optional(),
              locale: z.enum(['en', 'fr', 'ar']).optional(),
            }),
          },
        },
      },
    },
    responses: { 201: { description: 'Created', content: { 'application/json': { schema: z.object({ id: z.string() }) } } } },
  },
  async (c) => {
    const body = c.req.valid('json');
    const customerId = c.get('user').sub;
    const verified = await Order.findOne({
      _id: body.orderId,
      customerId,
      'subOrders.items.productId': body.productId,
    });
    if (!verified) return c.json({ error: 'Purchase not verified' }, 403) as any;
    const review = await Review.create({ ...body, customerId });
    return c.json({ id: String(review._id) }, 201);
  }
);

reviewsRouter.openapi(
  {
    method: 'get',
    path: '/product/{productId}',
    tags: ['reviews'],
    summary: 'List product reviews',
    request: { params: z.object({ productId: z.string() }) },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.array(z.any()) } } } },
  },
  async (c) => {
    const reviews = await Review.find({ productId: c.req.param('productId') }).lean();
    return c.json(reviews as any, 200);
  }
);
