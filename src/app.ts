import { OpenAPIHono } from '@hono/zod-openapi';

import { env } from './config/env';
import { setupSecurity } from './middleware/security';
import { authRouter } from './routes/auth';
import { productsRouter } from './routes/products';
import { cartRouter, checkoutRouter } from './routes/cart';
import { ordersRouter } from './routes/orders';
import { uploadsRouter } from './routes/uploads';
import { webhooksRouter } from './routes/webhooks';
import { adminRouter } from './routes/admin';
import { reviewsRouter } from './routes/reviews';
import { wishlistRouter } from './routes/wishlist';
import { categoriesRouter } from './routes/categories';
import { logger } from './config/logger';

export const app = new OpenAPIHono();

setupSecurity(app);

app.get('/health', (c) => c.json({ status: 'ok', ts: Date.now() }));

app.route('/v1/auth', authRouter);
app.route('/v1/products', productsRouter);
app.route('/v1/cart', cartRouter);
app.route('/v1/checkout', checkoutRouter);
app.route('/v1/orders', ordersRouter);
app.route('/v1/uploads', uploadsRouter);
app.route('/v1/admin', adminRouter);
app.route('/v1/reviews', reviewsRouter);
app.route('/v1/wishlist', wishlistRouter);
app.route('/v1/categories', categoriesRouter);
app.route('/webhooks', webhooksRouter);

// Live OpenAPI spec consumed by the frontends via `openapi-typescript` (plan 1.5)
app.doc31('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Perfume Marketplace API',
    version: '1.0.0',
    description: 'Multi-vendor perfume marketplace (MongoDB + Stripe + Cloudinary)',
  },
  servers: [{ url: env.API_BASE_URL }],
});

// Global error handler
app.onError((err, c) => {
  logger.error({ err }, 'Unhandled error');
  const detail = env.NODE_ENV === 'production' ? undefined : (err as Error)?.message;
  const stack = env.NODE_ENV === 'production' ? undefined : (err as Error)?.stack;
  return c.json({ error: 'Internal server error', detail, stack }, 500);
});

export type AppType = typeof app;
