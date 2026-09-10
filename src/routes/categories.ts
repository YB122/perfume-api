import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';

import { Category } from '../models/Category';

export const categoriesRouter = new OpenAPIHono();

const categorySchema = z.object({
  id: z.string(),
  name: z.object({ en: z.string(), fr: z.string(), ar: z.string() }),
  slug: z.object({ en: z.string(), fr: z.string(), ar: z.string() }),
});

categoriesRouter.openapi(
  {
    method: 'get',
    path: '/',
    tags: ['categories'],
    summary: 'List categories',
    responses: {
      200: {
        description: 'OK',
        content: { 'application/json': { schema: z.array(categorySchema) } },
      },
    },
  },
  async (c) => {
    const items = await Category.find({ deletedAt: null }).lean();
    return c.json(
      items.map((i: any) => ({ id: String(i._id), name: i.name, slug: i.slug })),
      200
    );
  }
);
