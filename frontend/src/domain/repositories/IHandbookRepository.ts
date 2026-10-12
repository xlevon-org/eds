import {
  Handbook,
  HandbookFolder,
  PrintConfiguration,
} from '../entities/Handbook';
import { Result } from '../errors/DomainError';

/**
 * Interface Segregation Principle (ISP):
 * Segregated read, write, folder, template, and PDF export contracts.
 */
export interface IHandbookReader {
  getAll(): Result<ReadonlyArray<Handbook>>;
  getById(id: string): Result<Handbook>;
  getStorageHealth(): {
    backend: 'localStorage' | 'memoryFallback';
    usedBytes: number;
    corruptedRecoveriesCount: number;
  };
}

export interface IHandbookWriter {
  save(handbook: Handbook, expectedRevision?: number): Result<Handbook>;
  deletePermanently(id: string): Result<boolean>;
  resetToFactorySeed(): Result<ReadonlyArray<Handbook>>;
}

export interface IHandbookRepository extends IHandbookReader, IHandbookWriter {}

export interface IFolderRepository {
  getFolders(): Result<ReadonlyArray<HandbookFolder>>;
  createFolder(name: string, departmentCode: string, description: string): Result<HandbookFolder>;
}

export interface PdfExportArtifact {
  readonly filename: string;
  readonly pageCount: number;
  readonly byteSize: number;
  readonly generatedAt: string;
  readonly dataUri?: string;
  readonly warnings: ReadonlyArray<string>;
}

export interface IPdfExporter {
  exportHandbookToPdf(
    handbook: Handbook,
    config: PrintConfiguration
  ): Promise<Result<PdfExportArtifact>>;
}

export interface CurriculumTemplate {
  readonly templateId: string;
  readonly name: string;
  readonly category: 'STEM & Lab' | 'LMS & Digital Tools' | 'Computer Science' | 'IEP & Accessibility';
  readonly gradeBand: string;
  readonly courseCode: string;
  readonly estimatedMinutes: number;
  readonly summary: string;
  readonly buildHandbook: (authorName: string, folderId: string) => Handbook;
}

export interface ITemplateGenerator {
  getTemplates(): ReadonlyArray<CurriculumTemplate>;
  instantiateTemplate(
    templateId: string,
    authorName: string,
    folderId: string
  ): Result<Handbook>;
}
