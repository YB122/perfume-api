import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { Vendor } from '../models/Vendor';
import { authMiddleware, requireRole, type AuthEnv } from '../lib/auth';

export const adminRouter = new Hono<AuthEnv>();

adminRouter.use('*', authMiddleware, requireRole('super_admin'));

adminRouter.get('/vendors', async (c) => {
  const vendors = await Vendor.find({ deletedAt: null }).lean();
  return c.json(vendors);
});

adminRouter.post(
  '/vendors/:id/approve',
  zValidator('param', z.object({ id: z.string() })),
  async (c) => {
    const vendor = await Vendor.findByIdAndUpdate(c.req.param('id'), { status: 'approved' }, { new: true });
    return c.json(vendor);
  }
);

adminRouter.post('/vendors/:id/reject', async (c) => {
  const vendor = await Vendor.findByIdAndUpdate(c.req.param('id'), { status: 'rejected' }, { new: true });
  return c.json(vendor);
});

adminRouter.post('/commission-rules', zValidator('json', z.object({ vendorId: z.string(), rate: z.number() })), async (c) => {
  const { vendorId, rate } = c.req.valid('json');
  const vendor = await Vendor.findByIdAndUpdate(vendorId, { commissionRate: rate }, { new: true });
  return c.json(vendor);
});
