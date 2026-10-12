import { DomainError, Result } from '../errors/DomainError';

export enum StepType {
  ACTION = 'ACTION',
  TIP = 'TIP',
  WARNING = 'WARNING',
  HEADER = 'HEADER',
  CHECKPOINT = 'CHECKPOINT',
}

export enum HandbookStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum HandbookKind {
  STEP_GUIDE = 'STEP_GUIDE',
  COURSE_PAGE_PACKET = 'COURSE_PAGE_PACKET',
}

export interface ClickTargetAnnotation {
  readonly xPercent: number; // Clamped [4, 96]
  readonly yPercent: number; // Clamped [4, 96]
  readonly label: string;
  readonly highlightColor: string;
}

export interface ScreenMockupState {
  readonly appTitle: string;
  readonly urlBar: string;
  readonly activeElementLabel: string;
  readonly screenTheme: 'lms-canvas' | 'lab-simulator' | 'git-terminal' | 'chromebook-os' | 'iep-portal';
  readonly redactedPii: boolean;
  readonly zoomScale: number; // Clamped [1.0, 2.5]
}

export interface HandbookStep {
  readonly id: string;
  readonly orderIndex: number; // 1-indexed sequential
  readonly type: StepType;
  readonly title: string;
  readonly description: string;
  readonly expectedStudentOutcome?: string;
  readonly annotation?: ClickTargetAnnotation;
  readonly mockup?: ScreenMockupState;
  readonly durationMinutes: number;
  readonly isRequiredForSignOff: boolean;
}

export interface HandbookVersion {
  readonly versionId: string;
  readonly versionNumber: string; // e.g., "v1.0", "v1.1"
  readonly createdAt: string;
  readonly authorName: string;
  readonly changeSummary: string;
  readonly stepCount: number;
  readonly snapshotSteps: ReadonlyArray<HandbookStep>;
  readonly snapshotTitle: string;
}

export interface Handbook {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly courseCode: string;
  readonly gradeLevel: string;
  readonly academicTerm: string;
  readonly authorName: string;
  readonly departmentFolderId: string;
  readonly status: HandbookStatus;
  readonly kind: HandbookKind;
  readonly isStarred: boolean;
  readonly isTrashed: boolean;
  readonly revision: number; // Optimistic concurrency control counter
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly viewCount: number;
  readonly downloadedPdfCount: number;
  readonly steps: ReadonlyArray<HandbookStep>;
  readonly versions: ReadonlyArray<HandbookVersion>;
}

export interface HandbookFolder {
  readonly id: string;
  readonly name: string;
  readonly departmentCode: string;
  readonly description: string;
}

export interface PrintConfiguration {
  readonly paperSize: 'LETTER' | 'A4';
  readonly includeCoverPage: boolean;
  readonly includeTableOfContents: boolean;
  readonly includeScreenshots: boolean;
  readonly includeTeacherNotes: boolean;
  readonly includeStudentSignOffSheet: boolean;
  readonly redactAllStudentPii: boolean;
  readonly institutionName: string;
  readonly copiesCount: number;
}

export interface CaptureActionEvent {
  readonly targetLabel: string;
  readonly urlBar: string;
  readonly xPercent: number;
  readonly yPercent: number;
  readonly screenTheme: ScreenMockupState['screenTheme'];
  readonly actionVerb: 'Click' | 'Type' | 'Verify' | 'Select' | 'Submit';
  readonly inputDetail?: string;
}

/**
 * Pure Domain Validation & Sanitization Policies
 * Zero external framework dependencies (Clean Architecture Inner Circle).
 */
export const HandbookDomainPolicy = {
  MAX_TITLE_LENGTH: 140,
  MIN_TITLE_LENGTH: 3,
  MAX_STEPS_PER_HANDBOOK: 100,
  MAX_STEP_TITLE_LENGTH: 220,

  sanitizeText(raw: string): string {
    if (typeof raw !== 'string') return '';
    return raw
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[REDACTED_SCRIPT]')
      .trim();
  },

  redactPiiPatterns(text: string): string {
    return text
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED-SSN]')
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[student@school.edu]')
      .replace(/\bSTU-\d{5,9}\b/gi, 'STU-XXXXX');
  },

  clampCoordinate(coord: number): number {
    if (Number.isNaN(coord) || !Number.isFinite(coord)) return 50;
    return Math.min(96, Math.max(4, Math.round(coord * 10) / 10));
  },

  clampZoom(zoom: number): number {
    if (Number.isNaN(zoom) || !Number.isFinite(zoom)) return 1.0;
    return Math.min(2.5, Math.max(1.0, Math.round(zoom * 100) / 100));
  },

  normalizeStepOrder(steps: ReadonlyArray<HandbookStep>): ReadonlyArray<HandbookStep> {
    return steps.map((step, index) => ({
      ...step,
      orderIndex: index + 1,
    }));
  },

  validateHandbookMetadata(input: {
    title: string;
    courseCode: string;
    gradeLevel: string;
    authorName: string;
  }): Result<{
    title: string;
    courseCode: string;
    gradeLevel: string;
    authorName: string;
  }> {
    const cleanTitle = this.sanitizeText(input.title);
    const cleanCourse = this.sanitizeText(input.courseCode).toUpperCase();
    const cleanGrade = this.sanitizeText(input.gradeLevel);
    const cleanAuthor = this.sanitizeText(input.authorName);

    if (cleanTitle.length < this.MIN_TITLE_LENGTH) {
      return Result.fail(
        new DomainError(
          'VALIDATION_FAILED',
          `Handbook title must be at least ${this.MIN_TITLE_LENGTH} characters long.`,
          { field: 'title', providedLength: cleanTitle.length }
        )
      );
    }

    if (cleanTitle.length > this.MAX_TITLE_LENGTH) {
      return Result.fail(
        new DomainError(
          'VALIDATION_FAILED',
          `Handbook title cannot exceed ${this.MAX_TITLE_LENGTH} characters.`,
          { field: 'title', providedLength: cleanTitle.length }
        )
      );
    }

    if (!cleanCourse || cleanCourse.length < 2 || cleanCourse.length > 24) {
      return Result.fail(
        new DomainError(
          'VALIDATION_FAILED',
          'Course code must be between 2 and 24 characters (for example: BIO-101 or CS-204).',
          { field: 'courseCode', value: cleanCourse }
        )
      );
    }

    if (!cleanGrade) {
      return Result.fail(
        new DomainError(
          'VALIDATION_FAILED',
          'Grade level or class group is required.',
          { field: 'gradeLevel' }
        )
      );
    }

    if (!cleanAuthor || cleanAuthor.length < 2) {
      return Result.fail(
        new DomainError(
          'VALIDATION_FAILED',
          'Teacher or author name is required.',
          { field: 'authorName' }
        )
      );
    }

    return Result.ok({
      title: cleanTitle,
      courseCode: cleanCourse,
      gradeLevel: cleanGrade,
      authorName: cleanAuthor,
    });
  },

  validateStepInput(input: {
    title: string;
    description: string;
    durationMinutes: number;
    annotation?: ClickTargetAnnotation;
  }): Result<{
    title: string;
    description: string;
    durationMinutes: number;
    annotation?: ClickTargetAnnotation;
  }> {
    const cleanTitle = this.sanitizeText(input.title);
    const cleanDescription = this.sanitizeText(input.description);

    if (cleanTitle.length === 0) {
      return Result.fail(
        new DomainError('VALIDATION_FAILED', 'Step instruction title cannot be empty.', {
          field: 'step.title',
        })
      );
    }

    if (cleanTitle.length > this.MAX_STEP_TITLE_LENGTH) {
      return Result.fail(
        new DomainError(
          'VALIDATION_FAILED',
          `Step instruction title cannot exceed ${this.MAX_STEP_TITLE_LENGTH} characters.`,
          { field: 'step.title', length: cleanTitle.length }
        )
      );
    }

    if (
      typeof input.durationMinutes !== 'number' ||
      Number.isNaN(input.durationMinutes) ||
      input.durationMinutes < 0 ||
      input.durationMinutes > 240
    ) {
      return Result.fail(
        new DomainError(
          'VALIDATION_FAILED',
          'Step time must be between 0 and 240 minutes.',
          { field: 'step.durationMinutes', value: input.durationMinutes }
        )
      );
    }

    const normalizedAnnotation: ClickTargetAnnotation | undefined = input.annotation
      ? {
          xPercent: this.clampCoordinate(input.annotation.xPercent),
          yPercent: this.clampCoordinate(input.annotation.yPercent),
          label: this.sanitizeText(input.annotation.label) || 'Click Here',
          highlightColor: input.annotation.highlightColor || '#09090b',
        }
      : undefined;

    return Result.ok({
      title: cleanTitle,
      description: cleanDescription,
      durationMinutes: Math.round(input.durationMinutes),
      annotation: normalizedAnnotation,
    });
  },

  validatePrintReadiness(
    handbook: Handbook,
    config: PrintConfiguration
  ): Result<{ ready: true; totalEstimatedMinutes: number; actionableStepCount: number }> {
    if (handbook.isTrashed) {
      return Result.fail(
        new DomainError(
          'INVALID_STATE_TRANSITION',
          'Cannot print or export a handbook while it is in Trash. Restore it first.',
          { handbookId: handbook.id }
        )
      );
    }

    if (!handbook.steps || handbook.steps.length === 0) {
      return Result.fail(
        new DomainError(
          'EMPTY_STEPS_COLLECTION',
          'Cannot generate a printable Student Handbook PDF when the handbook has 0 steps.',
          { handbookId: handbook.id }
        )
      );
    }

    if (config.copiesCount < 1 || config.copiesCount > 500 || !Number.isInteger(config.copiesCount)) {
      return Result.fail(
        new DomainError(
          'EXPORT_PRECONDITION_FAILED',
          'Number of printed copies must be a whole number between 1 and 500.',
          { copiesCount: config.copiesCount }
        )
      );
    }

    const warnings: string[] = [];
    const emptyDescriptions = handbook.steps.filter(
      (s) => s.type === StepType.ACTION && s.description.trim().length === 0
    );
    if (emptyDescriptions.length > 0) {
      warnings.push(
        `${emptyDescriptions.length} action step(s) have empty helper notes.`
      );
    }

    const unredactedSteps = handbook.steps.filter(
      (s) => s.mockup && !s.mockup.redactedPii
    );
    if (!config.redactAllStudentPii && unredactedSteps.length > 0) {
      warnings.push(
        `${unredactedSteps.length} screenshot step(s) do not have automatic student privacy masking enabled.`
      );
    }

    const totalEstimatedMinutes = handbook.steps.reduce(
      (sum, step) => sum + (step.durationMinutes || 0),
      0
    );
    const actionableStepCount = handbook.steps.filter(
      (s) => s.type === StepType.ACTION || s.type === StepType.CHECKPOINT
    ).length;

    return Result.ok(
      {
        ready: true,
        totalEstimatedMinutes,
        actionableStepCount,
      },
      warnings
    );
  },
};
