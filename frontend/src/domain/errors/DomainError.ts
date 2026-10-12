export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'ENTITY_NOT_FOUND'
  | 'CONCURRENCY_CONFLICT'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'STORAGE_CORRUPTED'
  | 'EXPORT_PRECONDITION_FAILED'
  | 'INVALID_STATE_TRANSITION'
  | 'DUPLICATE_ENTITY'
  | 'EMPTY_STEPS_COLLECTION';

export class DomainError extends Error {
  public readonly code: ErrorCode;
  public readonly details: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export type Result<T, E = DomainError> =
  | { readonly ok: true; readonly value: T; readonly warnings?: string[] }
  | { readonly ok: false; readonly error: E };

export const Result = {
  ok<T>(value: T, warnings?: string[]): Result<T, never> {
    return warnings && warnings.length > 0
      ? { ok: true, value, warnings }
      : { ok: true, value };
  },
  fail<E = DomainError>(error: E): Result<never, E> {
    return { ok: false, error };
  },
};
