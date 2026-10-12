import { Router } from 'express';
import { ok } from '../utils/apiResponse.js';
import { HttpError } from '../utils/httpError.js';

export const handbooksRouter = Router();

handbooksRouter.get('/', (_req, res) => {
  ok(res, []);
});

handbooksRouter.put('/:id', (_req, _res, next) => {
  next(new HttpError(501, 'Handbook persistence is not implemented yet.'));
});

handbooksRouter.delete('/:id', (_req, _res, next) => {
  next(new HttpError(501, 'Handbook persistence is not implemented yet.'));
});
