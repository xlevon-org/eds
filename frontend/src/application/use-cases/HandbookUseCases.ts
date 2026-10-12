import {
  CaptureActionEvent,
  Handbook,
  HandbookDomainPolicy,
  HandbookKind,
  HandbookStatus,
  HandbookStep,
  HandbookVersion,
  PrintConfiguration,
  StepType,
} from '../../domain/entities/Handbook';
import { DomainError, Result } from '../../domain/errors/DomainError';
import {
  IFolderRepository,
  IHandbookReader,
  IHandbookRepository,
  IHandbookWriter,
  IPdfExporter,
  ITemplateGenerator,
  PdfExportArtifact,
} from '../../domain/repositories/IHandbookRepository';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * 1. CreateHandbookUseCase (SRP & ISP: Depends solely on segregated IHandbookWriter)
 */
export class CreateHandbookUseCase {
  constructor(private readonly writer: IHandbookWriter) {}

  execute(input: {
    title: string;
    subtitle?: string;
    courseCode: string;
    gradeLevel: string;
    academicTerm?: string;
    authorName: string;
    departmentFolderId: string;
    kind?: HandbookKind;
    initialSteps?: ReadonlyArray<HandbookStep>;
  }): Result<Handbook> {
    const validation = HandbookDomainPolicy.validateHandbookMetadata({
      title: input.title,
      courseCode: input.courseCode,
      gradeLevel: input.gradeLevel,
      authorName: input.authorName,
    });

    if (!validation.ok) {
      return validation;
    }

    const now = new Date().toISOString();
    const defaultStep: HandbookStep = {
      id: generateId('step'),
      orderIndex: 1,
      type: StepType.ACTION,
      title: 'Open the Student Portal and sign in with your school account',
      description:
        'Check that your class code matches your printed sheet before going to Step 2.',
      expectedStudentOutcome: 'Student dashboard opens with class lessons visible.',
      durationMinutes: 3,
      isRequiredForSignOff: true,
      annotation: {
        xPercent: 72,
        yPercent: 34,
        label: 'Student Sign-In Button',
        highlightColor: '#09090b',
      },
      mockup: {
        appTitle: 'Student Class Portal',
        urlBar: 'https://school.edu/courses/login',
        activeElementLabel: 'Sign In with School ID',
        screenTheme: 'lms-canvas',
        redactedPii: true,
        zoomScale: 1.0,
      },
    };

    const steps =
      input.initialSteps && input.initialSteps.length > 0
        ? HandbookDomainPolicy.normalizeStepOrder(input.initialSteps)
        : [defaultStep];

    if (steps.length > HandbookDomainPolicy.MAX_STEPS_PER_HANDBOOK) {
      return Result.fail(
        new DomainError(
          'VALIDATION_FAILED',
          `A handbook cannot exceed ${HandbookDomainPolicy.MAX_STEPS_PER_HANDBOOK} steps.`,
          { stepCount: steps.length }
        )
      );
    }

    const initialVersion: HandbookVersion = {
      versionId: generateId('ver'),
      versionNumber: 'v1.0',
      createdAt: now,
      authorName: validation.value.authorName,
      changeSummary: 'First version created',
      stepCount: steps.length,
      snapshotSteps: steps,
      snapshotTitle: validation.value.title,
    };

    const newHandbook: Handbook = {
      id: generateId('hb'),
      title: validation.value.title,
      subtitle:
        HandbookDomainPolicy.sanitizeText(input.subtitle || '') ||
        'Easy step-by-step student handbook and printable guide.',
      courseCode: validation.value.courseCode,
      gradeLevel: validation.value.gradeLevel,
      academicTerm: HandbookDomainPolicy.sanitizeText(input.academicTerm || 'Fall 2026'),
      authorName: validation.value.authorName,
      departmentFolderId: input.departmentFolderId || 'folder-stem',
      status: HandbookStatus.DRAFT,
      kind: input.kind || HandbookKind.STEP_GUIDE,
      isStarred: false,
      isTrashed: false,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      viewCount: 1,
      downloadedPdfCount: 0,
      steps,
      versions: [initialVersion],
    };

    return this.writer.save(newHandbook);
  }
}

/**
 * 2. UpdateHandbookMetadataUseCase (SRP: Validates and updates handbook header/metadata with Optimistic Concurrency)
 */
export class UpdateHandbookMetadataUseCase {
  constructor(private readonly repository: IHandbookRepository) {}

  execute(
    handbookId: string,
    updates: {
      title?: string;
      subtitle?: string;
      courseCode?: string;
      gradeLevel?: string;
      academicTerm?: string;
      authorName?: string;
      departmentFolderId?: string;
      status?: HandbookStatus;
      isStarred?: boolean;
    },
    expectedRevision?: number
  ): Result<Handbook> {
    const existingResult = this.repository.getById(handbookId);
    if (!existingResult.ok) return existingResult;

    const current = existingResult.value;
    if (current.isTrashed) {
      return Result.fail(
        new DomainError(
          'INVALID_STATE_TRANSITION',
          'Cannot edit a handbook while it is in Trash.',
          { handbookId }
        )
      );
    }

    const nextTitle = updates.title !== undefined ? updates.title : current.title;
    const nextCourse = updates.courseCode !== undefined ? updates.courseCode : current.courseCode;
    const nextGrade = updates.gradeLevel !== undefined ? updates.gradeLevel : current.gradeLevel;
    const nextAuthor = updates.authorName !== undefined ? updates.authorName : current.authorName;

    const validation = HandbookDomainPolicy.validateHandbookMetadata({
      title: nextTitle,
      courseCode: nextCourse,
      gradeLevel: nextGrade,
      authorName: nextAuthor,
    });
    if (!validation.ok) return validation;

    if (updates.status === HandbookStatus.PUBLISHED && current.steps.length === 0) {
      return Result.fail(
        new DomainError(
          'EMPTY_STEPS_COLLECTION',
          'Cannot publish a handbook with 0 steps. Add at least 1 step first.',
          { handbookId }
        )
      );
    }

    const updated: Handbook = {
      ...current,
      title: validation.value.title,
      subtitle:
        updates.subtitle !== undefined
          ? HandbookDomainPolicy.sanitizeText(updates.subtitle)
          : current.subtitle,
      courseCode: validation.value.courseCode,
      gradeLevel: validation.value.gradeLevel,
      academicTerm:
        updates.academicTerm !== undefined
          ? HandbookDomainPolicy.sanitizeText(updates.academicTerm)
          : current.academicTerm,
      authorName: validation.value.authorName,
      departmentFolderId: updates.departmentFolderId ?? current.departmentFolderId,
      status: updates.status ?? current.status,
      isStarred: updates.isStarred ?? current.isStarred,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
    };

    return this.repository.save(updated, expectedRevision);
  }
}

/**
 * 3. ManageStepUseCase (SRP: Step manipulation, reordering, PII redaction, and click target calibration)
 */
export class ManageStepUseCase {
  constructor(private readonly repository: IHandbookRepository) {}

  addStep(
    handbookId: string,
    input: {
      type: StepType;
      title: string;
      description: string;
      expectedStudentOutcome?: string;
      durationMinutes?: number;
      insertAfterIndex?: number;
      screenTheme?: 'lms-canvas' | 'lab-simulator' | 'git-terminal' | 'chromebook-os' | 'iep-portal';
    }
  ): Result<Handbook> {
    const existingResult = this.repository.getById(handbookId);
    if (!existingResult.ok) return existingResult;
    const handbook = existingResult.value;

    if (handbook.isTrashed) {
      return Result.fail(
        new DomainError('INVALID_STATE_TRANSITION', 'Cannot add steps to a handbook in Trash.')
      );
    }

    if (handbook.steps.length >= HandbookDomainPolicy.MAX_STEPS_PER_HANDBOOK) {
      return Result.fail(
        new DomainError(
          'VALIDATION_FAILED',
          `Maximum limit of ${HandbookDomainPolicy.MAX_STEPS_PER_HANDBOOK} steps reached.`,
          { currentCount: handbook.steps.length }
        )
      );
    }

    const stepValidation = HandbookDomainPolicy.validateStepInput({
      title: input.title,
      description: input.description,
      durationMinutes: input.durationMinutes ?? 3,
      annotation:
        input.type === StepType.ACTION
          ? {
              xPercent: 54,
              yPercent: 48,
              label: 'Click Here',
              highlightColor: '#09090b',
            }
          : undefined,
    });
    if (!stepValidation.ok) return stepValidation;

    const newStep: HandbookStep = {
      id: generateId('step'),
      orderIndex: handbook.steps.length + 1,
      type: input.type,
      title: stepValidation.value.title,
      description: stepValidation.value.description,
      expectedStudentOutcome: HandbookDomainPolicy.sanitizeText(
        input.expectedStudentOutcome || 'Student completes step smoothly.'
      ),
      durationMinutes: stepValidation.value.durationMinutes,
      isRequiredForSignOff: input.type === StepType.ACTION || input.type === StepType.CHECKPOINT,
      annotation: stepValidation.value.annotation,
      mockup:
        input.type === StepType.ACTION
          ? {
              appTitle: 'Student Screen Preview',
              urlBar: 'https://workspace.school.edu/lesson/step',
              activeElementLabel: stepValidation.value.title.slice(0, 36),
              screenTheme: input.screenTheme || 'lms-canvas',
              redactedPii: true,
              zoomScale: 1.0,
            }
          : undefined,
    };

    const mutableSteps = [...handbook.steps];
    if (
      input.insertAfterIndex !== undefined &&
      input.insertAfterIndex >= 0 &&
      input.insertAfterIndex < mutableSteps.length
    ) {
      mutableSteps.splice(input.insertAfterIndex + 1, 0, newStep);
    } else {
      mutableSteps.push(newStep);
    }

    const updated: Handbook = {
      ...handbook,
      steps: HandbookDomainPolicy.normalizeStepOrder(mutableSteps),
      revision: handbook.revision + 1,
      updatedAt: new Date().toISOString(),
    };

    return this.repository.save(updated);
  }

  updateStep(
    handbookId: string,
    stepId: string,
    updates: {
      title?: string;
      description?: string;
      type?: StepType;
      expectedStudentOutcome?: string;
      durationMinutes?: number;
      isRequiredForSignOff?: boolean;
      clickXPercent?: number;
      clickYPercent?: number;
      clickLabel?: string;
      redactedPii?: boolean;
      zoomScale?: number;
    }
  ): Result<Handbook> {
    const existingResult = this.repository.getById(handbookId);
    if (!existingResult.ok) return existingResult;
    const handbook = existingResult.value;

    const targetIndex = handbook.steps.findIndex((s) => s.id === stepId);
    if (targetIndex === -1) {
      return Result.fail(
        new DomainError('ENTITY_NOT_FOUND', `Step with ID "${stepId}" was not found.`, {
          handbookId,
          stepId,
        })
      );
    }

    const currentStep = handbook.steps[targetIndex];
    const nextTitle = updates.title !== undefined ? updates.title : currentStep.title;
    const nextDesc = updates.description !== undefined ? updates.description : currentStep.description;
    const nextDuration =
      updates.durationMinutes !== undefined ? updates.durationMinutes : currentStep.durationMinutes;

    const nextAnnotation = currentStep.annotation
      ? {
          xPercent:
            updates.clickXPercent !== undefined
              ? updates.clickXPercent
              : currentStep.annotation.xPercent,
          yPercent:
            updates.clickYPercent !== undefined
              ? updates.clickYPercent
              : currentStep.annotation.yPercent,
          label:
            updates.clickLabel !== undefined ? updates.clickLabel : currentStep.annotation.label,
          highlightColor: currentStep.annotation.highlightColor,
        }
      : updates.clickXPercent !== undefined && updates.clickYPercent !== undefined
      ? {
          xPercent: updates.clickXPercent,
          yPercent: updates.clickYPercent,
          label: updates.clickLabel || 'Selected Button',
          highlightColor: '#09090b',
        }
      : undefined;

    const validation = HandbookDomainPolicy.validateStepInput({
      title: nextTitle,
      description: nextDesc,
      durationMinutes: nextDuration,
      annotation: nextAnnotation,
    });
    if (!validation.ok) return validation;

    const updatedStep: HandbookStep = {
      ...currentStep,
      title: validation.value.title,
      description: validation.value.description,
      type: updates.type ?? currentStep.type,
      expectedStudentOutcome:
        updates.expectedStudentOutcome !== undefined
          ? HandbookDomainPolicy.sanitizeText(updates.expectedStudentOutcome)
          : currentStep.expectedStudentOutcome,
      durationMinutes: validation.value.durationMinutes,
      isRequiredForSignOff: updates.isRequiredForSignOff ?? currentStep.isRequiredForSignOff,
      annotation: validation.value.annotation,
      mockup: currentStep.mockup
        ? {
            ...currentStep.mockup,
            redactedPii: updates.redactedPii ?? currentStep.mockup.redactedPii,
            zoomScale:
              updates.zoomScale !== undefined
                ? HandbookDomainPolicy.clampZoom(updates.zoomScale)
                : currentStep.mockup.zoomScale,
          }
        : undefined,
    };

    const nextSteps = handbook.steps.map((s, idx) => (idx === targetIndex ? updatedStep : s));
    return this.repository.save({
      ...handbook,
      steps: nextSteps,
      revision: handbook.revision + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  reorderStep(handbookId: string, stepId: string, direction: 'UP' | 'DOWN'): Result<Handbook> {
    const existingResult = this.repository.getById(handbookId);
    if (!existingResult.ok) return existingResult;
    const handbook = existingResult.value;

    const index = handbook.steps.findIndex((s) => s.id === stepId);
    if (index === -1) {
      return Result.fail(
        new DomainError('ENTITY_NOT_FOUND', `Step "${stepId}" not found for reordering.`)
      );
    }

    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= handbook.steps.length) {
      return Result.fail(
        new DomainError(
          'INVALID_STATE_TRANSITION',
          `Cannot move step ${direction} from position ${index + 1} of ${handbook.steps.length}.`,
          { stepId, direction, currentPosition: index + 1 }
        )
      );
    }

    const mutable = [...handbook.steps];
    const [moved] = mutable.splice(index, 1);
    mutable.splice(targetIndex, 0, moved);

    return this.repository.save({
      ...handbook,
      steps: HandbookDomainPolicy.normalizeStepOrder(mutable),
      revision: handbook.revision + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  duplicateStep(handbookId: string, stepId: string): Result<Handbook> {
    const existingResult = this.repository.getById(handbookId);
    if (!existingResult.ok) return existingResult;
    const handbook = existingResult.value;

    const index = handbook.steps.findIndex((s) => s.id === stepId);
    if (index === -1) {
      return Result.fail(new DomainError('ENTITY_NOT_FOUND', `Step "${stepId}" not found.`));
    }

    if (handbook.steps.length >= HandbookDomainPolicy.MAX_STEPS_PER_HANDBOOK) {
      return Result.fail(
        new DomainError('VALIDATION_FAILED', 'Cannot duplicate: maximum step count reached.')
      );
    }

    const source = handbook.steps[index];
    const cloned: HandbookStep = {
      ...source,
      id: generateId('step'),
      title: `${source.title} (Copy)`,
    };

    const mutable = [...handbook.steps];
    mutable.splice(index + 1, 0, cloned);

    return this.repository.save({
      ...handbook,
      steps: HandbookDomainPolicy.normalizeStepOrder(mutable),
      revision: handbook.revision + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  deleteStep(handbookId: string, stepId: string): Result<Handbook> {
    const existingResult = this.repository.getById(handbookId);
    if (!existingResult.ok) return existingResult;
    const handbook = existingResult.value;

    if (handbook.steps.length <= 1) {
      return Result.fail(
        new DomainError(
          'INVALID_STATE_TRANSITION',
          'An up handbook must contain at least 1 step. Edit the existing step instead of deleting the last step.',
          { handbookId, remainingSteps: handbook.steps.length }
        )
      );
    }

    const filtered = handbook.steps.filter((s) => s.id !== stepId);
    if (filtered.length === handbook.steps.length) {
      return Result.fail(new DomainError('ENTITY_NOT_FOUND', `Step "${stepId}" not found.`));
    }

    return this.repository.save({
      ...handbook,
      steps: HandbookDomainPolicy.normalizeStepOrder(filtered),
      revision: handbook.revision + 1,
      updatedAt: new Date().toISOString(),
    });
  }
}

/**
 * 4. CaptureWorkflowUseCase (SRP: Converts recorded 'up' UI capture events into a structured Handbook)
 */
export class CaptureWorkflowUseCase {
  private readonly createUseCase: CreateHandbookUseCase;

  constructor(
    private readonly writer: IHandbookWriter,
    createHandbookUseCase?: CreateHandbookUseCase
  ) {
    this.createUseCase = createHandbookUseCase ?? new CreateHandbookUseCase(this.writer);
  }

  createHandbookFromCaptureSession(input: {
    title: string;
    courseCode: string;
    gradeLevel: string;
    authorName: string;
    departmentFolderId: string;
    events: ReadonlyArray<CaptureActionEvent>;
  }): Result<Handbook> {
    if (!input.events || input.events.length === 0) {
      return Result.fail(
        new DomainError(
          'EMPTY_STEPS_COLLECTION',
          'Cannot finish recording with 0 steps. Click at least one button in the recorder first.'
        )
      );
    }

    const metaValidation = HandbookDomainPolicy.validateHandbookMetadata({
      title: input.title,
      courseCode: input.courseCode,
      gradeLevel: input.gradeLevel,
      authorName: input.authorName,
    });
    if (!metaValidation.ok) return metaValidation;

    const generatedSteps: HandbookStep[] = input.events.map((ev, index) => {
      const sanitizedLabel = HandbookDomainPolicy.sanitizeText(ev.targetLabel) || 'Target Button';
      const stepTitle =
        ev.actionVerb === 'Type'
          ? `In the "${sanitizedLabel}" box, type "${HandbookDomainPolicy.sanitizeText(
              ev.inputDetail || 'your answer'
            )}"`
          : `${ev.actionVerb} on "${sanitizedLabel}"`;

      return {
        id: generateId('step'),
        orderIndex: index + 1,
        type: ev.actionVerb === 'Verify' ? StepType.CHECKPOINT : StepType.ACTION,
        title: stepTitle,
        description: `Recorded on ${ev.urlBar}. Make sure your screen matches the target circle before moving on.`,
        expectedStudentOutcome: `${sanitizedLabel} opens and moves to step ${index + 2}.`,
        durationMinutes: 2,
        isRequiredForSignOff: true,
        annotation: {
          xPercent: HandbookDomainPolicy.clampCoordinate(ev.xPercent),
          yPercent: HandbookDomainPolicy.clampCoordinate(ev.yPercent),
          label: sanitizedLabel,
          highlightColor: '#09090b',
        },
        mockup: {
          appTitle: 'Student Screen Preview',
          urlBar: ev.urlBar,
          activeElementLabel: sanitizedLabel,
          screenTheme: ev.screenTheme,
          redactedPii: true,
          zoomScale: 1.15,
        },
      };
    });

    return this.createUseCase.execute({
      title: metaValidation.value.title,
      subtitle: `Recorded step-by-step guide (${generatedSteps.length} easy steps)`,
      courseCode: metaValidation.value.courseCode,
      gradeLevel: metaValidation.value.gradeLevel,
      authorName: metaValidation.value.authorName,
      departmentFolderId: input.departmentFolderId,
      kind: HandbookKind.STEP_GUIDE,
      initialSteps: generatedSteps,
    });
  }
}

/**
 * 5. VersionControlUseCase (SRP: Snapshot creation and rollback restoration)
 */
export class VersionControlUseCase {
  constructor(private readonly repository: IHandbookRepository) {}

  createSnapshot(handbookId: string, authorName: string, changeSummary: string): Result<Handbook> {
    const existingResult = this.repository.getById(handbookId);
    if (!existingResult.ok) return existingResult;
    const handbook = existingResult.value;

    const cleanSummary = HandbookDomainPolicy.sanitizeText(changeSummary);
    if (cleanSummary.length < 3) {
      return Result.fail(
        new DomainError(
          'VALIDATION_FAILED',
          'Version note must be at least 3 characters (for example: "Added lab safety tips").'
        )
      );
    }

    const nextMinor = handbook.versions.length;
    const versionNumber = `v1.${nextMinor}`;
    const newVersion: HandbookVersion = {
      versionId: generateId('ver'),
      versionNumber,
      createdAt: new Date().toISOString(),
      authorName: HandbookDomainPolicy.sanitizeText(authorName) || handbook.authorName,
      changeSummary: cleanSummary,
      stepCount: handbook.steps.length,
      snapshotSteps: handbook.steps.map((s) => ({ ...s })),
      snapshotTitle: handbook.title,
    };

    return this.repository.save({
      ...handbook,
      versions: [newVersion, ...handbook.versions],
      revision: handbook.revision + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  restoreSnapshot(handbookId: string, versionId: string): Result<Handbook> {
    const existingResult = this.repository.getById(handbookId);
    if (!existingResult.ok) return existingResult;
    const handbook = existingResult.value;

    const targetVersion = handbook.versions.find((v) => v.versionId === versionId);
    if (!targetVersion) {
      return Result.fail(
        new DomainError('ENTITY_NOT_FOUND', `Saved version "${versionId}" was not found.`)
      );
    }

    const auditRestoreVersion: HandbookVersion = {
      versionId: generateId('ver'),
      versionNumber: `v1.${handbook.versions.length}`,
      createdAt: new Date().toISOString(),
      authorName: handbook.authorName,
      changeSummary: `Restored from ${targetVersion.versionNumber} (${targetVersion.changeSummary})`,
      stepCount: targetVersion.snapshotSteps.length,
      snapshotSteps: targetVersion.snapshotSteps,
      snapshotTitle: targetVersion.snapshotTitle,
    };

    return this.repository.save({
      ...handbook,
      title: targetVersion.snapshotTitle,
      steps: HandbookDomainPolicy.normalizeStepOrder(targetVersion.snapshotSteps),
      versions: [auditRestoreVersion, ...handbook.versions],
      revision: handbook.revision + 1,
      updatedAt: new Date().toISOString(),
    });
  }
}

/**
 * 6. LifecycleStateUseCase (SRP: Soft-delete to Trash, Restore, Duplicate Handbook, Combine into Booklet)
 */
export class LifecycleStateUseCase {
  private readonly createUseCase: CreateHandbookUseCase;

  constructor(
    private readonly repository: IHandbookRepository,
    createHandbookUseCase?: CreateHandbookUseCase
  ) {
    this.createUseCase = createHandbookUseCase ?? new CreateHandbookUseCase(this.repository);
  }

  deletePermanently(handbookId: string): Result<boolean> {
    return this.repository.deletePermanently(handbookId);
  }

  moveToTrash(handbookId: string): Result<Handbook> {
    const res = this.repository.getById(handbookId);
    if (!res.ok) return res;
    if (res.value.isTrashed) {
      return Result.fail(
        new DomainError('INVALID_STATE_TRANSITION', 'Handbook is already in Trash.')
      );
    }
    return this.repository.save({
      ...res.value,
      isTrashed: true,
      status: HandbookStatus.ARCHIVED,
      revision: res.value.revision + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  restoreFromTrash(handbookId: string): Result<Handbook> {
    const res = this.repository.getById(handbookId);
    if (!res.ok) return res;
    if (!res.value.isTrashed) {
      return Result.fail(
        new DomainError('INVALID_STATE_TRANSITION', 'Handbook is not currently in Trash.')
      );
    }
    return this.repository.save({
      ...res.value,
      isTrashed: false,
      status: HandbookStatus.DRAFT,
      revision: res.value.revision + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  duplicateHandbook(handbookId: string): Result<Handbook> {
    const res = this.repository.getById(handbookId);
    if (!res.ok) return res;
    const source = res.value;

    return this.createUseCase.execute({
      title: `${source.title} (Copy)`,
      subtitle: source.subtitle,
      courseCode: source.courseCode,
      gradeLevel: source.gradeLevel,
      academicTerm: source.academicTerm,
      authorName: source.authorName,
      departmentFolderId: source.departmentFolderId,
      kind: source.kind,
      initialSteps: source.steps.map((s) => ({ ...s, id: generateId('step') })),
    });
  }

  combineIntoCoursePacket(input: {
    packetTitle: string;
    courseCode: string;
    gradeLevel: string;
    authorName: string;
    departmentFolderId: string;
    sourceHandbookIds: ReadonlyArray<string>;
  }): Result<Handbook> {
    if (!input.sourceHandbookIds || input.sourceHandbookIds.length < 2) {
      return Result.fail(
        new DomainError(
          'VALIDATION_FAILED',
          'Check at least 2 handbooks to combine them into a Master Booklet.'
        )
      );
    }

    const combinedSteps: HandbookStep[] = [];
    for (const id of input.sourceHandbookIds) {
      const found = this.repository.getById(id);
      if (!found.ok) return found;
      if (found.value.isTrashed) {
        return Result.fail(
          new DomainError(
            'INVALID_STATE_TRANSITION',
            `Cannot combine trashed handbook "${found.value.title}".`
          )
        );
      }

      combinedSteps.push({
        id: generateId('step'),
        orderIndex: combinedSteps.length + 1,
        type: StepType.HEADER,
        title: `Part: ${found.value.title} (${found.value.courseCode})`,
        description: found.value.subtitle,
        durationMinutes: 1,
        isRequiredForSignOff: false,
      });

      for (const s of found.value.steps) {
        if (combinedSteps.length < HandbookDomainPolicy.MAX_STEPS_PER_HANDBOOK) {
          combinedSteps.push({
            ...s,
            id: generateId('step'),
            orderIndex: combinedSteps.length + 1,
          });
        }
      }
    }

    return this.createUseCase.execute({
      title: input.packetTitle,
      subtitle: `Combined Student Handbook Booklet (${input.sourceHandbookIds.length} guides joined together)`,
      courseCode: input.courseCode,
      gradeLevel: input.gradeLevel,
      authorName: input.authorName,
      departmentFolderId: input.departmentFolderId,
      kind: HandbookKind.COURSE_PAGE_PACKET,
      initialSteps: combinedSteps,
    });
  }
}

/**
 * 8. WorkspaceQueryUseCase (SRP & ISP: Segregated read-only queries for Handbooks, Folders, and Templates)
 */
export class WorkspaceQueryUseCase {
  constructor(
    private readonly reader: IHandbookReader,
    private readonly folderRepository: IFolderRepository,
    private readonly templateGenerator: ITemplateGenerator
  ) {}

  getHandbooks() {
    return this.reader.getAll();
  }

  getFolders() {
    return this.folderRepository.getFolders();
  }

  getTemplates() {
    return this.templateGenerator.getTemplates();
  }
}

/**
 * 9. ManageFolderUseCase (SRP & ISP: Depends solely on segregated IFolderRepository)
 */
export class ManageFolderUseCase {
  constructor(private readonly folderRepository: IFolderRepository) {}

  createFolder(name: string, departmentCode: string, description: string) {
    return this.folderRepository.createFolder(name, departmentCode, description);
  }
}

/**
 * 10. InstantiateTemplateUseCase (SRP & ISP: Instantiates a starter template via ITemplateGenerator and persists via IHandbookWriter)
 */
export class InstantiateTemplateUseCase {
  constructor(
    private readonly templateGenerator: ITemplateGenerator,
    private readonly writer: IHandbookWriter
  ) {}

  execute(templateId: string, authorName: string, folderId: string): Result<Handbook> {
    const instantiated = this.templateGenerator.instantiateTemplate(
      templateId,
      authorName,
      folderId
    );
    if (!instantiated.ok) return instantiated;
    return this.writer.save(instantiated.value);
  }
}

/**
 * 7. ExportPrintablePdfUseCase (SRP: Validates print readiness, invokes IPdfExporter, increments PDF distribution metric)
 */
export class ExportPrintablePdfUseCase {
  constructor(
    private readonly repository: IHandbookRepository,
    private readonly pdfExporter: IPdfExporter
  ) {}

  async execute(
    handbookId: string,
    config: PrintConfiguration
  ): Promise<Result<{ artifact: PdfExportArtifact; updatedHandbook: Handbook }>> {
    const existingResult = this.repository.getById(handbookId);
    if (!existingResult.ok) return existingResult;
    const handbook = existingResult.value;

    const readiness = HandbookDomainPolicy.validatePrintReadiness(handbook, config);
    if (!readiness.ok) return readiness;

    const preparedHandbook: Handbook = config.redactAllStudentPii
      ? {
          ...handbook,
          steps: handbook.steps.map((step) => ({
            ...step,
            title: HandbookDomainPolicy.redactPiiPatterns(step.title),
            description: HandbookDomainPolicy.redactPiiPatterns(step.description),
            mockup: step.mockup ? { ...step.mockup, redactedPii: true } : undefined,
          })),
        }
      : handbook;

    const exportResult = await this.pdfExporter.exportHandbookToPdf(preparedHandbook, config);
    if (!exportResult.ok) return exportResult;

    const savedResult = this.repository.save({
      ...handbook,
      downloadedPdfCount: handbook.downloadedPdfCount + 1,
      updatedAt: new Date().toISOString(),
    });

    if (!savedResult.ok) return savedResult;

    return Result.ok(
      {
        artifact: {
          ...exportResult.value,
          warnings: readiness.warnings || [],
        },
        updatedHandbook: savedResult.value,
      },
      readiness.warnings
    );
  }
}
