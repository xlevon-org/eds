import { Router } from 'express';
import { dbStatus } from '../config/db.js';
import { env } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'up-backend',
      version: '0.1.0',
      environment: env.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      database: dbStatus(),
    },
  });
});
