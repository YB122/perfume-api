import { writeFileSync } from 'fs';

import { app } from './app';
import { logger } from './config/logger';

// Dump the spec to disk so it can be committed / served to the frontend generators.
const spec = await app.getOpenAPIDocument({
  openapi: '3.1.0',
  info: { title: 'Perfume Marketplace API', version: '1.0.0' },
  servers: [{ url: 'http://localhost:4000' }],
});

writeFileSync('openapi.json', JSON.stringify(spec, null, 2));
logger.info('Wrote openapi.json');
