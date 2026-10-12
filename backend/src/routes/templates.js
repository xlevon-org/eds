import { Router } from 'express';
import { Template } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { ok, created } from '../utils/apiResponse.js';
import { requireAuth } from '../middleware/auth.js';
import { validateTemplate } from '../services/templateValidator.js';
import { workerClient } from '../services/workerClient.js';

export const templatesRouter = Router();
templatesRouter.use(requireAuth);

templatesRouter.get('/', async (req, res, next) => {
  try {
    const filter = { ownerId: req.user.id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.publicationType) filter.publicationType = req.query.publicationType;
    const templates = await Template.find(filter).sort({ updatedAt: -1 });
    return ok(res, templates);
  } catch (error) {
    return next(error);
  }
});

templatesRouter.post('/validate', (req, res, next) => {
  try {
    const problems = validateTemplate(req.body?.template || req.body);
    return ok(res, { valid: problems.length === 0, problems });
  } catch (error) {
    return next(error);
  }
});

templatesRouter.post('/preview', async (req, res, next) => {
  try {
    const template = req.body?.template || req.body;
    const problems = validateTemplate(template);
    if (problems.length) throw new HttpError(422, 'Template validation failed.', { problems });
    const variant = req.body?.variant || 'STUDENT';
    const result = await workerClient.renderHtml({ template, variant });
    return ok(res, result.data);
  } catch (error) {
    return next(error);
  }
});

/** Measure fit for an unsaved draft (DOM preflight and/or real-PDF verification). */
templatesRouter.post('/fit', async (req, res, next) => {
  try {
    const template = req.body?.template || req.body;
    const problems = validateTemplate(template);
    if (problems.length) throw new HttpError(422, 'Template validation failed.', { problems });
    const scope = ['html', 'pdf', 'both'].includes(req.body?.scope) ? req.body.scope : 'html';
    const result = await workerClient.fitCheck({
      template,
      variant: req.body?.variant || 'STUDENT',
      scope,
    });
    return ok(res, result.data);
  } catch (error) {
    return next(error);
  }
});

templatesRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const problems = validateTemplate(body);
    if (problems.length) throw new HttpError(422, 'Template validation failed.', { problems });
    const template = await Template.create({ ...body, ownerId: req.user.id });
    return created(res, template);
  } catch (error) {
    return next(error);
  }
});

templatesRouter.get('/:id', async (req, res, next) => {
  try {
    const template = await Template.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!template) throw new HttpError(404, 'Template not found.');
    return ok(res, template);
  } catch (error) {
    return next(error);
  }
});

templatesRouter.put('/:id', async (req, res, next) => {
  try {
    const body = req.body || {};
    const problems = validateTemplate(body);
    if (problems.length) throw new HttpError(422, 'Template validation failed.', { problems });
    const template = await Template.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!template) throw new HttpError(404, 'Template not found.');
    const expected = body.version;
    if (expected !== undefined && Number(expected) !== template.version) {
      throw new HttpError(409, 'Template was modified by another session.', { current: template.version });
    }
    const { _id, ownerId, createdAt, ...updates } = body;
    Object.assign(template, updates, { version: template.version + 1 });
    await template.save();
    return ok(res, template);
  } catch (error) {
    return next(error);
  }
});

templatesRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await Template.deleteOne({ _id: req.params.id, ownerId: req.user.id });
    if (!result.deletedCount) throw new HttpError(404, 'Template not found.');
    return ok(res, { deleted: true });
  } catch (error) {
    return next(error);
  }
});

templatesRouter.post('/:id/duplicate', async (req, res, next) => {
  try {
    const source = await Template.findOne({ _id: req.params.id, ownerId: req.user.id }).lean();
    if (!source) throw new HttpError(404, 'Template not found.');
    delete source._id;
    delete source.createdAt;
    delete source.updatedAt;
    const copy = await Template.create({ ...source, name: `${source.name} (copy)`, ownerId: req.user.id, version: 1 });
    return created(res, copy);
  } catch (error) {
    return next(error);
  }
});

templatesRouter.post('/:id/render', async (req, res, next) => {
  try {
    const template = await Template.findOne({ _id: req.params.id, ownerId: req.user.id }).lean();
    if (!template) throw new HttpError(404, 'Template not found.');
    const variant = req.body?.variant || 'STUDENT';
    const result = await workerClient.renderHtml({ template, variant });
    return ok(res, result.data);
  } catch (error) {
    return next(error);
  }
});
