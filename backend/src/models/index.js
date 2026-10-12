import mongoose from 'mongoose';

const { Schema } = mongoose;

// Expose a stable `id` (string) alongside `_id`, and drop `__v` from responses.
const baseOptions = { timestamps: true, versionKey: false, toJSON: { virtuals: true } };

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: '' },
    role: { type: String, enum: ['owner', 'editor', 'viewer'], default: 'owner' },
  },
  baseOptions
);

const TemplateSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    formatType: { type: String, enum: ['PDF_PRINT', 'RESPONSIVE_HTML', 'BOTH'], default: 'BOTH' },
    publicationType: { type: String, default: 'HANDBOOK' },
    pageSize: { type: String, default: 'A4' },
    geometry: { type: Schema.Types.Mixed, default: {} },
    designTokens: { type: Schema.Types.Mixed, default: {} },
    sections: { type: [Schema.Types.Mixed], default: [] },
    documentDefaults: { type: Schema.Types.Mixed, default: {} },
    version: { type: Number, default: 1 },
    status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT' },
  },
  baseOptions
);

const DocumentSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    title: { type: String, required: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'Template', index: true },
    templateVersion: { type: Number, default: 1 },
    variant: { type: String, default: 'STUDENT' },
    status: { type: String, enum: ['draft', 'generating', 'completed', 'error'], default: 'draft' },
    content: { type: Schema.Types.Mixed, default: {} },
    artifacts: { type: Schema.Types.Mixed, default: {} },
    fidelity: { type: Schema.Types.Mixed, default: {} },
    revision: { type: Number, default: 1 },
  },
  baseOptions
);

const RevisionSchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', index: true },
    versionNum: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, default: {} },
    changelog: { type: String, default: '' },
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseOptions
);
RevisionSchema.index({ documentId: 1, versionNum: 1 }, { unique: true });

const JobSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    type: { type: String, default: 'generate' },
    status: { type: String, default: 'queued' },
    stage: { type: String, default: null },
    pct: { type: Number, default: 0 },
    message: { type: String, default: '' },
    stages: { type: [Schema.Types.Mixed], default: [] },
    documentId: { type: Schema.Types.ObjectId, ref: 'Document' },
    workerJobId: { type: String, default: '' },
    input: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed, default: null },
    error: { type: Schema.Types.Mixed, default: null },
  },
  baseOptions
);

const KbSourceSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['PDF', 'IMAGE', 'LINK', 'TEXT'], default: 'TEXT' },
    status: { type: String, default: 'uploaded' },
    text: { type: String, default: '' },
    cloudinaryId: { type: String, default: '' },
    chunkCount: { type: Number, default: 0 },
  },
  baseOptions
);

const KbChunkSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    sourceId: { type: Schema.Types.ObjectId, ref: 'KbSource', index: true },
    parentChunkId: { type: Schema.Types.ObjectId, ref: 'KbChunk' },
    subject: { type: String, default: '' },
    unitName: { type: String, default: '' },
    chapterTitle: { type: String, default: '' },
    pageNumber: { type: Number, default: 0 },
    assetType: { type: String, enum: ['TEXT', 'TABLE', 'DIAGRAM', 'IMAGE', 'EQUATION'], default: 'TEXT' },
    content: { type: String, required: true },
    tags: { type: [String], default: [] },
    references: { type: [String], default: [] },
    embedding: { type: [Number], default: undefined },
  },
  baseOptions
);
KbChunkSchema.index({ ownerId: 1, tags: 1, assetType: 1 });

export const User = mongoose.model('User', UserSchema);
export const Template = mongoose.model('Template', TemplateSchema);
export const Document = mongoose.model('Document', DocumentSchema);
export const Revision = mongoose.model('Revision', RevisionSchema);
export const Job = mongoose.model('Job', JobSchema);
export const KbSource = mongoose.model('KbSource', KbSourceSchema);
export const KbChunk = mongoose.model('KbChunk', KbChunkSchema);
