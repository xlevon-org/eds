import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export function cloudinaryConnect() {
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    logger.warn('Cloudinary credentials are not set; media upload is disabled.');
    return { configured: false };
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  logger.info(`Cloudinary configured for cloud "${cloudName}".`);
  return { configured: true };
}

export { cloudinary };
