import { Router } from 'express';
import { Document, Job, KbChunk, Template, Revision } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { ok, created } from '../utils/apiResponse.js';
import { requireAuth } from '../middleware/auth.js';
import { workerClient } from '../services/workerClient.js';

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

documentsRouter.get('/', async (req, res, next) => {
  try {
    const filter = { ownerId: req.user.id };
    if (req.query.templateId) filter.templateId = req.query.templateId;
    if (req.query.status) filter.status = req.query.status;
    const docs = await Document.find(filter).sort({ updatedAt: -1 }).limit(200);
    return ok(res, docs);
  } catch (error) {
    return next(error);
  }
});

documentsRouter.post('/generate', async (req, res, next) => {
  try {
    const { templateId, variant = 'STUDENT', instruction = '', materials = [], kbChunkIds = [] } = req.body || {};
    if (!templateId) throw new HttpError(422, 'templateId is required.');
    const template = await Template.findOne({ _id: templateId, ownerId: req.user.id }).lean();
    if (!template) throw new HttpError(404, 'Template not found.');

    const status = await workerClient.providerStatusFor('text');
    if (!status.data?.configured) {
      throw new HttpError(409, `AI text provider is not configured: ${status.data?.reason || 'unknown'}`);
    }

    let kbChunks = [];
    if (Array.isArray(kbChunkIds) && kbChunkIds.length) {
      kbChunks = await KbChunk.find({ _id: { $in: kbChunkIds }, ownerId: req.user.id }).lean();
    }

    const document = await Document.create({
      ownerId: req.user.id,
      title: template.name,
      templateId: template._id,
      templateVersion: template.version,
      variant,
      status: 'generating',
      content: template,
    });

    const job = await Job.create({
      ownerId: req.user.id,
      type: 'generate',
      status: 'queued',
      documentId: document._id,
      input: { instruction, variant, materials, kbChunkIds },
    });

    const workerJob = await workerClient.createJob({
      request: { template, variant, instruction, materials, kbChunks },
    });
    job.workerJobId = workerJob.data.jobId;
    await job.save();

    return created(res, { jobId: job.id, documentId: document.id, workerJobId: job.workerJobId });
  } catch (error) {
    return next(error);
  }
});

documentsRouter.get('/:id', async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!doc) throw new HttpError(404, 'Document not found.');
    return ok(res, doc);
  } catch (error) {
    return next(error);
  }
});

documentsRouter.post('/:id/render', async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!doc) throw new HttpError(404, 'Document not found.');
    if (!doc.content || !doc.content.sections) throw new HttpError(409, 'Document has no renderable content yet.');
    const result = await workerClient.renderHtml({ template: doc.content, variant: doc.variant });
    return ok(res, result.data);
  } catch (error) {
    return next(error);
  }
});

/**
 * Measure content fit for a stored document without exporting: DOM preflight
 * (html), real-PDF verification (pdf), or both. Persists the merged report to
 * document.fidelity.fit so the Documents list can show it.
 */
documentsRouter.post('/:id/fit', async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!doc) throw new HttpError(404, 'Document not found.');
    if (!doc.content || !doc.content.sections) throw new HttpError(409, 'Document has no renderable content yet.');
    const scope = ['html', 'pdf', 'both'].includes(req.body?.scope) ? req.body.scope : 'html';
    const result = await workerClient.fitCheck({ template: doc.content, variant: doc.variant, scope });
    doc.fidelity = { ...(doc.fidelity || {}), fit: { ...((doc.fidelity || {}).fit || {}), ...(result.data.fit || {}) } };
    doc.markModified('fidelity');
    await doc.save();
    return ok(res, { fit: result.data.fit, scope, document: doc });
  } catch (error) {
    return next(error);
  }
});

documentsRouter.post('/:id/pdf', async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!doc) throw new HttpError(404, 'Document not found.');
    if (!doc.content || !doc.content.sections) throw new HttpError(409, 'Document has no renderable content yet.');
    const { buffer } = await workerClient.renderPdf({ template: doc.content, variant: doc.variant });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.id}.pdf"`);
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
});

documentsRouter.get('/:id/artifact', async (req, res, next) => {
  try {
    const format = req.query.format === 'pdf' ? 'pdf' : 'html';
    const doc = await Document.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!doc) throw new HttpError(404, 'Document not found.');
    const name = doc.artifacts?.[format];
    if (!name) throw new HttpError(404, `No ${format} artifact is available yet.`);
    const { buffer } = await workerClient.fetchArtifact(name);
    res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${doc.id}.${format}"`);
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
});

documentsRouter.get('/:id/revisions', async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!doc) throw new HttpError(404, 'Document not found.');
    const revisions = await Revision.find({ documentId: doc._id }).sort({ versionNum: -1 });
    return ok(res, revisions);
  } catch (error) {
    return next(error);
  }
});

documentsRouter.post('/:id/revisions', async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!doc) throw new HttpError(404, 'Document not found.');
    const versionNum = doc.revision;
    const existing = await Revision.findOne({ documentId: doc._id, versionNum });
    if (!existing) {
      await Revision.create({
        documentId: doc._id,
        versionNum,
        snapshot: { content: doc.content, artifacts: doc.artifacts },
        changelog: req.body?.changelog || 'snapshot',
        authorId: req.user.id,
      });
    }
    doc.revision = versionNum + 1;
    await doc.save();
    return created(res, { revision: doc.revision, snapshotVersion: versionNum });
  } catch (error) {
    return next(error);
  }
});

documentsRouter.post('/:id/rollback', async (req, res, next) => {
  try {
    const { revisionId } = req.body || {};
    const doc = await Document.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!doc) throw new HttpError(404, 'Document not found.');
    const revision = await Revision.findOne({ _id: revisionId, documentId: doc._id });
    if (!revision) throw new HttpError(404, 'Revision not found.');
    doc.content = revision.snapshot.content;
    doc.artifacts = revision.snapshot.artifacts || doc.artifacts;
    await Revision.create({
      documentId: doc._id,
      versionNum: doc.revision,
      snapshot: { content: doc.content, artifacts: doc.artifacts },
      changelog: `rollback to v${revision.versionNum}`,
      authorId: req.user.id,
    });
    doc.revision += 1;
    await doc.save();
    return ok(res, doc);
  } catch (error) {
    return next(error);
  }
});

function findComponent(section, componentId) {
  const stack = [...(section.components || [])];
  while (stack.length) {
    const node = stack.shift();
    if (node.id === componentId) return node;
    if (Array.isArray(node.children)) stack.push(...node.children);
  }
  return null;
}

documentsRouter.post('/:id/edit-block', async (req, res, next) => {
  try {
    const { sectionId, componentId, props = {}, aiInstruction } = req.body || {};
    const doc = await Document.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!doc) throw new HttpError(404, 'Document not found.');
    const section = (doc.content?.sections || []).find((s) => s.id === sectionId);
    if (!section) throw new HttpError(404, 'Section not found.');
    const component = findComponent(section, componentId);
    if (!component) throw new HttpError(404, 'Component not found.');
    component.props = { ...(component.props || {}), ...props };
    if (aiInstruction) component.aiInstruction = aiInstruction;
    doc.markModified('content');
    doc.revision += 1;
    await doc.save();
    return ok(res, { document: doc, patched: { sectionId, componentId } });
  } catch (error) {
    return next(error);
  }
});
