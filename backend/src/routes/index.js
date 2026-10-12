import { Router } from 'express';
import { healthRouter } from './health.js';
import { handbooksRouter } from './handbooks.js';
import { foldersRouter } from './folders.js';
import { jobsRouter } from './jobs.js';
import { env } from '../config/env.js';

export const router = Router();

router.use('/health', healthRouter);

router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: { name: 'up-api', version: '0.1.0', apiBase: '/api/v1', environment: env.nodeEnv },
  });
});

const apiV1 = Router();
apiV1.use('/handbooks', handbooksRouter);
apiV1.use('/folders', foldersRouter);
apiV1.use('/jobs', jobsRouter);

router.use('/api/v1', apiV1);
