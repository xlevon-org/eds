import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { router } from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

function corsOrigin(origin, callback) {
  if (!origin) {
    return callback(null, env.corsAllowNoOrigin);
  }
  const allowed = env.corsAllowedOrigins.includes(origin);
  return callback(allowed ? null : new Error(`Origin not allowed by CORS: ${origin}`), allowed);
}

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: `${env.maxUploadMb}mb` }));
  app.use(express.urlencoded({ extended: true, limit: `${env.maxUploadMb}mb` }));
  app.use(cookieParser());

  app.use(router);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
