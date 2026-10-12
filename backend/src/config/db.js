import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDB() {
  if (!env.mongoUri) {
    const message = 'MONGODB_URI is not set; skipping database connection.';
    if (env.isProduction) throw new Error(message);
    logger.warn(message);
    return { connected: false };
  }

  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
    logger.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    return { connected: true };
  } catch (error) {
    if (env.isProduction) throw error;
    logger.warn(`MongoDB connection failed (non-fatal in development): ${error.message}`);
    return { connected: false };
  }
}

export function dbStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
}
