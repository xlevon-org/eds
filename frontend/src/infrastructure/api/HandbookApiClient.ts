import {
  Handbook,
  HandbookDomainPolicy,
  HandbookFolder,
} from '../../domain/entities/Handbook';
import { DomainError, Result } from '../../domain/errors/DomainError';
import {
  IFolderRepository,
  IHandbookRepository,
} from '../../domain/repositories/IHandbookRepository';
import {
  INITIAL_FOLDERS,
  INITIAL_SEED_HANDBOOKS,
} from '../templates/CurriculumTemplateGenerator';

export interface ApiClientConfig {
  readonly baseUrl: string;
  readonly headers?: Record<string, string>;
}

/**
 * Clean Architecture Backend API Client Adapter
 * Ready for drop-in REST backend integration (/api/handbooks, /api/folders)
 * while preserving full DomainError and Result<T, DomainError> contracts.
 */
export class HandbookApiClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(config?: Partial<ApiClientConfig>) {
    this.baseUrl = config?.baseUrl || '/api';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...(config?.headers || {}),
    };
  }

  async fetchHandbooks(): Promise<Result<ReadonlyArray<Handbook>>> {
    try {
      const response = await fetch(`${this.baseUrl}/handbooks`, {
        method: 'GET',
        headers: this.defaultHeaders,
      });
      if (!response.ok) {
        return Result.fail(
          new DomainError('STORAGE_CORRUPTED', `Backend returned HTTP ${response.status}`)
        );
      }
      const data = (await response.json()) as Handbook[];
      return Result.ok(data);
    } catch (err) {
      return Result.fail(
        new DomainError(
          'STORAGE_CORRUPTED',
          err instanceof Error ? err.message : 'Network request failed'
        )
      );
    }
  }

  async saveHandbook(handbook: Handbook, expectedRevision?: number): Promise<Result<Handbook>> {
    try {
      const response = await fetch(`${this.baseUrl}/handbooks/${encodeURIComponent(handbook.id)}`, {
        method: 'PUT',
        headers: this.defaultHeaders,
        body: JSON.stringify({ handbook, expectedRevision }),
      });
      if (response.status === 409) {
        return Result.fail(
          new DomainError('CONCURRENCY_CONFLICT', 'Remote revision conflict detected.')
        );
      }
      if (!response.ok) {
        return Result.fail(
          new DomainError('VALIDATION_FAILED', `Failed to save handbook (HTTP ${response.status})`)
        );
      }
      const saved = (await response.json()) as Handbook;
      return Result.ok(saved);
    } catch (err) {
      return Result.fail(
        new DomainError(
          'STORAGE_CORRUPTED',
          err instanceof Error ? err.message : 'Network request failed'
        )
      );
    }
  }

  async deleteHandbook(id: string): Promise<Result<boolean>> {
    try {
      const response = await fetch(`${this.baseUrl}/handbooks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.defaultHeaders,
      });
      if (!response.ok) {
        return Result.fail(
          new DomainError('ENTITY_NOT_FOUND', `Failed to delete handbook (HTTP ${response.status})`)
        );
      }
      return Result.ok(true);
    } catch (err) {
      return Result.fail(
        new DomainError(
          'STORAGE_CORRUPTED',
          err instanceof Error ? err.message : 'Network request failed'
        )
      );
    }
  }

  async fetchFolders(): Promise<Result<ReadonlyArray<HandbookFolder>>> {
    try {
      const response = await fetch(`${this.baseUrl}/folders`, {
        method: 'GET',
        headers: this.defaultHeaders,
      });
      if (!response.ok) {
        return Result.fail(
          new DomainError('STORAGE_CORRUPTED', `Backend returned HTTP ${response.status}`)
        );
      }
      const data = (await response.json()) as HandbookFolder[];
      return Result.ok(data);
    } catch (err) {
      return Result.fail(
        new DomainError(
          'STORAGE_CORRUPTED',
          err instanceof Error ? err.message : 'Network request failed'
        )
      );
    }
  }
}

/**
 * Liskov-Substitutable Remote Backend Repository Adapter (`IHandbookRepository` & `IFolderRepository`).
 * Maintains an optimistic local state cache synchronized with `HandbookApiClient` for zero-latency
 * UI rendering and seamless drop-in replacement in `DependencyProvider`.
 */
export class RemoteApiHandbookRepository implements IHandbookRepository, IFolderRepository {
  private handbooksCache: Handbook[];
  private foldersCache: HandbookFolder[];
  private readonly apiClient: HandbookApiClient;

  constructor(
    apiClient: HandbookApiClient = new HandbookApiClient(),
    initialHandbooks: ReadonlyArray<Handbook> = INITIAL_SEED_HANDBOOKS,
    initialFolders: ReadonlyArray<HandbookFolder> = INITIAL_FOLDERS
  ) {
    this.apiClient = apiClient;
    this.handbooksCache = [...initialHandbooks];
    this.foldersCache = [...initialFolders];
  }

  async syncFromRemoteBackend(): Promise<Result<{ handbooksCount: number; foldersCount: number }>> {
    const [hbRes, folderRes] = await Promise.all([
      this.apiClient.fetchHandbooks(),
      this.apiClient.fetchFolders(),
    ]);
    if (!hbRes.ok) return hbRes;
    if (!folderRes.ok) return folderRes;

    this.handbooksCache = [...hbRes.value];
    this.foldersCache = [...folderRes.value];
    return Result.ok({
      handbooksCount: this.handbooksCache.length,
      foldersCount: this.foldersCache.length,
    });
  }

  getAll(): Result<ReadonlyArray<Handbook>> {
    return Result.ok([...this.handbooksCache]);
  }

  getById(id: string): Result<Handbook> {
    const found = this.handbooksCache.find((h) => h.id === id);
    if (!found) {
      return Result.fail(new DomainError('ENTITY_NOT_FOUND', `Handbook "${id}" not found.`));
    }
    return Result.ok(found);
  }

  getStorageHealth() {
    return {
      backend: 'memoryFallback' as const,
      usedBytes: JSON.stringify(this.handbooksCache).length,
      corruptedRecoveriesCount: 0,
    };
  }

  save(handbook: Handbook, expectedRevision?: number): Result<Handbook> {
    const existingIdx = this.handbooksCache.findIndex((h) => h.id === handbook.id);
    if (existingIdx >= 0) {
      const current = this.handbooksCache[existingIdx];
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        return Result.fail(
          new DomainError(
            'CONCURRENCY_CONFLICT',
            `Concurrency conflict detected: Handbook "${current.title}" is at revision ${current.revision}, but update expected revision ${expectedRevision}.`
          )
        );
      }
      this.handbooksCache[existingIdx] = handbook;
    } else {
      this.handbooksCache = [handbook, ...this.handbooksCache];
    }

    void this.apiClient.saveHandbook(handbook, expectedRevision);
    return Result.ok(handbook);
  }

  deletePermanently(id: string): Result<boolean> {
    const exists = this.handbooksCache.some((h) => h.id === id);
    if (!exists) {
      return Result.fail(new DomainError('ENTITY_NOT_FOUND', `Handbook "${id}" not found.`));
    }
    this.handbooksCache = this.handbooksCache.filter((h) => h.id !== id);
    void this.apiClient.deleteHandbook(id);
    return Result.ok(true);
  }

  resetToFactorySeed(): Result<ReadonlyArray<Handbook>> {
    this.handbooksCache = [...INITIAL_SEED_HANDBOOKS];
    return Result.ok([...this.handbooksCache]);
  }

  getFolders(): Result<ReadonlyArray<HandbookFolder>> {
    return Result.ok([...this.foldersCache]);
  }

  createFolder(
    name: string,
    departmentCode: string,
    description: string
  ): Result<HandbookFolder> {
    const cleanName = HandbookDomainPolicy.sanitizeText(name);
    const cleanCode = HandbookDomainPolicy.sanitizeText(departmentCode).toUpperCase();
    if (cleanName.length < 2) {
      return Result.fail(
        new DomainError('VALIDATION_FAILED', 'Folder name must be at least 2 characters.')
      );
    }
    if (cleanCode.length < 2 || cleanCode.length > 16) {
      return Result.fail(
        new DomainError('VALIDATION_FAILED', 'Folder code must be 2–16 characters.')
      );
    }
    if (this.foldersCache.some((f) => f.name.toLowerCase() === cleanName.toLowerCase())) {
      return Result.fail(
        new DomainError('DUPLICATE_ENTITY', `Folder "${cleanName}" already exists.`)
      );
    }
    const created: HandbookFolder = {
      id: `folder-${Date.now().toString(36)}`,
      name: cleanName,
      departmentCode: cleanCode,
      description: HandbookDomainPolicy.sanitizeText(description) || 'Custom class folder',
    };
    this.foldersCache = [...this.foldersCache, created];
    return Result.ok(created);
  }
}
