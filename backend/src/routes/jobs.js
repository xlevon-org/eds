import { Router } from 'express';
import { Document, Job } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/apiResponse.js';
import { requireAuth } from '../middleware/auth.js';
import { workerClient } from '../services/workerClient.js';

export const jobsRouter = Router();
jobsRouter.use(requireAuth);

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

/**
 * Pull the latest state from the worker and persist it (plus the document's
 * status/artifacts/content). Shared by the polling endpoint and the SSE relay so
 * both transports observe identical progress.
 */
async function syncJob(job) {
  if (!job.workerJobId || TERMINAL.has(job.status)) return job;

  const worker = await workerClient.getJob(job.workerJobId);
  const w = worker.data;
  job.status = w.status;
  job.stage = w.stage;
  job.pct = w.pct;
  job.message = w.message;
  job.stages = w.stages;

  if (w.status === 'completed') {
    job.result = w.result;
    await Document.updateOne(
      { _id: job.documentId },
      {
        status: 'completed',
        artifacts: w.result.artifacts,
        fidelity: { pdf: w.result.pdf, fit: w.result.fit },
        ...(w.result.document ? { content: w.result.document } : {}),
      }
    );
  } else if (w.status === 'failed' || w.status === 'cancelled') {
    job.error = w.error || { message: w.message };
    await Document.updateOne({ _id: job.documentId }, { status: 'error' });
  }

  await job.save();
  return job;
}

jobsRouter.get('/', async (req, res, next) => {
  try {
    const jobs = await Job.find({ ownerId: req.user.id }).sort({ createdAt: -1 }).limit(100);
    return ok(res, jobs);
  } catch (error) {
    return next(error);
  }
});

jobsRouter.get('/:id', async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!job) throw new HttpError(404, 'Job not found.');
    try {
      await syncJob(job);
    } catch (syncError) {
      // Worker transiently unreachable: return last known state rather than failing.
      job.message = `${job.message || ''} (worker sync failed: ${syncError.message})`.trim();
    }
    return ok(res, job);
  } catch (error) {
    return next(error);
  }
});

jobsRouter.get('/:id/events', async (req, res, next) => {
  let job;
  try {
    job = await Job.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!job) throw new HttpError(404, 'Job not found.');
  } catch (error) {
    return next(error);
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  let closed = false;
  const finish = () => {
    if (!closed) {
      closed = true;
      clearInterval(timer);
      res.end();
    }
  };

  if (!job.workerJobId) {
    send('error', { message: 'Job has not started on the worker.' });
    return finish();
  }

  send('open', { jobId: job.id, workerJobId: job.workerJobId, status: job.status });

  const timer = setInterval(async () => {
    if (closed) return;
    try {
      await syncJob(job);
      if (job.status === 'completed') {
        send('progress', { stage: 'done', pct: 100, message: job.message });
        send('done', { result: job.result, documentId: String(job.documentId) });
        return finish();
      }
      if (job.status === 'failed' || job.status === 'cancelled') {
        send('error', { message: job.error?.message || job.message, stage: job.stage });
        return finish();
      }
      send('progress', { stage: job.stage, pct: job.pct, message: job.message });
      return undefined;
    } catch (error) {
      send('error', { message: error.message });
      return finish();
    }
  }, 500);

  req.on('close', finish);
  return undefined;
});
