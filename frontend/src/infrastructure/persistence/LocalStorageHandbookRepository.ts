import { Handbook, HandbookDomainPolicy, HandbookFolder } from '../../domain/entities/Handbook';
import { DomainError, Result } from '../../domain/errors/DomainError';
import {
  IFolderRepository,
  IHandbookRepository,
} from '../../domain/repositories/IHandbookRepository';
import {
  INITIAL_FOLDERS,
  INITIAL_SEED_HANDBOOKS,
} from '../templates/CurriculumTemplateGenerator';

const HANDBOOKS_STORAGE_KEY = 'up_edu_handbooks_v2';
const FOLDERS_STORAGE_KEY = 'up_edu_folders_v2';

export class LocalStorageHandbookRepository implements IHandbookRepository, IFolderRepository {
  private memoryStore: Map<string, Handbook> = new Map();
  private memoryFolders: Map<string, HandbookFolder> = new Map();
  private usingMemoryFallback = false;
  private corruptedRecoveriesCount = 0;

  constructor(private readonly forceMemoryOnly = false) {
    if (forceMemoryOnly || typeof window === 'undefined' || !window.localStorage) {
      this.usingMemoryFallback = true;
    }
    this.initializeSeedData();
  }

  private initializeSeedData(): void {
    for (const folder of INITIAL_FOLDERS) {
      this.memoryFolders.set(folder.id, folder);
    }

    if (this.usingMemoryFallback) {
      for (const hb of INITIAL_SEED_HANDBOOKS) {
        this.memoryStore.set(hb.id, hb);
      }
      return;
    }

    try {
      const rawHandbooks = window.localStorage.getItem(HANDBOOKS_STORAGE_KEY);
      if (!rawHandbooks) {
        this.persistAllToStorage(INITIAL_SEED_HANDBOOKS);
      } else {
        const parsed = JSON.parse(rawHandbooks);
        if (!Array.isArray(parsed) || !this.isValidHandbookArray(parsed)) {
          this.corruptedRecoveriesCount += 1;
          this.persistAllToStorage(INITIAL_SEED_HANDBOOKS);
        } else {
          for (const hb of parsed) {
            this.memoryStore.set(hb.id, hb);
          }
        }
      }

      const rawFolders = window.localStorage.getItem(FOLDERS_STORAGE_KEY);
      if (!rawFolders) {
        window.localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(INITIAL_FOLDERS));
      } else {
        const parsedFolders = JSON.parse(rawFolders);
        if (Array.isArray(parsedFolders)) {
          for (const f of parsedFolders) {
            if (f && typeof f.id === 'string' && typeof f.name === 'string') {
              this.memoryFolders.set(f.id, f);
            }
          }
        }
      }
    } catch {
      this.corruptedRecoveriesCount += 1;
      this.usingMemoryFallback = true;
      this.memoryStore.clear();
      for (const hb of INITIAL_SEED_HANDBOOKS) {
        this.memoryStore.set(hb.id, hb);
      }
    }
  }

  private isValidHandbookArray(arr: unknown[]): arr is Handbook[] {
    return arr.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Handbook).id === 'string' &&
        typeof (item as Handbook).title === 'string' &&
        Array.isArray((item as Handbook).steps)
    );
  }

  private persistAllToStorage(handbooks: ReadonlyArray<Handbook>): Result<boolean> {
    this.memoryStore.clear();
    for (const hb of handbooks) {
      this.memoryStore.set(hb.id, hb);
    }

    if (this.usingMemoryFallback) {
      return Result.ok(true, ['Saved to in-memory session store.']);
    }

    try {
      const serialized = JSON.stringify(handbooks);
      window.localStorage.setItem(HANDBOOKS_STORAGE_KEY, serialized);
      return Result.ok(true);
    } catch (err) {
      this.usingMemoryFallback = true;
      return Result.ok(true, [
        `Browser storage full or restricted (${
          err instanceof Error ? err.message : 'Storage Error'
        }). Automatically switched to in-memory storage without losing work.`,
      ]);
    }
  }

  public injectCorruptedPayloadForVerification(): void {
    if (!this.usingMemoryFallback && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(HANDBOOKS_STORAGE_KEY, '{corrupted_json_payload: [unclosed');
    } else {
      this.corruptedRecoveriesCount += 1;
    }
  }

  getAll(): Result<ReadonlyArray<Handbook>> {
    if (!this.usingMemoryFallback && typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(HANDBOOKS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && this.isValidHandbookArray(parsed)) {
            this.memoryStore.clear();
            for (const hb of parsed) {
              this.memoryStore.set(hb.id, hb);
            }
          } else {
            this.corruptedRecoveriesCount += 1;
            this.persistAllToStorage(Array.from(this.memoryStore.values()));
          }
        }
      } catch {
        this.corruptedRecoveriesCount += 1;
        this.persistAllToStorage(
          this.memoryStore.size > 0
            ? Array.from(this.memoryStore.values())
            : INITIAL_SEED_HANDBOOKS
        );
      }
    }

    const list = Array.from(this.memoryStore.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return Result.ok(list);
  }

  getById(id: string): Result<Handbook> {
    const allResult = this.getAll();
    if (!allResult.ok) return allResult;

    const found = this.memoryStore.get(id);
    if (!found) {
      return Result.fail(
        new DomainError('ENTITY_NOT_FOUND', `Handbook with ID "${id}" does not exist.`, { id })
      );
    }
    return Result.ok(found);
  }

  save(handbook: Handbook, expectedRevision?: number): Result<Handbook> {
    const existing = this.memoryStore.get(handbook.id);

    if (
      existing &&
      expectedRevision !== undefined &&
      existing.revision !== expectedRevision
    ) {
      return Result.fail(
        new DomainError(
          'CONCURRENCY_CONFLICT',
          `Concurrency conflict detected: Handbook "${handbook.title}" is at revision ${existing.revision}, but update expected revision ${expectedRevision}.`,
          {
            handbookId: handbook.id,
            actualRevision: existing.revision,
            expectedRevision,
          }
        )
      );
    }

    this.memoryStore.set(handbook.id, handbook);
    const persistResult = this.persistAllToStorage(Array.from(this.memoryStore.values()));

    return Result.ok(handbook, persistResult.ok ? persistResult.warnings : undefined);
  }

  deletePermanently(id: string): Result<boolean> {
    const existing = this.memoryStore.get(id);
    if (!existing) {
      return Result.fail(
        new DomainError('ENTITY_NOT_FOUND', `Cannot delete non-existent handbook "${id}".`, { id })
      );
    }

    this.memoryStore.delete(id);
    this.persistAllToStorage(Array.from(this.memoryStore.values()));
    return Result.ok(true);
  }

  resetToFactorySeed(): Result<ReadonlyArray<Handbook>> {
    this.persistAllToStorage(INITIAL_SEED_HANDBOOKS);
    return this.getAll();
  }

  getStorageHealth(): {
    backend: 'localStorage' | 'memoryFallback';
    usedBytes: number;
    corruptedRecoveriesCount: number;
  } {
    const serialized = JSON.stringify(Array.from(this.memoryStore.values()));
    return {
      backend: this.usingMemoryFallback ? 'memoryFallback' : 'localStorage',
      usedBytes: serialized.length * 2,
      corruptedRecoveriesCount: this.corruptedRecoveriesCount,
    };
  }

  getFolders(): Result<ReadonlyArray<HandbookFolder>> {
    return Result.ok(Array.from(this.memoryFolders.values()));
  }

  createFolder(name: string, departmentCode: string, description: string): Result<HandbookFolder> {
    const cleanName = HandbookDomainPolicy.sanitizeText(name);
    const cleanDept = HandbookDomainPolicy.sanitizeText(departmentCode).toUpperCase();
    if (cleanName.length < 2) {
      return Result.fail(
        new DomainError('VALIDATION_FAILED', 'Folder name must be at least 2 characters.')
      );
    }
    if (cleanDept.length < 2 || cleanDept.length > 16) {
      return Result.fail(
        new DomainError('VALIDATION_FAILED', 'Folder code must be 2–16 characters.')
      );
    }

    const exists = Array.from(this.memoryFolders.values()).some(
      (f) => f.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      return Result.fail(
        new DomainError('DUPLICATE_ENTITY', `A folder named "${cleanName}" already exists.`)
      );
    }

    const folder: HandbookFolder = {
      id: `folder-${Date.now().toString(36)}`,
      name: cleanName,
      departmentCode: cleanDept,
      description: HandbookDomainPolicy.sanitizeText(description) || 'Class handbook folder',
    };

    this.memoryFolders.set(folder.id, folder);
    if (!this.usingMemoryFallback && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(
          FOLDERS_STORAGE_KEY,
          JSON.stringify(Array.from(this.memoryFolders.values()))
        );
      } catch {
        // Retain in memory
      }
    }
    return Result.ok(folder);
  }
}
