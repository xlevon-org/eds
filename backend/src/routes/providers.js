import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ok } from '../utils/apiResponse.js';
import { HttpError } from '../utils/httpError.js';
import { workerClient } from '../services/workerClient.js';

export const providersRouter = Router();
providersRouter.use(requireAuth);

providersRouter.get('/status', async (req, res, next) => {
  try {
    const result = await workerClient.providerStatus();
    return ok(res, result.data);
  } catch (error) {
    return next(error);
  }
});

providersRouter.get('/status/:capability', async (req, res, next) => {
  try {
    const result = await workerClient.providerStatusFor(req.params.capability);
    return ok(res, result.data);
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    return next(new HttpError(502, error.message));
  }
});
