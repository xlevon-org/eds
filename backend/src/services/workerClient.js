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
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(options.headers || {}),
      },
      signal: AbortSignal.timeout(options.timeoutMs || 10000),
    });
  } catch (error) {
    throw new HttpError(502, `Python worker unreachable at ${workerBase}: ${error.message}`);
  }

  const body = parseJson(await response.text());
  if (!response.ok) {
    throw new HttpError(
      response.status >= 500 ? 502 : response.status,
      body.message || `Worker responded HTTP ${response.status}`,
      body
    );
  }
  return body;
}

export const workerClient = {
  health: () => request('/health'),
  providerStatus: () => request('/provider/status'),
};
