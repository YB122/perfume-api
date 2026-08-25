import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';

import { Product } from '../models/Product';
import { createProductSchema, productFilterSchema } from '../schemas/product.schema';
import { authMiddleware, requireRole, requireVendorOwnership, localeMiddleware, type AuthEnv } from '../lib/auth';
import { localize } from '../lib/i18n';

export const productsRouter = new OpenAPIHono<AuthEnv>();

const listRoute = z
  .object({})
  .catchall(z.any());

const listProducts = productsRouter.openapi(
  {
    method: 'get',
    path: '/',
    tags: ['products'],
    summary: 'List public catalog',
    middleware: [localeMiddleware] as any,
    request: { query: productFilterSchema },
    responses: {
      200: {
        description: 'OK',
        content: {
          'application/json': {
            schema: z.object({ data: z.array(z.any()), page: z.number(), limit: z.number(), total: z.number() }),
          },
        },
      },
    },
  },
  async (c) => {
    const f = c.req.valid('query');
    const filter: Record<string, unknown> = { status: 'active', deletedAt: null };
    if (f.vendorId) filter.vendorId = f.vendorId;
    if (f.categoryId) filter.categoryIds = f.categoryId;
    if (f.q) filter.$text = { $search: f.q };

    const [items, total] = await Promise.all([
      Product.find(filter).skip((f.page - 1) * f.limit).limit(f.limit).lean(),
      Product.countDocuments(filter),
    ]);

    const data = (items as any[]).map((p) => ({
      id: String(p._id),
      name: localize(p.name, c),
      brand: p.brand,
      ratingAverage: p.ratingAverage,
      variants: p.variants.map((v: any) => ({
        id: String(v._id),
        sizeMl: v.sizeMl,
        concentration: v.concentration,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        images: v.images,
      })),
    }));
    return c.json({ data, page: f.page, limit: f.limit, total }, 200);
  }
);

const getProduct = productsRouter.openapi(
  {
    method: 'get',
    path: '/{id}',
    tags: ['products'],
    summary: 'Get a product',
    middleware: [localeMiddleware] as any,
    request: { params: z.object({ id: z.string() }), query: z.object({ lang: z.enum(['en', 'fr', 'ar']).optional() }) },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.any() } } }, 404: { description: 'Not found' } },
  },
  async (c) => {
    const p = await Product.findOne({ _id: c.req.param('id'), deletedAt: null }).lean();
    if (!p) return c.json({ error: 'Not found' }, 404) as any;
    const pp = p as any;
    return c.json(
      { id: String(pp._id), name: localize(pp.name, c), description: localize(pp.description, c), brand: pp.brand, variants: pp.variants },
      200
    );
  }
);

const createProduct = productsRouter.openapi(
  {
    method: 'post',
    path: '/',
    tags: ['products'],
    security: [{ Bearer: [] }],
    summary: 'Create a product (vendor)',
    middleware: [authMiddleware, requireRole('vendor_admin', 'vendor_staff', 'super_admin')] as any,
    request: { body: { content: { 'application/json': { schema: createProductSchema } } } },
    responses: { 201: { description: 'Created', content: { 'application/json': { schema: z.object({ id: z.string() }) } } } },
  },
  async (c) => {
    const data = c.req.valid('json');
    const vendorId = c.get('user').vendorId ?? c.req.query('vendorId');
    if (!vendorId) return c.json({ error: 'vendorId required' }, 400) as any;
    const product = await Product.create({ ...data, vendorId });
    return c.json({ id: String(product._id) }, 201);
  }
);

const listVendorProducts = productsRouter.openapi(
  {
    method: 'get',
    path: '/vendor/{vendorId}',
    tags: ['products'],
    security: [{ Bearer: [] }],
    summary: 'List a vendor products',
    middleware: [authMiddleware, requireRole('vendor_admin', 'vendor_staff', 'super_admin'), requireVendorOwnership] as any,
    request: { params: z.object({ vendorId: z.string() }) },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.array(z.any()) } } } },
  },
  async (c) => {
    const items = await Product.find({ vendorId: c.req.param('vendorId'), deletedAt: null }).lean();
    return c.json(items as any, 200);
  }
);

void listRoute;
