# `up` / `eds` — End-to-End AI Componentized Template Builder, RAG Generation & Library Platform

> **Product Requirements & Atomic System Architecture (build-ready PRD)**
> Target repo: `https://github.com/xlevon-org/eds.git` (private) — verified at `main` @ `8b163ed`
> Document date: 2026-10-12 · Working name: `up` (final brand not fixed)
> Audience: the implementing AI agent (vibe-coding end to end), then the human owner.

---

## 0. How to read this document (rules for the implementing agent)

1. **The repository is the foundation.** Build inside the existing `frontend/`, `backend/`, `worker/` layout. Do **not** restructure into `apps/` + `packages/` (see §3.1 for the reconciliation and why).
2. **This document is authoritative over the repo docs and over the user's earlier draft.** Where the draft (Postgres/Prisma/Qdrant/Next.js/Paged.js) conflicts with the repo, this document's reconciliation wins. Where it conflicts with observed behavior, the observation wins and the doc is fixed (`AGENTS.md`).
3. **Verify, never assert.** Every "done" claim requires the verification gate in §20 to pass against a running instance. There is no automated test suite today; one is introduced here.
4. **Phase the work.** Do not attempt the whole platform before Phase 1 acceptance criteria in §19 pass. Each phase is independently runnable and verified.
5. **State assumptions and failure paths** for every feature you build, exactly as this document does.
6. **No default AI provider, ever.** Generation is refused until a provider is configured and passes a live connection check.

---

## 1. Executive Summary

`up` is a platform where a teacher builds **reusable, componentized document templates**, grounds them in a **multi-modal knowledge base (RAG)**, and then **generates, edits, version-controls, exports, and maintains** high-quality documents (student handbooks and many other publication types) through a **Claude-style chat workspace with a live split-screen preview**.

The defining capability is a **visual Template Builder** where every section (cover, table of contents, inner content, header, footer, image blocks, question items, answer key, …) is a **frontend component arrangement with sizers**, governed by **template-wide design tokens**, **page geometry** (size/margins/bleed/gutter), and **per-section generation instructions** (including dedicated **image-generation instructions**). Every config change is **live-previewed against sample data**. Final generation **100% adheres** to the saved page geometry and styles.

After generation, the user can **point at any block or select any content** and ask AI to **regenerate / correct / align / replace / paste / upload**, seamlessly replacing that part without breaking layout or pagination. Every generation is a **revision** (`v1`, `v2`, …) that can be diffed and rolled back. Everything lands in a **searchable library**.

---

## 2. Goals, Non-Goals, Personas, Core User Journeys

### 2.1 Goals
- G1 — Visual, componentized template authoring with instant **live preview**.
- G2 — Templates that fully define **format, sections, order, per-section design, design tokens, page geometry, and generation instructions** (text + image).
- G3 — A **RAG knowledge base** built from uploaded **PDFs and images** (text, tables, diagrams, images) with **tags and references**.
- G4 — A **chat generation workspace** (left chat / right document) that produces documents from `template + KB + instructions`.
- G5 — **In-place, block-level AI editing** and seamless part replacement.
- G6 — **Revisions**, diff, rollback, and a maintained **library**.
- G7 — Reproducible **HTML + PDF** export that **honors geometry/styles exactly**.

### 2.2 Non-Goals (this platform)
- NG1 — Real-time multi-user collaborative cursors (single-author editing first; RBAC sharing later).
- NG2 — Real screen capture / browser-extension recording (the legacy click-recorder is **not** the canonical model — see §3.3).
- NG3 — Editing the source textbooks inside `up` (we extract and index, not author, source material).
- NG4 — Mobile-native apps (responsive web only).

### 2.3 Personas
- **Instructor / Author** — builds templates, curates KB, generates documents.
- **Department Admin** — manages shared templates, tags, branding tokens.
- **Viewer / Student** — consumes exported HTML/PDF (no builder access).

### 2.4 Core user journeys
- **J-Build**: New template → pick format & publication type → set geometry → define sections & order → style sections/components → set tokens → write per-section text + image instructions → preview each section live → preview full sample → save.
- **J-KB**: Upload PDF/photo → auto-extract → review/edit chunks → tag & reference → search.
- **J-Generate**: Open workspace → pick template → pick KB tags/refs → type instruction → watch streamed progress → view paginated document → save → create revision.
- **J-Edit**: Hover a block → "Edit with AI" (or select a span) → prompt → streamed patch → node replaced → re-export.
- **J-Maintain**: Library → open document → compare revisions → rollback → export → duplicate-from as a new variant.

---

## 3. Architecture

### 3.1 Reconciliation with the current repository (authoritative)

The user's draft proposed `apps/web` (Next.js), `apps/api`, `packages/*`, PostgreSQL + Prisma + Qdrant + Redis + MinIO, and client-side Paged.js. **This is superseded** by the repo's verified decisions:

| Concern | Draft proposal | **Decision (repo-aligned)** | Rationale |
|---|---|---|---|
| Layout | `apps/` + `packages/` | **`frontend/` + `backend/` + `worker/`** (existing) | Repo is already three projects, no npm workspaces; restructuring adds risk with no user value. Shared code = duplicated **contracts**, not duplicated packages (§3.2). |
| Frontend | Next.js | **React 19 + Vite 8 + TS + Tailwind v4** (existing SPA) | "kept as-is"; already Clean Architecture. |
| Backend | Express TS orchestrator | **Node 24 ESM + Express 5 + Mongoose 8** (existing) | Already scaffolded, `/api/v1`, envelope, worker client. |
| Metadata DB | PostgreSQL + Prisma | **MongoDB Atlas + Mongoose** | Existing decision & working Atlas connection. |
| Vectors | Qdrant / pgvector | **MongoDB Atlas Vector Search** (primary); pgvector/Qdrant documented as alternatives | Keeps one datastore; Atlas supports ANN vector indexes. |
| Media | MinIO | **Cloudinary** | Existing decision & config. |
| Queue | Redis | **Mongo-backed job records + in-process worker queue**; Redis optional later | No Redis in env; avoid new infra for MVP. |
| PDF | client-side Paged.js | **Server-side WeasyPrint (Jinja2/HTML→PDF)** authoritative; **browser print** as instant secondary | Samples were produced by WeasyPrint 70.0 (PDF `/Producer`); WeasyPrint runs **no JS**, so the server renders from the **template JSON**, guaranteeing parity with the live preview. |
| Print engine | — | **Paged.js in the browser for preview pagination + `@page` CSS for browser print** | Gives the user instant on-screen pagination and a quick local print, without making it the authoritative PDF. |

> **Fidelity strategy (the core of G7):** the **live preview** and the **server PDF** render the **same versioned JSON document tree + the same design tokens + the same page geometry**. Parity is achieved by contract, not by luck. The server (Python) never depends on the browser DOM.

### 3.2 Cross-boundary contract (replaces `packages/*`)

Because frontend is TS and the worker is Python, "shared code" means **a single versioned JSON Schema** (`docs/schemas/*.schema.json`, `schemaVersion`) that all three apps implement:

- `backend` validates + stores it (Mongoose `Mixed` typed by the schema).
- `frontend` renders it (component registry keyed by `component.type`).
- `worker` consumes it (Jinja macros keyed by the same `type` strings) and emits patches back in the same shape.

Any component `type` must exist in **both** the TS registry and the Jinja macro registry, or template save/validation fails (§10.9).

### 3.3 Resolving the deferred canonical model

`docs/architecture.md` deferred the "canonical handbook model" (legacy click-recorder vs. rich lesson pages). **This PRD resolves it:** the canonical model is the **Template + Section + Component + Document** graph below. The legacy click-step domain (`xPercent`/`yPercent` screen mockups, `HandbookEditorView`) is **retired as the product model**; it may remain only as a read-only legacy importer and must not drive generation.

### 3.4 Repository tree (target)

```text
/
├── frontend/                        # React 19 + Vite 8 + TS + Tailwind v4 SPA  (port 3000)
│   └── src/
│       ├── domain/                  # entities + policies (Template, Section, ComponentNode, Document, Revision, KBChunk, Job)
│       ├── application/             # use cases (builder, generation, kb, revisions, library)
│       ├── infrastructure/
│       │   ├── api/                 # TypedRestClient -> /api/v1 (replaces legacy HandbookApiClient paths)
│       │   ├── persistence/         # draft autosave/local cache
│       │   └── render/              # preview renderer, Paged.js bridge, browser-print adapter
│       ├── presentation/
│       │   ├── pages/               # Builder, KnowledgeBase, Workspace(chat), Library, Settings/Providers
│       │   ├── context/             # DI (DependencyContext) + Zustand stores (builder, generation, preview)
│       │   └── components/
│       │       ├── ui/              # shadcn-style primitives (existing)
│       │       ├── builder/         # section list, token editor, geometry editor, component palette, inspector
│       │       └── doc/             # DOCUMENT COMPONENT REGISTRY (frontend render of every component type)
│       └── architecture/
├── backend/                         # Node 24 ESM + Express 5 + Mongoose 8  (port 5000)
│   └── src/
│       ├── config/                  # env.js, db.js, cloudinary.js (existing, extended)
│       ├── models/                  # User, Template, TemplateSection(cur. embedded), Document, Revision, KbChunk, Job, Provider
│       ├── routes/                  # auth, templates, kb, documents, jobs, library, providers, health
│       ├── controllers/
│       ├── middleware/              # auth (JWT), rbac, validate(schema), upload(multer), error, notFound
│       ├── services/                # workerClient (extended), jobService, sseService, cloudinaryService, schemaValidator
│       └── utils/
├── worker/                          # Python 3.14 + FastAPI  (port 8000, X-Worker-Key)
│   └── app/
│       ├── main.py                  # /health, /provider/status, /jobs*, /kb/*, /render/*
│       ├── config.py
│       ├── providers.py             # registry: text | vision | image | embedding
│       ├── pipeline/stages.py       # intake -> inspect -> retrieve -> plan -> fill -> images -> render_html -> render_pdf
│       ├── rag/                     # pdf_extract, ocr_vlm, chunker, embed, hybrid_search, tagger
│       ├── render/templates/        # Jinja2 macros keyed by component type
│       ├── render/weasyprint_engine.py
│       └── artifacts/               # generated html/pdf/media (gitignored; .gitkeep tracked)
├── assests/                         # reference output samples
└── docs/                            # architecture.md, schemas/, this PRD
```

---

## 4. The Template Model (the heart of the system)

### 4.1 Logical types (TS interfaces; Python mirrors, Mongo stores; JSON Schema is the contract)

```ts
// ---------- Template ----------
interface Template {
  id: string;
  schemaVersion: string;              // e.g. "1.0"
  ownerId: string;
  name: string;
  description?: string;

  // [Requirement] Type routing — output format + document kind
  formatType: 'PDF_PRINT' | 'RESPONSIVE_HTML' | 'BOTH';
  publicationType:
    | 'HANDBOOK' | 'LEAFLET' | 'SHORT_NOTE' | 'QUESTION_PAPER'
    | 'SYLLABUS_GUIDE' | 'ASSIGNMENT_SHEET' | 'WORKSHEET' | 'GUARDIAN_LETTER'
    | (string & {});                  // extensible registry (see §4.2)

  // [Requirement] Page geometry — binding, generation must adhere 100%
  geometry: PageGeometry;

  // [Requirement] Template-wide theme
  designTokens: DesignTokens;

  // [Requirement] Sections + their order + per-section design/instructions
  sections: Section[];               // ordered by orderIndex

  // [Requirement] Full document properties
  documentDefaults: {
    variants: Array<'STUDENT' | 'INSTRUCTOR'>;   // student/instructor branches
    showPageNumbers: boolean;
    numberingStart: number;
    runningHeader?: string;
    runningFooter?: string;
    firstPageDifferent: boolean;
    tocIncludeLevels: Array<1 | 2 | 3>;
    tocShowPageNumbers: boolean;
  };

  version: number;                    // optimistic concurrency
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string; updatedAt: string;
}

interface PageGeometry {
  preset: 'A4' | 'LETTER' | 'A5' | 'A3' | 'CUSTOM';
  widthMm: number;                    // honored exactly for CUSTOM + as materialized for presets
  heightMm: number;
  orientation: 'portrait' | 'landscape';
  marginsMm: { top: number; right: number; bottom: number; left: number };
  bleedMm: number;
  gutterMm: number;
  columns: 1 | 2 | 3;                 // base column grid
  columnGapMm: number;
  mirrorMargins: boolean;             // inside/outside for bound documents
  headerZoneMm: number;               // reserved for @top-* running content
  footerZoneMm: number;               // reserved for @bottom-* running content
}

interface DesignTokens {
  palette: {
    primary: string; secondary: string; accent: string;
    background: string; surface: string; text: string; mutedText: string;
    border: string; success: string; warning: string; danger: string; info: string;
  };
  typography: {
    bodyFont: string; headingFont: string; monoFont: string;
    baseFontPt: number; scaleRatio: number;      // modular scale
    lineHeight: number; headingWeight: number; letterSpacing: number;
    // [Accessibility] e.g. 'OpenDyslexic' selectable
  };
  spacing: { unitPx: number; scale: number[] };  // sizer base
  radius: { sm: number; md: number; lg: number; pill: number };
  borders: { widthPt: number; style: 'solid'|'dashed'|'dotted'|'none' };
  shadows: { sm: string; md: string; lg: string };
  iconSet: string;                                // e.g. 'lucide'
  backgroundPattern?: { type: 'none'|'dots'|'grid'|'waves'|'image'; assetId?: string; opacity?: number };
  cssVariableOverrides?: Record<string, string>;  // escape hatch, validated
}

// ---------- Section ----------
interface Section {
  id: string;
  orderIndex: number;                 // order in the document
  name: string;                       // 'Cover Page', 'Table of Contents', 'Chapter Body'
  layoutType: string;                 // registry id: 'cover', 'toc', 'standard', 'grid_2col', 'question_list', ...
  components: ComponentNode[];        // the arrangement (nested tree)
  pageRules: {
    startOnNewPage: boolean;
    pageBreakAfter: boolean;          // 'auto' | 'always'
    keepTogether: boolean;
    useColumns?: 1 | 2 | 3;           // overrides geometry.columns for this section
    minHeightMm?: number;
  };
  // [Requirement] per-section generation instructions
  aiInstruction?: string;             // how the AI must author this section's content
  aiConstraints?: {
    tone?: string; readingLevel?: string; maxWords?: number;
    mustInclude?: string[]; mustAvoid?: string[]; language?: string;
    citationStyle?: 'inline' | 'footnote' | 'none';
  };
  // [Requirement] dedicated image-generation instructions
  imageInstruction?: ImageInstructions;
}

interface ImageInstructions {
  enabled: boolean;
  promptTemplate: string;             // supports {{topic}}, {{section}}, {{kbRefs}} placeholders
  style?: string;                     // 'photoreal' | 'flat-vector' | 'isometric' | 'watercolor' | ...
  aspectRatio?: '1:1' | '4:3' | '16:9' | '3:4' | 'free';
  resolutionPx?: number;
  placement?: 'inline' | 'float-left' | 'float-right' | 'full-bleed' | 'background';
  caption?: boolean;
  altTextRule?: 'auto' | 'manual';    // [Accessibility] required
  referenceKbAssetIds?: string[];     // style references from KB
  negativePrompt?: string;
  countPerSection?: number;
}

// ---------- Component nodes (arrangement + sizers) ----------
interface ComponentNode {
  id: string;
  type: string;                       // MUST exist in frontend registry AND Jinja registry (§3.2)
  props: Record<string, unknown>;     // typed per component; includes sample/preview data
  style?: Partial<ComponentStyle>;    // per-node overrides on top of tokens
  sizer?: {                           // [Requirement] component-level arrangements/sizers
    widthPct?: number; minWidthMm?: number; maxWidthMm?: number;
    alignSelf?: 'start' | 'center' | 'end' | 'stretch';
    marginTopPx?: number; marginBottomPx?: number;
    grow?: number;                    // flex grow within a row/grid container
  };
  children?: ComponentNode[];         // for container components (grid, columns, callout, etc.)
  // [Requirement] content generation instruction at component granularity
  aiInstruction?: string;
  // [Requirement] binding to KB references (used at generation + traceability)
  kbRef?: { mode: 'auto' | 'pinned'; tagIds?: string[]; chunkIds?: string[] };
}

interface ComponentStyle {
  colorToken?: keyof DesignTokens['palette'];
  fontToken?: 'bodyFont' | 'headingFont' | 'monoFont';
  fontPt?: number; weight?: number; align?: 'left'|'center'|'right'|'justify';
  paddingPx?: number; backgroundToken?: string; borderToken?: string; radiusToken?: string;
}
```

### 4.2 Publication-type → required/default sections registry ([Requirement] 2b)

A small declarative registry (backend `services/publicationRegistry.js` + mirrored in frontend constants) defines, per `publicationType`, the **default section sequence** and which sections are **required**. Users reorder/add/remove, but required sections are validated before "Publish" and before "Generate".

| publicationType | Default section order | Required minimum |
|---|---|---|
| `HANDBOOK` | Cover → TOC → Learning objectives → Body chapters (repeatable) → Activity/Checkpoint → Glossary → Appendix | Cover, TOC, ≥1 Body |
| `LEAFLET` | Cover/Hero → Key points (2-col) → Callouts → Contact/Footer | Cover/Hero, ≥1 content |
| `SHORT_NOTE` | Title block → Body | Title block, Body |
| `QUESTION_PAPER` | Header (institution/exam) → Instructions → Section A questions → Section B → (optional) Formula sheet | Header, Instructions, ≥1 question section |
| `SYLLABUS_GUIDE` | Cover → Course info table → Weekly plan → Assessment → Policies | Cover, Weekly plan |
| `ASSIGNMENT_SHEET` | Header → Task description → Rubric table → Submission box | Header, Task, Rubric |
| `WORKSHEET` | Title → Instructions → Exercises → Answer area | Title, ≥1 exercise |
| `GUARDIAN_LETTER` | Letterhead → Salutation → Body → Signature | Letterhead, Body |

**Instructor variant rule:** any template with `documentDefaults.variants` containing `INSTRUCTOR` adds an **Answer Key** section branch that is generated from the student content with teacher-only instruction.

### 4.3 Granular component taxonomy (initial catalog)

Every type below must be implemented in **both** `frontend/src/presentation/components/doc/` and `worker/app/render/templates/`.

| Group | `type` | Purpose / key props |
|---|---|---|
| Structure | `CoverContainer` | layout variant (`split`, `banner`, `minimal`, `full-bleed`), title/subtitle/logo slots, background pattern |
| | `Toc` | auto dot-leader TOC from heading levels; `showPageNumbers` |
| | `Heading` | level 1–4; feeds TOC |
| | `Paragraph` | rich text (markdown subset) |
| | `RichText` | block markdown + inline (bold/italic/code/link) |
| | `BulletList` / `NumberedList` | items; nesting |
| | `Divider` | rule, spacing |
| | `Spacer` / `Sizer` | explicit vertical rhythm |
| | `PageBreak` | forced break |
| Layout | `GridContainer` | 1–4 cols; gap via tokens; children with `sizer` |
| | `ColumnStack` | vertical stack with grow/align |
| | `TwoColumnCallout` | text + media side-by-side |
| Media | `MediaAssetBlock` | image/diagram; `placement`, `caption`, `altText` (required) |
| | `FigureWithCaption` | numbered figure + caption |
| | `EquationBlock` | LaTeX (`$...$` / `$$...$$`) |
| | `TableBlock` | header row, zebra, column widths, from KB table |
| | `CodeBlock` | language, line numbers |
| Semantic | `CalloutBox` | intent `info|warning|tip|definition|danger`; icon mapping |
| | `ObjectiveList` | learning objectives |
| | `Glossary` | term/def pairs |
| | `Quote` | attribution |
| | `Checklist` | checkboxes (interactive HTML; print-safe) |
| | `SignOffSheet` | name/date lines |
| Assessment | `QuestionItem` | number, marks, MCQ/short/long; answer (instructor variant) |
| | `RubricTable` | criteria × levels × marks |
| | `AnswerKey` | instructor-only |
| Meta | `RunningHeader` / `RunningFooter` | bound to `@top-*` / `@bottom-*` zones |
| | `PageNumber` | `counter(page)` / `counter(pages)` |

### 4.4 Design tokens → CSS custom properties ([Requirement] "colours themed out at once")

On template save, the backend/worker derive a `:root` token block:

```css
:root{
  --color-primary:#...; --color-text:#...; /* from palette */
  --font-body:'...'; --font-head:'...'; --base-pt:11; --lh:1.5;
  --space-unit:4px; --radius-md:6px; --border-w:0.5pt;
}
@page{
  size: 210mm 297mm portrait;
  margin: 20mm 18mm 20mm 18mm;
  @top-center{ content: string(running-header); }
  @bottom-right{ content: counter(page) " of " counter(pages); }
}
```

All components consume tokens (never hard-coded colors). Changing `designTokens` re-themes **every** section atomically.

---

## 5. Live Preview System ([Requirement] 3, 5, 6)

### 5.1 Requirements
- **PR-1** Any builder change (geometry, tokens, section order, component prop, instruction) updates the preview **immediately** (target: <150 ms, no full reload).
- **PR-2** Preview runs on **sample data** bundled per template (auto-generated fixture + user-editable "Sample content" fields).
- **PR-3** **Section-scoped preview**: selecting a section previews **just that section** (e.g., the cover page) as a rendered page.
- **PR-4** **Full-sample preview**: a "Preview whole document" action renders the entire section sequence with sample data, paginated.
- **PR-5** Preview honors **real geometry** (page size/margins/columns) via CSS `@page` proxy + Paged.js so page breaks are visible.
- **PR-6** Preview has zoom/pan, page-vs-continuous modes, and a print-simulation toggle (crop marks/bleed).
- **PR-7** The **same component registry** renders preview and (server) final output, so parity is structural.

### 5.2 Implementation
- Frontend `infrastructure/render/PreviewRenderer` walks `ComponentNode[]` → React elements from `components/doc/` registry. Section preview isolates one subtree; full preview concatenates sections with `break-after` rules and Paged.js pagination.
- A **sample-data provider** supplies deterministic fixtures (e.g., a "Sample Student Handbook" fixture) so previews are stable and testable.
- Undo/redo (Zustand history middleware) applies to builder state.

### 5.3 Sample-data contract
Each component declares a `sampleProps` default; templates may override with a "Sample content" panel. The full-sample preview is generated from `sections[].components[].props` where provided, else `sampleProps`.

---

## 6. Knowledge Base & RAG Pipeline ([Requirement] 9)

### 6.1 Ingestion
**PDF upload** → parser (`PyMuPDF` primary; `Marker`/`unstructured` for layout+LaTeX) → markdown preserving **headings, tables, equations, reading order** → extract embedded images/diagrams → **hierarchical chunking** (parent section / child paragraph or table) → embeddings → store.

**Image/photo upload (scanned pages, book photos)** → preprocess (deskew, denoise, page-split) → **OCR via vision model** (provider `vision`) → text + **visual description** of diagrams → chunk → store; also store the image as an asset.

**Link ingestion** (repo objective) → fetch → readability extraction → chunk.

### 6.2 Chunk model

```ts
interface KbChunk {
  id: string;
  projectId: string;                  // KB scoping
  sourceFileId: string; sourceFileName: string;
  sourceType: 'PDF' | 'IMAGE' | 'LINK';
  parentChunkId?: string;             // hierarchy
  subject?: string; unitName?: string; chapterTitle?: string;
  pageNumber?: number;
  assetType: 'TEXT' | 'TABLE' | 'DIAGRAM' | 'IMAGE' | 'EQUATION';
  content: string;                    // markdown / LaTeX / asset description
  assetCloudinaryId?: string;         // for images/diagrams/tables-as-image
  bbox?: { x: number; y: number; w: number; h: number }; // page coordinates for provenance
  tags: string[];                     // [Requirement] tag-based retrieval
  references: string[];               // citation keys
  embedding?: number[];               // dense vector (stored for Atlas Vector Search)
  embeddingModel?: string;
  ocrConfidence?: number;             // low-confidence flagged for review
  lowConfidenceFlags?: string[];
  createdAt: string;
}
```

### 6.3 Vector + hybrid search
- **Primary:** MongoDB Atlas **Vector Search** index on `KbChunk.embedding` (cosine), with `filter` fields (`projectId`, `tags`, `assetType`, `subject`).
- **Sparse:** BM25 keyword index (Atlas Search) or in-worker BM25.
- **Fusion:** Reciprocal Rank Fusion (RRF) of dense + sparse.
- **Alternatives (documented, not built unless needed):** pgvector on Postgres; Qdrant.
- **Embedding provider:** `AI_EMBED_PROVIDER` + `AI_EMBED_MODEL` (e.g., a BGE/Gemini/OpenAI embedding endpoint). There is **no default**; if unset, KB search degrades to keyword-only with a warning.

### 6.4 KB management UI
Browse by **source / tag / assetType**; edit chunk text; re-tag; merge/split; delete; preview extracted assets; **flag low-confidence OCR** for correction; assign **references** (citation keys) used at generation. Deleting a source cascades its chunks (with confirmation).

### 6.5 Retrieval at generation
For each section/component with `kbRef.mode='auto'`, the worker builds a query from the section's `aiInstruction` + heading + template metadata, filters by `projectId` and selected tags, retrieves top-K (dense+sparse, RRF), and passes ranked chunks with provenance into the generation prompt. **Pinned** refs (`chunkIds`) are always included. Every claim in the generated document records its **source chunk ids** for traceability (viewable in the workspace and rendered as footnotes if `citationStyle !== 'none'`).

---

## 7. Generation Engine ([Requirement] 10, 11)

### 7.1 Pipeline (worker `stages.py`, replacing the 6 stubs with 8 stages)
`intake → inspect_materials → retrieve → plan_content → fill_sections → generate_images → render_html → render_pdf`

- **intake** — validate request (template id+version, KB scope, variants, instruction, provider/model), snapshot the template JSON (immutability), create job.
- **inspect_materials** — run KB extraction for any newly attached sources.
- **retrieve** — hybrid retrieval per section/component (§6.5).
- **plan_content** — LLM produces a **content plan** (structure + what each section/component will contain) using template instructions + retrieved context; streamed as progress.
- **fill_sections** — LLM fills each `ComponentNode.props` with content, honoring `aiConstraints` (tone, reading level, maxWords, mustInclude/avoid, language, citation style).
- **generate_images** — for sections with `imageInstruction.enabled`, call the image provider, store to Cloudinary, bind `assetCloudinaryId` + auto alt text; on safety refusal, fall back to a KB image or a placeholder and warn.
- **render_html** — Jinja2 → standalone interactive HTML (the `assests/` format).
- **render_pdf** — WeasyPrint (optional extra; degrade to HTML-only with explicit error if native libs absent).

Each stage emits a progress event `{jobId, stage, pct, message, data?}` relayed by the backend over SSE.

### 7.2 Model/provider selection
Per-capability provider config: `text`, `vision`, `image`, `embedding`. Global default from `backend/.env`/workspace settings; per-request override from the workspace. The worker exposes `GET /provider/status` returning each capability's `{configured, reachable, reason, model}`. **Generation is refused** (HTTP 409 with reason) if the required capabilities for the request are not configured/reachable.

### 7.3 Constraints & guardrails
- Section/component `aiConstraints` are injected as hard rules; the worker **validates the output** against them (word count, mustInclude presence) and retries once, else flags a warning on the block.
- Context-window management: summarize/route long KB context; never silently truncate — record what was dropped.
- Determinism option: seed + temperature controls for reproducible classroom output.

---

## 8. Chat Generation Workspace ([Requirement] 11, 12)

### 8.1 Layout (Claude-style split)
- **Left rail (≈380 px):** chat stream (user/assistant), **template selector** (with version), **KB tag/reference selector**, instruction box, provider/model pickers, **generation log** (stage-by-stage progress), stop/cancel, retry, "regenerate this section".
- **Right pane (flex-1):** live paginated **document canvas**; toolbar = zoom, page/continuous, HTML↔PDF preview toggle, print, export, **revision selector**, "open revision drawer".
- **Responsive:** collapses to tabs on small screens.

### 8.2 Interaction
User selects template + tags → types an instruction (e.g., "Generate a Grade 8 handbook on photosynthesis using these notes") → generation streams into the canvas → user iterates in the same chat (refine, shorten, add section) → saves.

### 8.3 Revisions ([Requirement] 12)
- Every accepted generation/edit creates an immutable `Revision` (`versionNum`, `changes` diff + full snapshot, `changelog`, author, timestamp).
- Revision drawer: list, **side-by-side diff**, restore/rollback (creates a new revision pointing to the restored content), rename, export a specific revision.
- Optimistic concurrency: document `revision` counter; a stale write returns 409 and the client re-syncs.

---

## 9. In-Place AI Editing & Seamless Part Replacement ([Requirement] 14, 15 — critical)

### 9.1 Block-level
Hover any rendered block → bounding box + floating toolbar: **Edit with AI**, **Replace image**, **Regenerate image**, **Edit manually**, **Duplicate**, **Move up/down**, **Delete**. "Edit with AI" opens an inline popover anchored to the block; the prompt streams back a **patch** for that node.

### 9.2 Selection-level
User can select a text span or multi-block range → floating menu: **Rewrite**, **Simplify**, **Fix grammar**, **Align to template tone**, **Translate**, **Expand**, **Convert to list/table/callout**.

### 9.3 Seamless replacement semantics
- The backend `POST /api/v1/documents/:id/edit-block` sends `{blockId, selection?, instruction, context (neighbor blocks), templateTokens}` to the worker, which returns a **node-subtree patch** in the same JSON schema.
- Frontend applies the patch by replacing the node subtree in the document store; the renderer updates only that subtree (**no full re-render, no pagination jump**).
- **Paste / upload / update a part:** a "Replace with…" action accepts pasted markdown/HTML, an uploaded PDF (extract → map to the selected section), or an uploaded image (→ `MediaAssetBlock`, stored to Cloudinary). All routes normalize to a component subtree patch.
- **Image swap:** "Replace image" accepts upload, KB asset pick, or AI regeneration; updates `assetCloudinaryId` + alt text in place.
- After any edit, the user can **Save as revision** or continue editing (autosaved draft).

---

## 10. Backend API Contract (`/api/v1`, envelope `{success, message?, data?}`)

> All routes except `/health` and `/auth/*` require a valid session (JWT Bearer **or** httpOnly cookie). Errors: HTTP status + envelope, optional `details`.

### 10.1 Auth
- `POST /api/v1/auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
- JWT (`Authorization: Bearer`, `JWT_SECRET`, `JWT_EXPIRES`) + httpOnly cookie; RBAC roles `owner|editor|viewer`.

### 10.2 Templates
**Implemented (`backend/src/routes/templates.js`):**
- `GET /templates` (list, owner-scoped), `POST /templates`, `GET /templates/:id`, `PUT /templates/:id` (optimistic `version`), `DELETE /templates/:id`.
- `POST /templates/:id/duplicate` → clone as a new `DRAFT`.
- `POST /templates/:id/render` → server-rendered HTML for the saved template (live preview / print).
- `POST /templates/validate` → component-registry + geometry + required-field validation **without saving** (§10.9).
- `POST /templates/preview` → render an **unsaved** draft (used by the builder's live preview).

**Planned (not yet implemented):** `POST /templates/:id/publish`, `POST /templates/:id/archive`, `GET /templates/:id/sample`, `GET /templates/schema`, `GET /templates/:id/export`, `POST /templates/import`.

### 10.3 Knowledge base
- `POST /kb/sources` (multipart: pdf/image/link) → creates a source + job (extraction/chunk/embed).
- `GET /kb/sources`, `GET /kb/sources/:id`, `DELETE /kb/sources/:id`.
- `GET /kb/chunks` (filter by tag/assetType/source/subject), `PUT /kb/chunks/:id` (edit text/tags/references), `POST /kb/chunks/:id/merge`, `DELETE /kb/chunks/:id`.
- `GET /kb/tags`, `POST /kb/tags`, `POST /kb/search` (hybrid query `{query, tags[], assetType?, topK}`).

### 10.4 Documents & generation
**Implemented (`backend/src/routes/documents.js`):**
- `POST /documents/generate` → creates a job, returns `{jobId, documentId, workerJobId}`; **progress via SSE** `GET /api/v1/jobs/:id/events` **or** by polling `GET /api/v1/jobs/:id` (both sync from the worker).
- `GET /documents`, `GET /documents/:id`.
- `POST /documents/:id/render` → HTML rendered from the stored (generated, editable) document content.
- `POST /documents/:id/pdf` → fresh server PDF from the stored content (reflects edits).
- `GET /documents/:id/artifact?format=html|pdf` → the immutable artifact produced by the generation job.
- `GET /documents/:id/revisions`, `POST /documents/:id/revisions` (snapshot current state), `POST /documents/:id/rollback` `{revisionId}`.
- `POST /documents/:id/edit-block` → in-place block patch (`{sectionId, componentId, props}`), bumps `revision`.

**Planned (not yet implemented):** `PUT /documents/:id`, `DELETE /documents/:id`, `POST /documents/:id/replace-part`, `POST /documents/:id/regenerate-image`, `GET /documents/:id/export?format=` (use `/artifact` or `/render`+`/pdf` today).

### 10.5 Library
- `GET /library` (unified list of documents, filter by template/tag/status/date), `POST /library/:id/duplicate-as-variant`.

### 10.6 Jobs & progress
- **Implemented:** `GET /jobs`, `GET /jobs/:id`, `GET /jobs/:id/events` (SSE relay; also updates document status/artifacts/content on completion).
- **Planned:** `POST /jobs/:id/cancel`, `POST /jobs/:id/retry`.

### 10.7 Providers
- **Implemented:** `GET /providers/status` (proxies worker `/provider/status`, per capability `text|vision|image|embedding`), `GET /providers/status/:capability`.
- **Planned:** `PUT /providers/config` (workspace-level capability→provider/model mapping; secrets remain in `.env`).

### 10.8 Worker-internal API (X-Worker-Key)
- **Implemented:** `GET /health`, `GET /provider/status` (+`/:capability`), `POST /jobs`, `GET /jobs`, `GET /jobs/:id`, `POST /generate`, `POST /render/html`, `POST /render/pdf`, `POST /kb/extract`, `GET /artifacts/:name`.
- **Planned:** `POST /kb/embed`, `POST /kb/search`, `POST /edit-block`, `POST /image/generate`.

### 10.9 Validation rules (template save/publish/generate)
1. JSON Schema valid (`schemaVersion` supported).
2. Every `component.type` exists in **both** TS and Jinja registries.
3. All `publicationType` **required sections** present (§4.2).
4. Geometry valid (positive mm, margins < page, gutter/page consistent, columns ≥ 1).
5. Token references resolve (no dangling `*Token` names).
6. Contrast: text/background pairs meet WCAG AA for the chosen target (warn or block per setting).
7. Every `MediaAssetBlock` has `altText` (accessibility).
8. `imageInstruction.promptTemplate` non-empty when `enabled`.
9. For `PDF_PRINT`: WeasyPrint capability flagged; if unavailable, warn that PDF will degrade.

---

## 11. Data Model (MongoDB / Mongoose collections)

| Collection | Key fields | Notes |
|---|---|---|
| `users` | email, passwordHash, name, role, workspaceIds | bcrypt/memory-safe hash; never log secrets |
| `templates` | §4.1 Template (sections embedded, ordered) | `schemaVersion`; unique index `(ownerId, name)`; text index on name/description |
| `documents` | templateId, templateVersion, title, status, `content` (ComponentNode tree), revision, authorId | `content` validated against schema |
| `revisions` | documentId, versionNum, changes(diff), snapshot, changelog, authorId, createdAt | immutable; unique `(documentId, versionNum)` |
| `kbsources` | name, type, cloudinaryId, status, projectId, chunkCount | |
| `kbchunks` | §6.2 | **Atlas Vector Search** index on `embedding`; text index on `content`/`tags` |
| `jobs` | type, status(queued/running/completed/failed/cancelled), stage, pct, input, result, error, documentId | TTL optional |
| `providers` | workspaceId, capability, provider, model | secrets NOT stored here (env only) |

Indexes: `documents(templateId, status)`, `documents(authorId, updatedAt)`, `kbchunks(projectId, tags, assetType)`, `jobs(status, createdAt)`.

---

## 12. Auth, Security & Privacy

- **Auth:** JWT Bearer + httpOnly cookie; `/auth/me` for session; login/register/logout. RBAC `owner|editor|viewer`.
- **Input safety:** validate all input; strip `$`/dotted keys (NoSQL injection); schema validation before Mongo.
- **Uploads:** multer with size limit (`MAX_UPLOAD_MB`, default 50), MIME/extension allowlist, virus-scan hook reserved; Cloudinary signed uploads; no executable content served; artifact serving sets `Content-Disposition` + `X-Content-Type-Options: nosniff`.
- **PII redaction (existing policy extended):** reuse the SSN/email/student-ID patterns from the legacy `HandbookDomainPolicy`; apply at generation and export; templates can require redaction for student variants.
- **Worker isolation:** worker is internal, only the backend holds `WORKER_API_KEY`; never publicly exposed.
- **Secrets:** only `.env.example` committed; rotate any ever committed; production config assertions (`assertProductionConfig`).
- **Audit:** record who generated/edited/exported a document (revision author + job log).
- **CORS:** allow-list from `CORS_ALLOWED_ORIGINS`.

---

## 13. Environment Variables (additions marked ➕)

**backend** (existing + ➕): `PORT`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES`, `CORS_ALLOWED_ORIGINS`, `CORS_ALLOW_NO_ORIGIN`, `CLOUDINARY_*`, `CLOUDINARY_FOLDER`, `MAX_UPLOAD_MB`, `WORKER_BASE_URL`, `WORKER_API_KEY`, `PUBLIC_BASE_URL`, ➕`SSE_HEARTBEAT_MS`, ➕`DEFAULT_AI_CAPABILITIES` (JSON), ➕`ATLAS_VECTOR_INDEX_NAME`.

**worker** (existing + ➕): `WORKER_PORT`, `WORKER_API_KEY`, `BACKEND_BASE_URL`, `MONGODB_URI`, `AI_PROVIDER`, `AI_MODEL`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ARTIFACTS_DIR`, `CLOUDINARY_*`, `WEASYPRINT_BASE_URL`,
➕`AI_VISION_PROVIDER`, ➕`AI_VISION_MODEL`, ➕`AI_IMAGE_PROVIDER`, ➕`AI_IMAGE_MODEL`, ➕`AI_EMBED_PROVIDER`, ➕`AI_EMBED_MODEL`, ➕`ATLAS_VECTOR_INDEX_NAME`, ➕`KB_CHUNK_TOKENS`, ➕`KB_TOP_K`, ➕`GENERATION_TIMEOUT_S`, ➕`PDF_RENDER_ENABLED`, ➕`FIT_STRICT` (surface residual fit issues; default `false`).

**frontend** (existing + ➕): `VITE_APP_BASE_URL` (reserved → **now used** for `/api/v1`), ➕`VITE_SSE_BASE_URL`, ➕`VITE_ENABLE_PAGED_PREVIEW`.

---

## 14. Non-Functional Requirements

- **Performance:** builder edit→preview <150 ms; template load <1 s; generation streams first token <3 s; SSE heartbeat 15 s; paginated preview handles 50-page docs.
- **Scalability:** generation off the request path (jobs); KB indexing asynchronous; artifacts on Cloudinary.
- **Reliability/failure paths:** every stage idempotent + retryable; cancellable jobs; provider outage → clear error + retry; WeasyPrint missing → HTML-only + explicit warning; OCR low-confidence → flagged; Cloudinary outage → upload fails closed with retry; generation timeout → job `failed` with partial artifacts preserved; concurrency conflict → 409.
- **Accessibility (WCAG 2.1 AA):** alt text required on media; semantic heading order; contrast checks; dyslexia-friendly font option; keyboard-operable builder; exported HTML semantic + print-accessible; tagged PDF target (best-effort — Chromium engine).
- **Observability:** structured logs (backend logger, worker), job timeline, provider status dashboard, artifact provenance.
- **i18n readiness:** template `language` + token fonts; RTL deferred but layout must not hard-code left/right.

---

## 15. Export, Print & Fidelity Verification

- **Interactive HTML export** — standalone, self-contained (inlined CSS, Cloudinary-hosted media), matching the `assests/` interactive format.
- **PDF export** — authoritative **server** render from the template JSON. **Engine order (verified on Windows):** headless **Chromium (Playwright)** → **WeasyPrint** (if the native Pango/GTK stack is present) → **HTML-only degrade** with an explicit warning (`fidelity.pdf = {available:false, engine, reason}`). Chromium is primary because WeasyPrint cannot render without Pango/GTK here; both paths honour `@page` geometry. Browser print (Paged.js + `@page`) remains a secondary instant path.
- **Fidelity contract:** export must reproduce `geometry` exactly (page size, orientation, margins, bleed, gutter, columns) and `designTokens` (colors, fonts, spacing).
- **Single source of geometry (verified):** the CSS `@page` rule emitted by `worker/app/render/html_renderer.py::build_tokens_css` is authoritative. Chromium was measured to honour the **CSS `@page` margin over the `page.pdf` margin option** (test: CSS 30 mm vs option 5 mm → text placed at 30 mm), so `pdf_renderer` sets `prefer_css_page_size=True` and passes the option margins only as a fallback. Page numbers are drawn with Chromium `display_header_footer`/`footer_template` because **Chromium ignores CSS `@page` margin boxes** (the `@bottom-right` counter is retained only for WeasyPrint).
- **Fit is enforced by measurement, not assumption** (`worker/app/render/fit.py`, the *fit gate*):
  - **Always-on CSS hardening** (`_fit_hardening_css`): `max-width:100%` on media/tables/pre/figure; `overflow-wrap:anywhere` on text/table cells; `pre{white-space:pre-wrap}`; `table-layout:fixed` (a wide table compresses + wraps instead of bleeding); `min-width:0` on grid children; `break-inside:avoid` on atomic blocks (figure/table/callout/question/answer-key/toc/glossary/cover/media); `break-after:avoid` on headings; `orphans/widows:2`; `thead{display:table-header-group}` to repeat headers across pages.
  - **Bounded auto-fit loop** (`render_html` stage): if the DOM preflight still reports error-level overflow, the renderer escalates safe tightening (`tighten=1` collapses grids to one column; `tighten=2` caps media height / tightens padding, and reduces the base font) and re-measures, up to 2 attempts. The tightened HTML is kept and recorded (`tighten-N` on `<body>`).
  - **Preflight (DOM, headless Chromium)** — measures every element against the printable content box: horizontal overflow, document overflow, and any atomic block taller than one page. Returns a serialisable `FitReport`.
  - **Post-render verification (PyMuPDF)** — page size within **±0.5 mm** of `geometry`, every glyph inside the `@page` margins, no page crossing the page edge, and no blank pages. Fonts used are recorded as metrics.
  - **Fit policy:** the report is stored beside the artifact at `document.fidelity.fit = {html, pdf}` and returned in the job result. `FIT_STRICT=true` surfaces a fit warning in the UI; by default a residual issue is reported (never a silent pass) without failing generation.
- **On-demand fit checks:** worker `POST /fit` (`scope=html|pdf|both`); backend `POST /api/v1/documents/:id/fit` (persists to `fidelity.fit`) and `POST /api/v1/templates/fit` (unsaved draft). `POST /render/html` and `GET /documents/:id/render` include the `fit` report. The Studio shows `FitBadge` (green/amber/red) in the builder live preview, the generation workspace, and the documents list.

---

## 16. Library & Maintenance ([Requirement] 13)

Unified library lists documents and templates with filters (template, tags, status, date, author), search, sort; actions: open in workspace, export (HTML/PDF), duplicate as variant, archive, delete; revision history per document; "generated from" provenance (template version + KB refs used).

---

## 17. Phased Delivery Roadmap (each phase independently runnable & verified)

**Phase 0 — Foundations.** JSON schemas + `schemaVersion`; Mongoose models; auth (JWT + cookie); RBAC; input validation + NoSQL-injection guard; job records + SSE relay; worker `/jobs` real (create/status/cancel/retry); provider registry extended to capabilities; extend `workerClient`; typify `/api/v1` contract; reconcile & retire `HandbookApiClient` legacy paths.

**Phase 1 — Template Builder + Live Preview.** Geometry editor; design-token editor; section list (add/reorder/delete from publication registry); component palette + inspector + sizers; per-section/component instructions; image-instruction panel; sample-data fixture; section-scoped + full-sample live preview; undo/redo; save/publish/validate; template export/import.

**Phase 2 — Knowledge Base.** PDF/image/link ingestion; extraction (PyMuPDF/Marker/vision OCR); chunking; embeddings + Atlas Vector Search index; tags/references; KB management UI; hybrid search endpoint.

**Phase 3 — Generation + Workspace + Renderers.** Pipeline stages; RAG retrieval wiring; content plan + fill; Jinja HTML render; WeasyPrint PDF; chat workspace split view; SSE progress; revisions (snapshot/diff/rollback); library list/save; export HTML/PDF.

**Phase 4 — In-Place AI Editing + Images + Library polish.** Block hover toolbar; selection actions; node-subtree patch application (no full re-render); replace with paste/upload/PDF/image; image generation + regeneration; duplicate-as-variant; provenance/footnotes; fidelity report.

**Phase 5 — Hardening.** Accessibility pass; performance; observability; automated test suite (below); docs; provider dashboard.

---

## 18. Test & Verification Gate (extends `AGENTS.md`)

No test suite exists today; introduce the minimum:
- **Existing gate (must keep passing):** frontend `npm run build` + `npm run lint` (`tsc --noEmit`); backend `npm run lint` + `GET /health` against a running instance; worker imports/boots (`python -m compileall worker/app` + uvicorn boots).
- **New:**
  - **Schema round-trip tests** — every component `type` renders in TS **and** Jinja; template validate rejects unknown types/missing required sections.
  - **Render snapshot tests** — preview HTML snapshot per component type.
  - **API contract tests** — request/response envelope + status codes for `/api/v1/*`.
  - **E2E generation smoke** — with a **stubbed provider**, generate a handbook fixture end to end; assert HTML + PDF artifacts + fidelity report.
  - **Page-fit tests (implemented)** — DOM preflight asserts no horizontal overflow / no atomic block taller than a page; PDF verification asserts page size within ±0.5 mm, no glyph outside the margins and no blank pages; auto-fit escalates on a too-tall block. Detector negative tests must fail-and-report (not silently pass) on synthetic overflow, margin bleed, size mismatch and blank pages.
  - **In-place edit test** — apply a patch; assert only the target subtree changed.
- **Gate rule:** a phase is "done" only when its touched app builds/lints, relevant services answer health, and its new tests pass.

---

## 19. Acceptance Criteria (measurable)

- **AC-1** A user can create a template, set format/publication type, geometry, tokens, sections, and per-section text+image instructions, and **save + publish** it.
- **AC-2** Every builder config change updates the live preview in **<150 ms**, on **sample data**, including **section-only** preview (e.g., cover page) and **full-sample** preview.
- **AC-3** Upload a PDF and a photo; the KB yields text/table/equation/image chunks with tags/references, searchable via hybrid query.
- **AC-4** From the chat workspace, selecting the template + KB tags + instruction generates a document with streamed progress, rendered paginated in the right pane.
- **AC-5** Each generation/accept creates a revision; the drawer shows diffs; rollback restores content as a new revision.
- **AC-6** Hovering a block exposes the toolbar; "Edit with AI" and selection actions return patches applied in place **without a full re-render or pagination jump**.
- **AC-7** "Replace image" and "replace part" accept upload/paste/KB pick and update only the target node.
- **AC-8** Export produces interactive **HTML** and a **PDF** whose page box dimensions match configured geometry within ±0.5 mm, with a stored fidelity report.
- **AC-9** Killing the configured provider mid-generation yields a clear, retryable job failure; generation is refused (409) while the provider is unconfigured/unreachable.
- **AC-10** The library lists/filters/search documents across templates and supports duplicate-as-variant.

---

## 20. Gap Analysis: current repo → target

| Area | Current (verified) | Action |
|---|---|---|
| Frontend model | click-step recorder (`Handbook.ts`, `HandbookEditorView`) | **Replace** with Template/Section/Component/Document model (§3.3); legacy becomes read-only importer |
| Frontend persistence | `LocalStorageHandbookRepository` | **Replace** with REST client to `/api/v1`; keep local draft autosave only |
| Frontend API client | `HandbookApiClient` legacy paths/bare arrays | **Reconcile** to `/api/v1` + envelope (`{success,message,data}`) |
| Frontend PDF | `JsPdfHandbookExporter` (jsPDF) | **Demote** to a fallback; primary export = server WeasyPrint; add Paged.js preview/browser print |
| Backend routes | `/health`, empty `handbooks`/`folders`, `jobs` 501 | **Build** auth, templates, kb, documents, revisions, jobs, providers, library |
| Backend models | none | **Add** all collections (§11) |
| Backend jobs/SSE | none | **Build** job service + SSE relay |
| Worker pipeline | 6 stub stages raising `StageNotImplemented` | **Implement** 8 stages (§7.1) |
| Worker providers | text registry + live check only | **Extend** to vision/image/embedding capabilities |
| Worker RAG/render | none | **Build** `rag/`, `render/` (Jinja + WeasyPrint) |
| Worker artifacts | `artifacts/` empty | **Populate** + serve via backend |
| Cloudinary/db | configured, connection works | **Use** for media; add Atlas Vector Search index |
| Tests/CI | none | **Add** §18 minimal suite |

---

## 21. Decisions Log & Alternatives

1. **Kept repo layout (`frontend/backend/worker`)** vs draft `apps/packages`. *Alternative:* migrate to npm workspaces later if the component library must be published — not now.
2. **MongoDB Atlas (metadata + vector)** vs Postgres+pgvector/Qdrant. *Alternative:* pgvector or Qdrant if Atlas ANN proves insufficient at scale.
3. **Headless Chromium (Playwright) server PDF authoritative** (revised after Phase 0 spike). *Verified:* WeasyPrint installs but **cannot render on this Windows machine** (no native Pango/GTK), so Chromium is primary; WeasyPrint is a fallback when its native stack exists; HTML-only degrade otherwise. Client Paged.js browser print stays as a secondary instant path.
4. **JSON contract shared across TS + Python** vs a shared package. Chosen for the polyglot boundary.
5. **In-process worker queue + Mongo job records** vs Redis. *Alternative:* BullMQ + Redis when concurrency grows.
6. **JWT + httpOnly cookie** (matches existing frontend 401 flow) vs server sessions.
7. **Publication types as an extensible registry** so "many more" is data, not code.

---

## 22. Open Questions (decide before Phases 3–5)

- Q1 — Image-generation provider default candidates and cost/safety policy (blocked-until-approved?).
- Q2 — Citation rendering style defaults per publication type.
- Q3 — Multi-tenant workspaces vs single-workspace for v1 (affects indexes/RBAC).
- Q4 — Offline/self-host render fallback if Cloudinary is unavailable.
- Q5 — PDF/UA accessibility depth (tagged structure vs best-effort).

---

## 23. Quick-start commands (repo)

```bash
# install
npm --prefix frontend install && npm --prefix backend install
npm run worker:setup            # creates worker/.venv, installs requirements

# run (ports: frontend 3000, backend 5000, worker 8000 — free them first)
npm run dev:backend
npm run dev:frontend
npm run worker:dev

# verify (gate)
npm run lint:frontend && npm run build:frontend
npm run lint:backend
curl http://localhost:5000/health
curl -H "X-Worker-Key: $WORKER_API_KEY" http://localhost:8000/provider/status
```

---

## 24. Implementation Status (cross-verified 2026-10-12)

> Verified by running the whole stack (worker `:8000`, backend `:5000`, studio on `:5199`) and exercising every path below. Where this section disagrees with an earlier "target" statement in this document, **this section reflects observed behaviour** (per `AGENTS.md`: trust the observation, fix the document).

### 24.1 Verified working (with evidence)
- **Worker pipeline** — 8 stages `intake → inspect_materials → retrieve → plan_content → fill_sections → generate_images → render_html → render_pdf` complete via `POST /generate`; the instructor variant adds an answer-key section (6 sections).
- **PDF** — **Chromium** engine; measured page box **210.2 × 297.0 mm (A4)**; `fidelity.pdf = {available:true, engine:"chromium"}`. Setting `PDF_RENDER_ENABLED=false` returns `available:false` with a reason and degrades to HTML-only.
- **Backend API** — `auth` (register/login/logout/me, JWT + cookie); `templates` (CRUD, duplicate, validate, render, preview); `documents` (generate, get, render, pdf, artifact, revisions, rollback, edit-block); `jobs` (list/get/SSE); `kb` (sources/chunks/tags/search); `providers` (status). `GET /health` → `database:connected`.
- **Studio UI (headless-Chromium E2E, every step PASS):** load → sign in → Providers capability matrix → create template → **live preview rendered** (builder posts the unsaved draft to `POST /templates/preview`) → change a design token → Generate → **progress streamed** → document preview rendered → **in-place block edit applied** → **revision saved** → legacy-workspace switch.
- **Failure paths verified:** provider unconfigured → **409**; worker unreachable → **502**; unknown component type → **422**; missing auth → **401**; unknown document/job/template → **404**; cross-user access → **404 / 0 results**.
- **Knowledge base** — text ingest → 3 chunks; `POST /kb/search` returns `keyword-bm25-proxy` hits; `GET /kb/tags` lists tags.
- **PRD download** — `GET /api/v1/prd` (append `?download=1` to force a file save) and the studio **Download PRD** button.
- **Page-fit gate (centre of G7; verified 2026-10-12)** — geometry is single-source in CSS `@page`; `worker/app/render/fit.py` provides a DOM **preflight** (headless Chromium) and **PDF verification** (PyMuPDF). Evidence:
  - Hostile content (unbreakable 200-char URL, 8-column table, 300-char code line, callout) that previously overflowed (DOM offenders up to 3095 px vs a 658 px content box; PDF text past the right margin) now measures **0 offenders / 0 tall blocks** and the PDF shows **no block outside the margins** (page-2 body text left edges all at 51.0 pt; page-1 table = 8 evenly-spaced columns at ≈61.7 pt pitch).
  - **Auto-fit loop engaged** for a 4000 px-tall image: stage log `render_html … fit=ok; auto-fit x2`; artifact body carries `tighten-2`; HTML **and** PDF fit reports `ok:true`.
  - **Detector is not a rubber stamp** — synthetic negative tests all PASS: nowrap line → `horizontal_overflow`; 2000 px callout → `block_taller_than_page`; 0-margin PDF vs 20/18 mm geometry → `horizontal_bleed`/`top_bleed`; 210×297 PDF vs 300×400 geometry → `page_size_mismatch`; crafted empty page → `blank_page`. Landscape geometry normalises to 297×210 mm in both CSS and the PDF.
  - **Page numbers now render** via Chromium `display_header_footer` (previously silently dropped by the CSS `@page` counter); PDF-disabled degrades to `fit.pdf = {checked:false, ok:true, reason:"PDF_RENDER_ENABLED=false"}`.
  - **Wired end to end:** job result + `document.fidelity.fit = {html,pdf}`; `POST /fit` (worker), `POST /api/v1/documents/:id/fit`, `POST /api/v1/templates/fit`; `FitBadge` in builder preview, generation workspace and documents list; headless-UI E2E asserts builder/preview `fits`, `Verify PDF fit` `fits`, generated `html fit` + `pdf fit` `fits`, and an on-demand `Fit check`.

### 24.2 Gaps still open (relative to §10)
- Template `publish` / `archive` / `sample` / `schema` / `export` / `import`.
- Document `PUT` / `DELETE` / `replace-part` / `regenerate-image`.
- Library view; job `cancel` / `retry`; `PUT /providers/config`.
- Worker `/kb/embed`, `/kb/search`, `/edit-block`, `/image/generate`.
- **Embeddings:** the Atlas Vector Search index is not created; retrieval uses the keyword proxy. Hybrid/vector search is planned (§6.3).
- **Provider keys:** none are configured; the deterministic dev `stub` provider (`AI_PROVIDER=stub`) drives and verifies the pipeline. Real text/vision/image/embedding providers are implemented but **unverified against live APIs**.
- The `providers` collection (§11) is not created (provider mapping is config-only).
- In-place editing today uses the block-patch path (`edit-block`); AI selection/regeneration and "replace part" / "regenerate image" UI are not built.

### 24.3 Verification commands
```bash
curl http://localhost:5000/health
curl -H "X-Worker-Key: $WORKER_API_KEY" http://localhost:8000/provider/status
# fit gate: DOM preflight + real-PDF verification (scope: html|pdf|both)
curl -s -X POST http://localhost:8000/fit -H "X-Worker-Key: $WORKER_API_KEY" \
  -H "Content-Type: application/json" -d '{"template":{...},"scope":"both"}'
curl -s -X POST http://localhost:5000/api/v1/documents/$DOC_ID/fit -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"scope":"both"}'
curl http://localhost:5000/api/v1/prd | head
npm --prefix frontend run lint && npm --prefix frontend run build
npm --prefix backend run lint
```

---

### Definition of Done for the implementing agent
A phase is done only when: touched apps build & lint clean; `/health` answers on a running instance; the worker imports/boots; new tests (§18) pass; the phase's acceptance criteria (§19) are demonstrably met on the real running stack; observed behavior contradicts no claim made in this document.
