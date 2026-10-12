import { Router } from 'express';
import { ok } from '../utils/apiResponse.js';

export const foldersRouter = Router();

foldersRouter.get('/', (_req, res) => {
  ok(res, []);
});
