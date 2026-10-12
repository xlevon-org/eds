import { Router } from 'express';
import { KbChunk, KbSource } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { ok, created } from '../utils/apiResponse.js';
import { requireAuth } from '../middleware/auth.js';
import { workerClient } from '../services/workerClient.js';

export const kbRouter = Router();
kbRouter.use(requireAuth);

function chunkText(text, size = 800) {
  const clean = String(text || '').replace(/\r/g, '').trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n{2,}/).flatMap((p) => (p.length > size ? p.match(new RegExp(`.{1,${size}}`, 'gs')) : [p]));
  return paragraphs.map((p) => p.trim()).filter(Boolean);
}

kbRouter.post('/sources', async (req, res, next) => {
  try {
    const { name, type = 'TEXT', text = '', materials = [], tags = [] } = req.body || {};
    if (!name) throw new HttpError(422, 'name is required.');

    let content = text;
    let resolvedType = type;
    if (Array.isArray(materials) && materials.length) {
      const extracted = await workerClient.extractMaterials(materials);
      content = extracted.data.text || '';
      if (materials[0]?.type) resolvedType = String(materials[0].type).toUpperCase();
    }

    const source = await KbSource.create({ ownerId: req.user.id, name, type: resolvedType, text: content, status: 'indexed' });
    const pieces = chunkText(content);
    const chunks = await KbChunk.insertMany(
      pieces.map((p) => ({ ownerId: req.user.id, sourceId: source._id, content: p, tags, assetType: 'TEXT' }))
    );
    source.chunkCount = chunks.length;
    await source.save();
    return created(res, { source, chunkCount: chunks.length });
  } catch (error) {
    return next(error);
  }
});

kbRouter.get('/sources', async (req, res, next) => {
  try {
    const sources = await KbSource.find({ ownerId: req.user.id }).sort({ createdAt: -1 });
    return ok(res, sources);
  } catch (error) {
    return next(error);
  }
});

kbRouter.get('/sources/:id', async (req, res, next) => {
  try {
    const source = await KbSource.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!source) throw new HttpError(404, 'Source not found.');
    const chunks = await KbChunk.find({ sourceId: source._id }).sort({ createdAt: 1 });
    return ok(res, { source, chunks });
  } catch (error) {
    return next(error);
  }
});

kbRouter.delete('/sources/:id', async (req, res, next) => {
  try {
    const source = await KbSource.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id });
    if (!source) throw new HttpError(404, 'Source not found.');
    await KbChunk.deleteMany({ sourceId: source._id, ownerId: req.user.id });
    return ok(res, { deleted: true });
  } catch (error) {
    return next(error);
  }
});

kbRouter.get('/chunks', async (req, res, next) => {
  try {
    const filter = { ownerId: req.user.id };
    if (req.query.tag) filter.tags = req.query.tag;
    if (req.query.assetType) filter.assetType = req.query.assetType;
    if (req.query.sourceId) filter.sourceId = req.query.sourceId;
    const chunks = await KbChunk.find(filter).sort({ createdAt: -1 }).limit(500);
    return ok(res, chunks);
  } catch (error) {
    return next(error);
  }
});

kbRouter.put('/chunks/:id', async (req, res, next) => {
  try {
    const { content, tags, references, assetType } = req.body || {};
    const chunk = await KbChunk.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!chunk) throw new HttpError(404, 'Chunk not found.');
    if (content !== undefined) chunk.content = content;
    if (tags !== undefined) chunk.tags = tags;
    if (references !== undefined) chunk.references = references;
    if (assetType !== undefined) chunk.assetType = assetType;
    await chunk.save();
    return ok(res, chunk);
  } catch (error) {
    return next(error);
  }
});

kbRouter.delete('/chunks/:id', async (req, res, next) => {
  try {
    const result = await KbChunk.deleteOne({ _id: req.params.id, ownerId: req.user.id });
    if (!result.deletedCount) throw new HttpError(404, 'Chunk not found.');
    return ok(res, { deleted: true });
  } catch (error) {
    return next(error);
  }
});

kbRouter.get('/tags', async (req, res, next) => {
  try {
    const tags = await KbChunk.distinct('tags', { ownerId: req.user.id });
    return ok(res, tags.sort());
  } catch (error) {
    return next(error);
  }
});

kbRouter.post('/search', async (req, res, next) => {
  try {
    const { query = '', tags = [], assetType, topK = 8 } = req.body || {};
    const filter = { ownerId: req.user.id };
    if (Array.isArray(tags) && tags.length) filter.tags = { $in: tags };
    if (assetType) filter.assetType = assetType;
    const candidates = await KbChunk.find(filter).limit(500);
    const keywords = String(query).toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const scored = candidates
      .map((chunk) => {
        const hay = chunk.content.toLowerCase();
        const score = keywords.reduce((acc, w) => acc + (hay.includes(w) ? 1 : 0), 0);
        return { score, chunk };
      })
      .filter((s) => s.score > 0 || keywords.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Number(topK));
    return ok(res, { method: 'keyword-bm25-proxy', results: scored.map((s) => ({ score: s.score, chunk: s.chunk })) });
  } catch (error) {
    return next(error);
  }
});
