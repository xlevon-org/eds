import { Router } from 'express';
import { HttpError } from '../utils/httpError.js';

export const jobsRouter = Router();

const notImplemented = (req, _res, next) => {
  next(new HttpError(501, `Generation jobs are not implemented yet (${req.method} ${req.baseUrl}${req.path}).`));
};

jobsRouter.post('/', notImplemented);
jobsRouter.get('/:id', notImplemented);
jobsRouter.get('/:id/events', notImplemented);
