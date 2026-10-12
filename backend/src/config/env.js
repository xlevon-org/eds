import 'dotenv/config';

const asBool = (value, fallback) =>
  value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());

const asList = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const nodeEnv = process.env.NODE_ENV || 'development';
const port = Number(process.env.PORT || 5000);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isDevelopment: nodeEnv === 'development',
  port,
  publicBaseUrl,
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES || '7d',
  corsAllowedOrigins: asList(process.env.CORS_ALLOWED_ORIGINS, ['http://localhost:3000']),
  corsAllowNoOrigin: asBool(process.env.CORS_ALLOW_NO_ORIGIN, true),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 50),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'up',
  },
  worker: {
    baseUrl: process.env.WORKER_BASE_URL || 'http://localhost:8000',
    apiKey: process.env.WORKER_API_KEY || '',
  },
};

export function assertProductionConfig() {
  if (!env.isProduction) return;
  const problems = [];
  if (!env.mongoUri) problems.push('MONGODB_URI is required in production');
  if (env.jwtSecret.length < 32) problems.push('JWT_SECRET must be at least 32 characters in production');
  if (env.corsAllowedOrigins.length === 0) problems.push('CORS_ALLOWED_ORIGINS must be set in production');
  if (problems.length > 0) {
    throw new Error(`Invalid production configuration:\n- ${problems.join('\n- ')}`);
  }
}
