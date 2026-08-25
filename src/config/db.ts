import mongoose from 'mongoose';

import { env } from './env';
import { logger } from './logger';

let connected = false;

export async function connectDb(): Promise<void> {
  if (connected) return;
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);
  connected = true;
  logger.info('MongoDB connected');
}

export async function disconnectDb(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}
