import { Hono } from 'hono';

import { handleStripeWebhook } from '../services/payment.service';

export const webhooksRouter = new Hono();

webhooksRouter.post('/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) return c.json({ error: 'Missing signature' }, 400);
  const rawBody = await c.req.text();
  try {
    const result = await handleStripeWebhook(rawBody, signature);
    return c.json(result);
  } catch {
    return c.json({ error: 'Invalid signature' }, 400);
  }
});
