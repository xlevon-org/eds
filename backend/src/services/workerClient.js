import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const workerBase = env.worker.baseUrl.replace(/\/+$/, '');

function authHeaders() {
  return env.worker.apiKey ? { 'X-Worker-Key': env.worker.apiKey } : {};
}

function parseJson(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function request(path, options = {}) {
  const url = `${workerBase}${path}`;
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      signal: AbortSignal.timeout(options.timeoutMs || 30000),
    });
  } catch (error) {
    throw new HttpError(502, `Python worker unreachable at ${workerBase}: ${error.message}`);
  }

  const body = parseJson(await response.text());
  if (!response.ok) {
    throw new HttpError(
      response.status >= 500 ? 502 : response.status,
      body.message || body.detail || `Worker responded HTTP ${response.status}`,
      body
    );
  }
  return body;
}

export const workerClient = {
  health: () => request('/health'),
  providerStatus: () => request('/provider/status'),
  providerStatusFor: (capability) => request(`/provider/status/${capability}`),
  createJob: (payload) => request('/jobs', { method: 'POST', body: JSON.stringify(payload) }),
  getJob: (jobId) => request(`/jobs/${jobId}`),
  generateSync: (payload) =>
    request('/generate', { method: 'POST', body: JSON.stringify(payload), timeoutMs: 120000 }),
  renderHtml: (payload) => request('/render/html', { method: 'POST', body: JSON.stringify(payload) }),
  fitCheck: (payload) =>
    request('/fit', { method: 'POST', body: JSON.stringify(payload), timeoutMs: 120000 }),
  async renderPdf(payload) {
    const url = `${workerBase}/render/pdf`;
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120000),
      });
    } catch (error) {
      throw new HttpError(502, `Python worker unreachable at ${workerBase}: ${error.message}`);
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new HttpError(response.status, `PDF render failed: ${detail.slice(0, 300)}`);
    }
    return { buffer: Buffer.from(await response.arrayBuffer()), contentType: 'application/pdf' };
  },
  extractMaterials: (materials) =>
    request('/kb/extract', { method: 'POST', body: JSON.stringify({ materials }), timeoutMs: 120000 }),
  async fetchArtifact(name) {
    const url = `${workerBase}/artifacts/${encodeURIComponent(name)}`;
    const response = await fetch(url, { headers: authHeaders(), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new HttpError(response.status, `Artifact '${name}' unavailable.`);
    return { buffer: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') };
  },
};
