import Stripe from 'stripe';

import { env } from '../config/env';
import { Order } from '../models/Order';
import { confirmOrderPayment } from './order.service';
import { logger } from '../config/logger';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY);

// Stripe collects payment only (plan 5.3). Currency is USD (Stripe has no EGP).
export async function createPaymentIntent(orderId: string, amount: number): Promise<{ clientSecret: string }> {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'usd',
    metadata: { orderId },
  });

  await Order.updateOne({ _id: orderId }, { stripePaymentIntentId: paymentIntent.id });

  return { clientSecret: paymentIntent.client_secret! };
}

export async function handleStripeWebhook(rawBody: string, signature: string): Promise<{ received: true }> {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ err }, 'Stripe signature verification failed');
    throw new Error('Invalid signature');
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = intent.metadata.orderId;
    if (orderId) await confirmOrderPayment(orderId);
  }
  return { received: true };
}
