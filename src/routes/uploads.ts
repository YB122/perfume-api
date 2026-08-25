import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { fileTypeFromBuffer } from 'file-type';

import { cloudinary } from '../config/cloudinary';
import { authMiddleware, requireRole, type AuthEnv } from '../lib/auth';
import { env } from '../config/env';
import { logger } from '../config/logger';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

export const uploadsRouter = new OpenAPIHono<AuthEnv>();

// Signed upload for direct browser -> Cloudinary (plan 3.4)
uploadsRouter.openapi(
  {
    method: 'post',
    path: '/signature',
    tags: ['uploads'],
    security: [{ Bearer: [] }],
    summary: 'Cloudinary signed upload params',
    middleware: [authMiddleware, requireRole('vendor_admin', 'vendor_staff', 'super_admin')] as any,
    responses: {
      200: {
        description: 'OK',
        content: {
          'application/json': {
            schema: z.object({
              signature: z.string(),
              timestamp: z.number(),
              folder: z.string(),
              apiKey: z.string(),
              cloudName: z.string(),
            }),
          },
        },
      },
    },
  },
  async (c) => {
    const timestamp = Math.round(Date.now() / 1000);
    const vendorId = c.get('user').vendorId ?? 'global';
    const folder = `vendors/${vendorId}/products`;

    const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, env.CLOUDINARY_API_SECRET);

    return c.json({ signature, timestamp, folder, apiKey: env.CLOUDINARY_API_KEY, cloudName: env.CLOUDINARY_CLOUD_NAME }, 200);
  }
);

// Server-side image upload: validates the real file bytes with `file-type`,
// enforces jpg/png/webp and a 5MB cap before proxying to Cloudinary (plan req #8/#9).
uploadsRouter.post(
  '/image',
  authMiddleware,
  requireRole('vendor_admin', 'vendor_staff', 'super_admin'),
  async (c) => {
    const body = await c.req.parseBody({ all: true });
    const file = body['file'];
    if (!(file instanceof File)) return c.json({ error: 'No file provided' }, 400);

    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.length > MAX_UPLOAD_BYTES) {
      return c.json({ error: 'File too large (max 5MB)' }, 413);
    }

    const type = await fileTypeFromBuffer(buffer);
    if (!type || !ALLOWED_IMAGE_TYPES.includes(type.mime)) {
      return c.json({ error: 'Only JPG, PNG or WEBP images are allowed' }, 415);
    }

    const vendorId = c.get('user').vendorId ?? 'global';
    const folder = `vendors/${vendorId}/products`;

    try {
      const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: 'image' },
          (err, res) => (err ? reject(err) : resolve(res))
        );
        stream.end(buffer);
      });
      logger.info({ publicId: result.public_id }, 'image uploaded');
      return c.json({ url: result.secure_url, cloudinaryPublicId: result.public_id }, 201);
    } catch (err) {
      logger.error({ err }, 'cloudinary upload failed');
      return c.json({ error: 'Upload failed' }, 502);
    }
  }
);
