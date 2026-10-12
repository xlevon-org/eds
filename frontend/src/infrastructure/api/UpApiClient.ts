/**
 * UpApiClient — typed client for the `up` Express backend (/api/v1).
 *
 * The studio UI is the only consumer. Auth uses a Bearer token persisted in
 * localStorage; cookies are also set by the backend but are not required here.
 */

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export interface ComponentNode {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: ComponentNode[];
  aiInstruction?: string;
}

export interface SectionImageInstruction {
  enabled?: boolean;
  promptTemplate?: string;
  stylePreset?: string;
}

export interface TemplateSection {
  id: string;
  name: string;
  layoutType?: string;
  aiInstruction?: string;
  imageInstruction?: SectionImageInstruction;
  pageRules?: { pageBreakAfter?: boolean };
  components: ComponentNode[];
}

export interface Geometry {
  preset?: string;
  widthMm?: number;
  heightMm?: number;
  orientation?: string;
  marginsMm?: { top?: number; right?: number; bottom?: number; left?: number };
}

export interface DesignTokens {
  palette?: Record<string, string>;
  typography?: Record<string, string | number>;
  [key: string]: unknown;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  formatType?: string;
  publicationType?: string;
  pageSize?: string;
  geometry?: Geometry;
  designTokens?: DesignTokens;
  sections: TemplateSection[];
  documentDefaults?: Record<string, unknown>;
  version: number;
  status?: string;
  updatedAt?: string;
}

export interface FitIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  detail?: Record<string, unknown>;
}

export interface FitReport {
  scope: 'html' | 'pdf';
  engine: string;
  checked: boolean;
  ok: boolean;
  reason?: string;
  page?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  issues?: FitIssue[];
  counts?: { error: number; warning: number };
}

export interface FitResult {
  html?: FitReport;
  pdf?: FitReport;
}

export interface RenderResult {
  html: string;
  tighten?: number;
  fit?: FitReport;
}

export interface DocumentRecord {
  id: string;
  title: string;
  templateId: string;
  variant: string;
  status: string;
  artifacts?: { html?: string; pdf?: string };
  fidelity?: { pdf?: { available: boolean; engine: string; reason: string }; fit?: FitResult };
  revision: number;
  content?: Template;
}

export interface JobRecord {
  id: string;
  status: string;
  stage?: string | null;
  pct: number;
  message?: string;
  stages?: Array<{ stage: string; pct: number; message: string }>;
  result?: {
    title?: string;
    variant?: string;
    sectionCount?: number;
    artifacts?: { html?: string; pdf?: string };
    pdf?: { available: boolean; engine: string; reason: string };
    fit?: FitResult;
    imageReport?: { requested: number; provider: string; reason: string };
  } | null;
  error?: { message?: string } | null;
  documentId?: string;
}

export interface KbSource {
  id: string;
  name: string;
  type: string;
  status: string;
  chunkCount: number;
  createdAt?: string;
}

export interface KbChunk {
  id: string;
  content: string;
  tags: string[];
  assetType: string;
  sourceId: string;
}

export interface ProviderCapabilityStatus {
  provider: string;
  label: string;
  configured: boolean;
  reachable: boolean;
  reason: string;
  model: string;
}

export interface ProviderStatus {
  text: ProviderCapabilityStatus;
  capabilities: Record<string, ProviderCapabilityStatus>;
}

export interface JobProgressEvent {
  type: 'open' | 'progress' | 'done' | 'error';
  stage?: string | null;
  pct?: number;
  message?: string;
  result?: JobRecord['result'];
  documentId?: string;
}

export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:5000/api/v1';

const TOKEN_KEY = 'up_token';

export class UpApiClient {
  private token: string | null = null;

  constructor() {
    try {
      this.token = localStorage.getItem(TOKEN_KEY);
    } catch {
      this.token = null;
    }
  }

  get isAuthenticated(): boolean {
    return Boolean(this.token);
  }

  setToken(token: string | null): void {
    this.token = token;
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable — session stays in-memory */
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    } catch (error) {
      throw new ApiError(0, `Cannot reach the API at ${API_BASE}. Is the backend running?`);
    }

    const text = await response.text();
    let body: ApiEnvelope<T> | Record<string, unknown> = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }

    if (!response.ok) {
      const env = body as ApiEnvelope<T>;
      throw new ApiError(response.status, env.message || `HTTP ${response.status}`, env.details);
    }
    return (body as ApiEnvelope<T>).data as T;
  }

  // ---- auth ----
  async register(email: string, password: string, name = '') {
    const data = await this.request<{ token: string; user: { email: string; name: string } }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password, name }) }
    );
    this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{ token: string; user: { email: string; name: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    );
    this.setToken(data.token);
    return data;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  me() {
    return this.request<{ id: string; email: string; name: string; role: string }>('/auth/me');
  }

  // ---- templates ----
  listTemplates() {
    return this.request<Template[]>('/templates');
  }

  getTemplate(id: string) {
    return this.request<Template>(`/templates/${id}`);
  }

  createTemplate(template: Partial<Template>) {
    return this.request<Template>('/templates', { method: 'POST', body: JSON.stringify(template) });
  }

  updateTemplate(id: string, template: Partial<Template>) {
    return this.request<Template>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(template),
    });
  }

  deleteTemplate(id: string) {
    return this.request<{ deleted: boolean }>(`/templates/${id}`, { method: 'DELETE' });
  }

  duplicateTemplate(id: string) {
    return this.request<Template>(`/templates/${id}/duplicate`, { method: 'POST' });
  }

  validateTemplate(template: Partial<Template>) {
    return this.request<{ valid: boolean; problems: string[] }>('/templates/validate', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  }

  renderTemplate(id: string, variant = 'STUDENT') {
    return this.request<RenderResult>(`/templates/${id}/render`, {
      method: 'POST',
      body: JSON.stringify({ variant }),
    });
  }

  previewTemplate(template: Partial<Template>, variant = 'STUDENT') {
    return this.request<RenderResult>('/templates/preview', {
      method: 'POST',
      body: JSON.stringify({ template, variant }),
    });
  }

  /** Measure fit for an unsaved draft (DOM preflight and/or PDF verification). */
  previewFit(template: Partial<Template>, scope: 'html' | 'pdf' | 'both' = 'html', variant = 'STUDENT') {
    return this.request<{ fit: FitResult; scope: string }>('/templates/fit', {
      method: 'POST',
      body: JSON.stringify({ template, variant, scope }),
    });
  }

  // ---- documents / generation ----
  listDocuments() {
    return this.request<DocumentRecord[]>('/documents');
  }

  getDocument(id: string) {
    return this.request<DocumentRecord>(`/documents/${id}`);
  }

  generate(body: {
    templateId: string;
    variant?: string;
    instruction?: string;
    materials?: Array<{ name?: string; type: string; text?: string }>;
    kbChunkIds?: string[];
  }) {
    return this.request<{ jobId: string; documentId: string }>('/documents/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  artifactUrl(documentId: string, format: 'html' | 'pdf'): string {
    // Artifacts are auth-protected, so the UI fetches them as blobs; this URL is
    // used only for download links built from an in-memory blob.
    return `${API_BASE}/documents/${documentId}/artifact?format=${format}`;
  }

  async fetchArtifactBlob(documentId: string, format: 'html' | 'pdf'): Promise<Blob> {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const response = await fetch(this.artifactUrl(documentId, format), {
      headers,
      credentials: 'include',
    });
    if (!response.ok) throw new ApiError(response.status, `No ${format} artifact available.`);
    return response.blob();
  }

  async fetchArtifactText(documentId: string): Promise<string> {
    const blob = await this.fetchArtifactBlob(documentId, 'html');
    return blob.text();
  }

  renderDocument(documentId: string) {
    return this.request<RenderResult>(`/documents/${documentId}/render`, { method: 'POST' });
  }

  /** Measure fit for a stored document; persists the report to document.fidelity.fit. */
  fitCheck(documentId: string, scope: 'html' | 'pdf' | 'both' = 'html') {
    return this.request<{ fit: FitResult; scope: string; document: DocumentRecord }>(
      `/documents/${documentId}/fit`,
      { method: 'POST', body: JSON.stringify({ scope }) }
    );
  }

  async renderDocumentPdf(documentId: string): Promise<Blob> {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const response = await fetch(`${API_BASE}/documents/${documentId}/pdf`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ApiError(response.status, detail || 'PDF render failed.');
    }
    return response.blob();
  }

  listRevisions(documentId: string) {
    return this.request<Array<{ id: string; versionNum: number; changelog: string }>>(
      `/documents/${documentId}/revisions`
    );
  }

  createRevision(documentId: string, changelog: string) {
    return this.request<{ revision: number; snapshotVersion: number }>(
      `/documents/${documentId}/revisions`,
      { method: 'POST', body: JSON.stringify({ changelog }) }
    );
  }

  rollback(documentId: string, revisionId: string) {
    return this.request<DocumentRecord>(`/documents/${documentId}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ revisionId }),
    });
  }

  editBlock(
    documentId: string,
    body: { sectionId: string; componentId: string; props?: Record<string, unknown>; aiInstruction?: string }
  ) {
    return this.request<{ document: DocumentRecord; patched: Record<string, string> }>(
      `/documents/${documentId}/edit-block`,
      { method: 'POST', body: JSON.stringify(body) }
    );
  }

  // ---- jobs ----
  getJob(jobId: string) {
    return this.request<JobRecord>(`/jobs/${jobId}`);
  }

  /**
   * Track a job to completion by polling (Bearer-auth friendly). Returns a cancel
   * function. The backend also exposes a real SSE endpoint at /jobs/:id/events
   * (verified independently); polling keeps the browser path credential-free.
   */
  trackJob(jobId: string, onEvent: (event: JobProgressEvent) => void): () => void {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (stopped) return;
      try {
        const job = await this.getJob(jobId);
        if (job.status === 'completed') {
          onEvent({ type: 'progress', stage: 'done', pct: 100, message: job.message });
          onEvent({ type: 'done', result: job.result, documentId: job.documentId });
          stopped = true;
          return;
        }
        if (job.status === 'failed' || job.status === 'cancelled') {
          onEvent({ type: 'error', message: job.error?.message || job.message || 'Generation failed.' });
          stopped = true;
          return;
        }
        onEvent({ type: 'progress', stage: job.stage, pct: job.pct, message: job.message });
      } catch (error) {
        onEvent({ type: 'error', message: (error as Error).message });
        stopped = true;
        return;
      }
      if (!stopped) timer = setTimeout(poll, 700);
    };

    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }

  // ---- knowledge base ----
  createKbSource(body: { name: string; type?: string; text?: string; tags?: string[]; materials?: unknown[] }) {
    return this.request<{ source: KbSource; chunkCount: number }>('/kb/sources', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  listKbSources() {
    return this.request<KbSource[]>('/kb/sources');
  }

  deleteKbSource(id: string) {
    return this.request<{ deleted: boolean }>(`/kb/sources/${id}`, { method: 'DELETE' });
  }

  listKbChunks(params: { tag?: string; assetType?: string } = {}) {
    const query = new URLSearchParams();
    if (params.tag) query.set('tag', params.tag);
    if (params.assetType) query.set('assetType', params.assetType);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<KbChunk[]>(`/kb/chunks${suffix}`);
  }

  kbTags() {
    return this.request<string[]>('/kb/tags');
  }

  kbSearch(query: string, tags: string[] = []) {
    return this.request<{ method: string; results: Array<{ score: number; chunk: KbChunk }> }>(
      '/kb/search',
      { method: 'POST', body: JSON.stringify({ query, tags }) }
    );
  }

  // ---- providers ----
  providerStatus() {
    return this.request<ProviderStatus>('/providers/status');
  }

  // ---- docs ----
  async fetchPrd(): Promise<string> {
    const response = await fetch(`${API_BASE}/prd`, { credentials: 'include' });
    if (!response.ok) throw new ApiError(response.status, 'PRD document is not available.');
    return response.text();
  }
}

export const upApi = new UpApiClient();
