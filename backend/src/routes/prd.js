import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError } from '../utils/httpError.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// backend/src/routes -> repo root
const PRD_PATH = path.resolve(here, '../../../atomic_system_architecture_prd.md');

export const prdRouter = Router();

/**
 * Serve the project PRD markdown. Public (documentation, no secrets) so it can be
 * opened or downloaded with a single click. Add ?download=1 to force a file save.
 */
prdRouter.get('/', async (req, res, next) => {
  try {
    let markdown;
    try {
      markdown = await readFile(PRD_PATH, 'utf8');
    } catch {
      throw new HttpError(404, 'PRD document is not available on this instance.');
    }
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', 'attachment; filename="atomic_system_architecture_prd.md"');
    }
    return res.send(markdown);
  } catch (error) {
    return next(error);
  }
});
