import { Router } from 'express';
import { healthRouter } from './health.js';
import { authRouter } from './auth.js';
import { templatesRouter } from './templates.js';
import { documentsRouter } from './documents.js';
import { jobsRouter } from './jobs.js';
import { kbRouter } from './kb.js';
import { providersRouter } from './providers.js';
import { prdRouter } from './prd.js';
import { env } from '../config/env.js';

export const router = Router();

router.use('/health', healthRouter);
router.use('/api/v1/prd', prdRouter);

router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: { name: 'up-api', version: '0.1.0', apiBase: '/api/v1', environment: env.nodeEnv },
  });
});

const apiV1 = Router();
apiV1.use('/auth', authRouter);
apiV1.use('/templates', templatesRouter);
apiV1.use('/documents', documentsRouter);
apiV1.use('/jobs', jobsRouter);
apiV1.use('/kb', kbRouter);
apiV1.use('/providers', providersRouter);

router.use('/api/v1', apiV1);
