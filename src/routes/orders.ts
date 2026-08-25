import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';

import { Order } from '../models/Order';
import { PayoutBatch } from '../models/PayoutBatch';
import { authMiddleware, requireRole, requireVendorOwnership, type AuthEnv } from '../lib/auth';
import { transitionSubOrder } from '../services/order-state-machine';
import { SUB_ORDER_STATUSES } from '../models/Order';

export const ordersRouter = new OpenAPIHono<AuthEnv>();

ordersRouter.use('*', authMiddleware);

ordersRouter.openapi(
  {
    method: 'get',
    path: '/me',
    tags: ['orders'],
    security: [{ Bearer: [] }],
    summary: 'Customer orders',
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.array(z.any()) } } } },
  },
  async (c) => {
    const orders = await Order.find({ customerId: c.get('user').sub }).lean();
    return c.json(orders as any, 200);
  }
);

ordersRouter.openapi(
  {
    method: 'get',
    path: '/{id}',
    tags: ['orders'],
    security: [{ Bearer: [] }],
    summary: 'Order detail',
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.any() } } }, 404: { description: 'Not found' } },
  },
  async (c) => {
    const order = await Order.findOne({ _id: c.req.param('id'), customerId: c.get('user').sub }).lean();
    if (!order) return c.json({ error: 'Not found' }, 404) as any;
    return c.json(order as any, 200);
  }
);

ordersRouter.openapi(
  {
    method: 'get',
    path: '/vendor/{vendorId}',
    tags: ['orders'],
    security: [{ Bearer: [] }],
    summary: 'Vendor sub-orders',
    middleware: [requireRole('vendor_admin', 'vendor_staff', 'super_admin'), requireVendorOwnership] as any,
    request: { params: z.object({ vendorId: z.string() }) },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.array(z.any()) } } } },
  },
  async (c) => {
    const orders = await Order.find({ 'subOrders.vendorId': c.req.param('vendorId') }).lean();
    return c.json(orders as any, 200);
  }
);

ordersRouter.openapi(
  {
    method: 'post',
    path: '/{orderId}/sub-orders/{subOrderId}/transition',
    tags: ['orders'],
    security: [{ Bearer: [] }],
    summary: 'Transition a sub-order status',
    middleware: [requireRole('vendor_admin', 'vendor_staff', 'super_admin'), requireVendorOwnership] as any,
    request: {
      params: z.object({ orderId: z.string(), subOrderId: z.string() }),
      query: z.object({ to: z.enum(SUB_ORDER_STATUSES) }),
    },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.object({ status: z.string() }) } } } },
  },
  async (c) => {
    const { orderId, subOrderId } = c.req.valid('param');
    const next = c.req.valid('query').to;
    const order = await Order.findOne({ _id: orderId, 'subOrders._id': subOrderId });
    if (!order) return c.json({ error: 'Not found' }, 404) as any;
    const sub = order.subOrders.find((s) => s._id.toString() === subOrderId);
    if (!sub) return c.json({ error: 'Sub-order not found' }, 404) as any;
    transitionSubOrder(sub.status, next);
    sub.status = next;
    await order.save();
    return c.json({ status: next }, 200);
  }
);

ordersRouter.openapi(
  {
    method: 'get',
    path: '/vendor/{vendorId}/payouts',
    tags: ['orders'],
    security: [{ Bearer: [] }],
    summary: 'Vendor payout batches',
    middleware: [requireRole('vendor_admin', 'super_admin'), requireVendorOwnership] as any,
    request: { params: z.object({ vendorId: z.string() }) },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.array(z.any()) } } } },
  },
  async (c) => {
    const batches = await PayoutBatch.find({ vendorId: c.req.param('vendorId') }).lean();
    return c.json(batches as any, 200);
  }
);
