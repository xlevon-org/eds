import React, { createContext, useContext, useMemo } from 'react';
import {
  CaptureWorkflowUseCase,
  CreateHandbookUseCase,
  ExportPrintablePdfUseCase,
  InstantiateTemplateUseCase,
  LifecycleStateUseCase,
  ManageFolderUseCase,
  ManageStepUseCase,
  UpdateHandbookMetadataUseCase,
  VersionControlUseCase,
  WorkspaceQueryUseCase,
} from '../../application/use-cases/HandbookUseCases';
import {
  IFolderRepository,
  IHandbookRepository,
  IPdfExporter,
  ITemplateGenerator,
} from '../../domain/repositories/IHandbookRepository';
import { JsPdfHandbookExporter } from '../../infrastructure/pdf/JsPdfHandbookExporter';
import { LocalStorageHandbookRepository } from '../../infrastructure/persistence/LocalStorageHandbookRepository';
import { CurriculumTemplateGenerator } from '../../infrastructure/templates/CurriculumTemplateGenerator';

export interface AppDependencies {
  readonly handbookRepository: IHandbookRepository;
  readonly folderRepository: IFolderRepository;
  readonly pdfExporter: IPdfExporter;
  readonly templateGenerator: ITemplateGenerator;
  readonly workspaceQueryUseCase: WorkspaceQueryUseCase;
  readonly manageFolderUseCase: ManageFolderUseCase;
  readonly instantiateTemplateUseCase: InstantiateTemplateUseCase;
  readonly createHandbookUseCase: CreateHandbookUseCase;
  readonly updateMetadataUseCase: UpdateHandbookMetadataUseCase;
  readonly manageStepUseCase: ManageStepUseCase;
  readonly captureWorkflowUseCase: CaptureWorkflowUseCase;
  readonly versionControlUseCase: VersionControlUseCase;
  readonly lifecycleStateUseCase: LifecycleStateUseCase;
  readonly exportPrintablePdfUseCase: ExportPrintablePdfUseCase;
}

const DependencyContext = createContext<AppDependencies | null>(null);

interface DependencyProviderProps {
  children: React.ReactNode;
  overrides?: Partial<AppDependencies>;
}

export const DependencyProvider: React.FC<DependencyProviderProps> = ({
  children,
  overrides,
}) => {
  const dependencies = useMemo<AppDependencies>(() => {
    const defaultStorageRepo = new LocalStorageHandbookRepository(false);
    const handbookRepository = overrides?.handbookRepository ?? defaultStorageRepo;
    const folderRepository = overrides?.folderRepository ?? defaultStorageRepo;
    const pdfExporter = overrides?.pdfExporter ?? new JsPdfHandbookExporter();
    const templateGenerator =
      overrides?.templateGenerator ?? new CurriculumTemplateGenerator();

    const createHandbookUseCase =
      overrides?.createHandbookUseCase ?? new CreateHandbookUseCase(handbookRepository);

    return {
      handbookRepository,
      folderRepository,
      pdfExporter,
      templateGenerator,
      workspaceQueryUseCase:
        overrides?.workspaceQueryUseCase ??
        new WorkspaceQueryUseCase(handbookRepository, folderRepository, templateGenerator),
      manageFolderUseCase:
        overrides?.manageFolderUseCase ?? new ManageFolderUseCase(folderRepository),
      instantiateTemplateUseCase:
        overrides?.instantiateTemplateUseCase ??
        new InstantiateTemplateUseCase(templateGenerator, handbookRepository),
      createHandbookUseCase,
      updateMetadataUseCase:
        overrides?.updateMetadataUseCase ??
        new UpdateHandbookMetadataUseCase(handbookRepository),
      manageStepUseCase:
        overrides?.manageStepUseCase ?? new ManageStepUseCase(handbookRepository),
      captureWorkflowUseCase:
        overrides?.captureWorkflowUseCase ??
        new CaptureWorkflowUseCase(handbookRepository, createHandbookUseCase),
      versionControlUseCase:
        overrides?.versionControlUseCase ??
        new VersionControlUseCase(handbookRepository),
      lifecycleStateUseCase:
        overrides?.lifecycleStateUseCase ??
        new LifecycleStateUseCase(handbookRepository, createHandbookUseCase),
      exportPrintablePdfUseCase:
        overrides?.exportPrintablePdfUseCase ??
        new ExportPrintablePdfUseCase(handbookRepository, pdfExporter),
    };
  }, [overrides]);

  return (
    <DependencyContext.Provider value={dependencies}>
      {children}
    </DependencyContext.Provider>
  );
};

export function useDependencies(): AppDependencies {
  const ctx = useContext(DependencyContext);
  if (!ctx) {
    throw new Error('useDependencies must be used within a DependencyProvider.');
  }
  return ctx;
}
