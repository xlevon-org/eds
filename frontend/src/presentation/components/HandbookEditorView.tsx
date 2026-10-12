import React, { useState } from 'react';
import {
  Handbook,
  HandbookFolder,
  HandbookStatus,
  HandbookStep,
  StepType,
} from '../../domain/entities/Handbook';
import { useDependencies } from '../context/DependencyContext';
import { ScreenMockupCanvas } from './ScreenMockupCanvas';
import { PrintablePreviewModal } from './PrintablePreviewModal';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Select } from '@/src/components/ui/select';
import { Label } from '@/src/components/ui/label';
import { Switch } from '@/src/components/ui/switch';
import { Card } from '@/src/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
} from '@/src/components/ui/sheet';
import { WizardStepper } from '@/src/components/ui/wizard-stepper';
import {
  ArrowLeft,
  ArrowRight,
  Printer,
  Plus,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  History,
  CheckCircle2,
  AlertCircle,
  Star,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Pencil,
  SlidersHorizontal,
} from 'lucide-react';

interface HandbookEditorViewProps {
  handbook: Handbook;
  folders: ReadonlyArray<HandbookFolder>;
  onBack: () => void;
  onHandbookChange: (updated: Handbook) => void;
}

const INFO_WIZARD_STEPS = [
  { stepNumber: 1, title: 'Title & Summary', subtitle: 'Name & student intro' },
  { stepNumber: 2, title: 'Class & Teacher', subtitle: 'Code, grades & folder' },
  { stepNumber: 3, title: 'Review & Save', subtitle: 'Confirm details' },
] as const;

const ADD_STEP_WIZARD_STEPS = [
  { stepNumber: 1, title: 'Step Instruction', subtitle: 'Type & headline' },
  { stepNumber: 2, title: 'Helper Notes', subtitle: 'Details for students' },
  { stepNumber: 3, title: 'Time & Goal Check', subtitle: 'Minutes & outcome' },
] as const;

export const HandbookEditorView: React.FC<HandbookEditorViewProps> = ({
  handbook,
  folders,
  onBack,
  onHandbookChange,
}) => {
  const {
    updateMetadataUseCase,
    manageStepUseCase,
    versionControlUseCase,
  } = useDependencies();

  // Header Edit Wizard Drawer State
  const [infoWizardOpen, setInfoWizardOpen] = useState(false);
  const [infoWizardStep, setInfoWizardStep] = useState(1);
  const [title, setTitle] = useState(handbook.title);
  const [subtitle, setSubtitle] = useState(handbook.subtitle);
  const [courseCode, setCourseCode] = useState(handbook.courseCode);
  const [gradeLevel, setGradeLevel] = useState(handbook.gradeLevel);
  const [academicTerm, setAcademicTerm] = useState(handbook.academicTerm);
  const [authorName, setAuthorName] = useState(handbook.authorName);
  const [folderId, setFolderId] = useState(handbook.departmentFolderId);

  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Add New Step Wizard Drawer State
  const [addStepWizardOpen, setAddStepWizardOpen] = useState(false);
  const [addStepWizardPage, setAddStepWizardPage] = useState(1);
  const [newStepType, setNewStepType] = useState<StepType>(StepType.ACTION);
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepDesc, setNewStepDesc] = useState('');
  const [newStepOutcome, setNewStepOutcome] = useState('');
  const [newStepDuration, setNewStepDuration] = useState(3);

  // Quick-Edit Step Drawer State
  const [editingStep, setEditingStep] = useState<HandbookStep | null>(null);
  const [editStepTitle, setEditStepTitle] = useState('');
  const [editStepDesc, setEditStepDesc] = useState('');
  const [editStepOutcome, setEditStepOutcome] = useState('');
  const [editStepType, setEditStepType] = useState<StepType>(StepType.ACTION);
  const [editStepDuration, setEditStepDuration] = useState(3);
  const [editStepClickLabel, setEditStepClickLabel] = useState('');

  // Version History Slide-Over Drawer State
  const [showVersionDrawer, setShowVersionDrawer] = useState(false);
  const [snapshotSummary, setSnapshotSummary] = useState('');

  // Print & PDF Wizard Drawer State
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const openEditInfoWizard = () => {
    setTitle(handbook.title);
    setSubtitle(handbook.subtitle);
    setCourseCode(handbook.courseCode);
    setGradeLevel(handbook.gradeLevel);
    setAcademicTerm(handbook.academicTerm);
    setAuthorName(handbook.authorName);
    setFolderId(handbook.departmentFolderId);
    setInfoWizardStep(1);
    setInfoWizardOpen(true);
  };

  const handleSaveHeaderMetadata = () => {
    setFeedbackBanner(null);
    const res = updateMetadataUseCase.execute(
      handbook.id,
      {
        title,
        subtitle,
        courseCode,
        gradeLevel,
        academicTerm,
        authorName,
        departmentFolderId: folderId,
      },
      handbook.revision
    );

    if (!res.ok) {
      setFeedbackBanner({ type: 'error', message: res.error.message });
      return;
    }

    onHandbookChange(res.value);
    setInfoWizardOpen(false);
    setFeedbackBanner({
      type: 'success',
      message: `Saved handbook details (Version v1.${res.value.revision}).`,
    });
  };

  const handleTogglePublish = () => {
    setFeedbackBanner(null);
    const nextStatus =
      handbook.status === HandbookStatus.PUBLISHED
        ? HandbookStatus.DRAFT
        : HandbookStatus.PUBLISHED;
    const res = updateMetadataUseCase.execute(handbook.id, { status: nextStatus });
    if (!res.ok) {
      setFeedbackBanner({ type: 'error', message: res.error.message });
      return;
    }
    onHandbookChange(res.value);
    setFeedbackBanner({
      type: 'success',
      message:
        nextStatus === HandbookStatus.PUBLISHED
          ? 'Handbook is now Published and ready to print for students!'
          : 'Handbook switched back to Draft.',
    });
  };

  const handleToggleStar = () => {
    const res = updateMetadataUseCase.execute(handbook.id, {
      isStarred: !handbook.isStarred,
    });
    if (res.ok) onHandbookChange(res.value);
  };

  const openQuickEditStepDrawer = (step: HandbookStep) => {
    setEditingStep(step);
    setEditStepTitle(step.title);
    setEditStepDesc(step.description);
    setEditStepOutcome(step.expectedStudentOutcome || '');
    setEditStepType(step.type);
    setEditStepDuration(step.durationMinutes);
    setEditStepClickLabel(step.annotation?.label || '');
  };

  const handleSaveQuickEditStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStep) return;
    setFeedbackBanner(null);
    const res = manageStepUseCase.updateStep(handbook.id, editingStep.id, {
      title: editStepTitle,
      description: editStepDesc,
      expectedStudentOutcome: editStepOutcome,
      type: editStepType,
      durationMinutes: editStepDuration,
      clickLabel: editStepClickLabel,
    });
    if (!res.ok) {
      setFeedbackBanner({ type: 'error', message: res.error.message });
      return;
    }
    onHandbookChange(res.value);
    setEditingStep(null);
    setFeedbackBanner({
      type: 'success',
      message: `Updated Step #${editingStep.orderIndex}.`,
    });
  };

  const handleAddStep = () => {
    setFeedbackBanner(null);
    const defaultTitle =
      newStepTitle.trim() ||
      (newStepType === StepType.WARNING
        ? 'Safety Rule: Check your equipment before going to the next step'
        : newStepType === StepType.TIP
        ? 'Helpful Tip: Double-check your answers in the table'
        : 'Click the highlighted button on your screen');

    const res = manageStepUseCase.addStep(handbook.id, {
      type: newStepType,
      title: defaultTitle,
      description:
        newStepDesc.trim() ||
        'Look at the target circle in the picture below and make sure your screen matches.',
      expectedStudentOutcome:
        newStepOutcome.trim() || 'Student finishes this step smoothly.',
      durationMinutes: newStepDuration,
    });

    if (!res.ok) {
      setFeedbackBanner({ type: 'error', message: res.error.message });
      return;
    }

    setNewStepTitle('');
    setNewStepDesc('');
    setNewStepOutcome('');
    setAddStepWizardPage(1);
    setAddStepWizardOpen(false);
    onHandbookChange(res.value);
    setFeedbackBanner({
      type: 'success',
      message: `Added Step #${res.value.steps.length} to your handbook!`,
    });
  };

  const handleUpdateStepField = (
    stepId: string,
    updates: Parameters<typeof manageStepUseCase.updateStep>[2]
  ) => {
    setFeedbackBanner(null);
    const res = manageStepUseCase.updateStep(handbook.id, stepId, updates);
    if (!res.ok) {
      setFeedbackBanner({ type: 'error', message: res.error.message });
      return;
    }
    onHandbookChange(res.value);
  };

  const handleReorderStep = (stepId: string, direction: 'UP' | 'DOWN') => {
    setFeedbackBanner(null);
    const res = manageStepUseCase.reorderStep(handbook.id, stepId, direction);
    if (!res.ok) {
      setFeedbackBanner({ type: 'error', message: res.error.message });
      return;
    }
    onHandbookChange(res.value);
  };

  const handleDuplicateStep = (stepId: string) => {
    setFeedbackBanner(null);
    const res = manageStepUseCase.duplicateStep(handbook.id, stepId);
    if (!res.ok) {
      setFeedbackBanner({ type: 'error', message: res.error.message });
      return;
    }
    onHandbookChange(res.value);
    setFeedbackBanner({ type: 'success', message: 'Copied step!' });
  };

  const handleDeleteStep = (stepId: string) => {
    setFeedbackBanner(null);
    const res = manageStepUseCase.deleteStep(handbook.id, stepId);
    if (!res.ok) {
      setFeedbackBanner({ type: 'error', message: res.error.message });
      return;
    }
    onHandbookChange(res.value);
    setFeedbackBanner({ type: 'success', message: 'Removed step and updated step numbers.' });
  };

  const handleCreateSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackBanner(null);
    const res = versionControlUseCase.createSnapshot(
      handbook.id,
      handbook.authorName,
      snapshotSummary
    );
    if (!res.ok) {
      setFeedbackBanner({ type: 'error', message: res.error.message });
      return;
    }
    setSnapshotSummary('');
    onHandbookChange(res.value);
    setFeedbackBanner({
      type: 'success',
      message: `Saved backup version ${res.value.versions[0]?.versionNumber}!`,
    });
  };

  const handleRestoreSnapshot = (versionId: string) => {
    setFeedbackBanner(null);
    const res = versionControlUseCase.restoreSnapshot(handbook.id, versionId);
    if (!res.ok) {
      setFeedbackBanner({ type: 'error', message: res.error.message });
      return;
    }
    onHandbookChange(res.value);
    setShowVersionDrawer(false);
    setFeedbackBanner({
      type: 'success',
      message: `Restored handbook from saved version.`,
    });
  };

  const totalMinutes = handbook.steps.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const currentFolderName =
    folders.find((f) => f.id === handbook.departmentFolderId)?.name || 'Class Folder';

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Contextual Editor Action Bar */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Guides
          </Button>
          <div className="text-xs text-muted-foreground font-mono tabular-nums">
            <span className="font-semibold text-foreground">{handbook.courseCode}</span>
            <span className="mx-1.5">·</span>
            <span>{handbook.status}</span>
            <span className="mx-1.5">·</span>
            <span>{handbook.steps.length} Steps</span>
            <span className="mx-1.5">·</span>
            <span>{totalMinutes} mins</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToggleStar}
          >
            <Star className={`w-3.5 h-3.5 ${handbook.isStarred ? 'fill-current' : ''}`} />
            {handbook.isStarred ? 'Favorite' : 'Add Favorite'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowVersionDrawer(true)}
          >
            <History className="w-3.5 h-3.5" />
            Versions ({handbook.versions.length})
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTogglePublish}
          >
            {handbook.status === HandbookStatus.PUBLISHED ? 'Switch to Draft' : 'Publish Guide'}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setPrintModalOpen(true)}
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF Wizard
          </Button>
        </div>
      </div>

      {/* Live Status / Validation Feedback Banner */}
      {feedbackBanner && (
        <div className="no-print p-3 rounded-lg border border-foreground bg-muted text-xs text-foreground flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs underline"
            onClick={() => setFeedbackBanner(null)}
          >
            OK
          </Button>
        </div>
      )}

      {/* Clean Handbook Header Summary Card (Opens 3-Step Info Setup Wizard Drawer) */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-mono tabular-nums">
              <span className="font-bold text-foreground">{handbook.courseCode}</span>
              <span>·</span>
              <span>{handbook.gradeLevel}</span>
              <span>·</span>
              <span>{handbook.academicTerm}</span>
              <span>·</span>
              <span>{currentFolderName}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground font-display leading-snug">
              {handbook.title}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {handbook.subtitle}
            </p>
          </div>

          <div className="no-print flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openEditInfoWizard}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Edit Handbook Info
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border text-xs text-muted-foreground font-mono tabular-nums">
          <span>Teacher / Author: {handbook.authorName}</span>
          <span>
            Views: {handbook.viewCount} · Printed PDF Copies: {handbook.downloadedPdfCount}
          </span>
        </div>
      </Card>

      {/* Step-by-Step Visual Sequence */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground font-display tabular-nums">
              Step-by-Step Guide ({handbook.steps.length} Steps · {totalMinutes} mins total)
            </h2>
            <p className="no-print text-xs text-muted-foreground">
              Tap any picture to move the target circle, or click &ldquo;Edit Step&rdquo; to open the quick-edit drawer.
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            className="no-print"
            onClick={() => {
              setAddStepWizardPage(1);
              setAddStepWizardOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Add New Step
          </Button>
        </div>

        {handbook.steps.map((step, index) => (
          <Card
            key={step.id}
            className="print-avoid-break p-4 sm:p-5 space-y-4 transition-colors"
          >
            {/* Step Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                  {step.orderIndex}
                </span>

                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-mono tabular-nums">
                    <span className="font-bold text-foreground">{step.type}</span>
                    <span>·</span>
                    <span>{step.durationMinutes} min</span>
                    {step.isRequiredForSignOff && (
                      <>
                        <span>·</span>
                        <span>Sign-off checklist item</span>
                      </>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-foreground font-display leading-snug">
                    {step.title}
                  </h3>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>

                  {step.expectedStudentOutcome && (
                    <div className="text-[11px] text-foreground font-medium pt-0.5">
                      Goal Check: <span className="text-muted-foreground">{step.expectedStudentOutcome}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Step Action Controls */}
              <div className="no-print flex flex-wrap items-center justify-end gap-1 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openQuickEditStepDrawer(step)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Step
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReorderStep(step.id, 'UP')}
                  disabled={index === 0}
                  title="Move Step Up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReorderStep(step.id, 'DOWN')}
                  disabled={index === handbook.steps.length - 1}
                  title="Move Step Down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDuplicateStep(step.id)}
                  title="Copy Step"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteStep(step.id)}
                  title="Delete Step"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Interactive Captured Screen Viewport & Click-Target Calibration */}
            {step.mockup && (
              <div className="pl-0 sm:pl-10 space-y-2.5">
                <ScreenMockupCanvas
                  mockup={step.mockup}
                  annotation={step.annotation}
                  interactive={true}
                  onRepositionClickTarget={(xPercent, yPercent) =>
                    handleUpdateStepField(step.id, {
                      clickXPercent: xPercent,
                      clickYPercent: yPercent,
                    })
                  }
                />

                <div className="no-print flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
                  <span className="font-mono text-[11px]">
                    Target Label: <strong className="text-foreground">{step.annotation?.label || 'Click Here'}</strong>
                  </span>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-foreground font-medium">
                        Hide Student Names
                      </span>
                      <Switch
                        checked={step.mockup.redactedPii}
                        onCheckedChange={(checked) =>
                          handleUpdateStepField(step.id, { redactedPii: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() =>
                          handleUpdateStepField(step.id, {
                            zoomScale: step.mockup!.zoomScale - 0.15,
                          })
                        }
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() =>
                          handleUpdateStepField(step.id, {
                            zoomScale: step.mockup!.zoomScale + 0.15,
                          })
                        }
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        ))}

        {/* Bottom Add Step Button */}
        <div className="no-print flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setAddStepWizardPage(1);
              setAddStepWizardOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Add Step #{handbook.steps.length + 1} via Step Wizard
          </Button>
        </div>
      </div>

      {/* 1. EDIT HANDBOOK INFO 3-STEP WIZARD DRAWER */}
      <Sheet open={infoWizardOpen} onOpenChange={setInfoWizardOpen}>
        <SheetContent side="right" size="lg">
          <SheetHeader>
            <SheetTitle>Edit Handbook Info — 3-Step Setup Wizard</SheetTitle>
            <SheetDescription>
              Update your handbook title, class details, and subject folder.
            </SheetDescription>
          </SheetHeader>

          <SheetBody>
            <WizardStepper
              steps={INFO_WIZARD_STEPS}
              currentStep={infoWizardStep}
              onStepSelect={(s) => setInfoWizardStep(s)}
            />

            {infoWizardStep === 1 && (
              <Card className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label>Handbook Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Handbook Title"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Short Description for Students</Label>
                  <Textarea
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    rows={3}
                    placeholder="Short description printed on the cover..."
                  />
                </div>
              </Card>
            )}

            {infoWizardStep === 2 && (
              <Card className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Class Code</Label>
                    <Input
                      value={courseCode}
                      onChange={(e) => setCourseCode(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Grade / Age Group</Label>
                    <Input
                      value={gradeLevel}
                      onChange={(e) => setGradeLevel(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>School Term</Label>
                    <Input
                      value={academicTerm}
                      onChange={(e) => setAcademicTerm(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Teacher / Author</Label>
                    <Input
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Class Folder</Label>
                  <Select
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                  >
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.departmentCode})
                      </option>
                    ))}
                  </Select>
                </div>
              </Card>
            )}

            {infoWizardStep === 3 && (
              <Card className="p-4 space-y-3 text-xs">
                <div className="font-bold text-foreground text-sm">
                  Review Handbook Details
                </div>
                <div className="space-y-2 pt-2 border-t border-border">
                  <div>
                    <span className="text-muted-foreground">Title: </span>
                    <strong className="text-foreground">{title}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Summary: </span>
                    <span className="text-foreground">{subtitle}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Class &amp; Cohort: </span>
                    <span className="font-mono text-foreground">
                      {courseCode} · {gradeLevel} · {academicTerm}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Teacher: </span>
                    <span className="text-foreground">{authorName}</span>
                  </div>
                </div>
              </Card>
            )}
          </SheetBody>

          <SheetFooter>
            <div>
              {infoWizardStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInfoWizardStep((p) => p - 1)}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Previous
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setInfoWizardOpen(false)}
                >
                  Cancel
                </Button>
              )}
            </div>
            <div>
              {infoWizardStep < 3 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setInfoWizardStep((p) => p + 1)}
                >
                  Next
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={handleSaveHeaderMetadata}>
                  <CheckCircle2 className="w-4 h-4" />
                  Save Handbook Info
                </Button>
              )}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* 2. ADD NEW STEP 3-STEP WIZARD DRAWER */}
      <Sheet open={addStepWizardOpen} onOpenChange={setAddStepWizardOpen}>
        <SheetContent side="right" size="lg">
          <SheetHeader>
            <SheetTitle>Add Step #{handbook.steps.length + 1} — Step Setup Wizard</SheetTitle>
            <SheetDescription>
              Follow the 3 quick steps to add a new visual instruction to your handbook.
            </SheetDescription>
          </SheetHeader>

          <SheetBody>
            <WizardStepper
              steps={ADD_STEP_WIZARD_STEPS}
              currentStep={addStepWizardPage}
              onStepSelect={(s) => setAddStepWizardPage(s)}
            />

            {addStepWizardPage === 1 && (
              <Card className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label>Kind of Step</Label>
                  <Select
                    value={newStepType}
                    onChange={(e) => setNewStepType(e.target.value as StepType)}
                  >
                    <option value={StepType.ACTION}>Action Step (With Screen Picture)</option>
                    <option value={StepType.TIP}>Helpful Tip</option>
                    <option value={StepType.WARNING}>Safety Rule / Warning</option>
                    <option value={StepType.HEADER}>Section Title</option>
                    <option value={StepType.CHECKPOINT}>Goal Check</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>What should the student do?</Label>
                  <Input
                    value={newStepTitle}
                    onChange={(e) => setNewStepTitle(e.target.value)}
                    placeholder="e.g., Click the 'Start Quiz' button in the top corner"
                  />
                </div>
              </Card>
            )}

            {addStepWizardPage === 2 && (
              <Card className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label>Extra Helper Notes for Students</Label>
                  <Textarea
                    value={newStepDesc}
                    onChange={(e) => setNewStepDesc(e.target.value)}
                    rows={4}
                    placeholder="Write easy helper details so students know exactly what to look for..."
                  />
                </div>
              </Card>
            )}

            {addStepWizardPage === 3 && (
              <Card className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label>Estimated Time (Minutes)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={240}
                    value={newStepDuration}
                    onChange={(e) => setNewStepDuration(Number(e.target.value))}
                    className="font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>What shows the step is done? (Goal Check)</Label>
                  <Input
                    value={newStepOutcome}
                    onChange={(e) => setNewStepOutcome(e.target.value)}
                    placeholder="e.g., Screen shows 'Saved!'"
                  />
                </div>
              </Card>
            )}
          </SheetBody>

          <SheetFooter>
            <div>
              {addStepWizardPage > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddStepWizardPage((p) => p - 1)}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Previous
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddStepWizardOpen(false)}
                >
                  Cancel
                </Button>
              )}
            </div>
            <div>
              {addStepWizardPage < 3 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setAddStepWizardPage((p) => p + 1)}
                >
                  Next
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={handleAddStep}>
                  <Plus className="w-4 h-4" />
                  Add Step #{handbook.steps.length + 1}
                </Button>
              )}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* 3. QUICK-EDIT STEP SLIDE-OVER DRAWER */}
      <Sheet
        open={Boolean(editingStep)}
        onOpenChange={(open) => {
          if (!open) setEditingStep(null);
        }}
      >
        <SheetContent side="right" size="default">
          <SheetHeader>
            <SheetTitle>
              Quick Edit — Step #{editingStep?.orderIndex}
            </SheetTitle>
            <SheetDescription>
              Update the instruction text, helper notes, time, or button label for this step.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSaveQuickEditStep} className="flex flex-col flex-1 overflow-hidden">
            <SheetBody>
              <div className="space-y-1.5">
                <Label>Step Kind</Label>
                <Select
                  value={editStepType}
                  onChange={(e) => setEditStepType(e.target.value as StepType)}
                >
                  <option value={StepType.ACTION}>Action Step (With Picture)</option>
                  <option value={StepType.TIP}>Helpful Tip</option>
                  <option value={StepType.WARNING}>Safety Rule / Warning</option>
                  <option value={StepType.HEADER}>Section Title</option>
                  <option value={StepType.CHECKPOINT}>Goal Check</option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Step Instruction Title</Label>
                <Input
                  value={editStepTitle}
                  onChange={(e) => setEditStepTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Helper Notes</Label>
                <Textarea
                  value={editStepDesc}
                  onChange={(e) => setEditStepDesc(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Goal Check (What happens when finished?)</Label>
                <Input
                  value={editStepOutcome}
                  onChange={(e) => setEditStepOutcome(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Time (Minutes)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={240}
                    value={editStepDuration}
                    onChange={(e) => setEditStepDuration(Number(e.target.value))}
                    className="font-mono tabular-nums"
                  />
                </div>
                {editingStep?.mockup && (
                  <div className="space-y-1.5">
                    <Label>Target Circle Label</Label>
                    <Input
                      value={editStepClickLabel}
                      onChange={(e) => setEditStepClickLabel(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </SheetBody>

            <SheetFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingStep(null)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save Step Changes
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* 4. SAVED BACKUP VERSIONS SLIDE-OVER DRAWER */}
      <Sheet open={showVersionDrawer} onOpenChange={setShowVersionDrawer}>
        <SheetContent side="right" size="default">
          <SheetHeader>
            <SheetTitle>Saved Backup Versions ({handbook.versions.length})</SheetTitle>
            <SheetDescription>
              Save a checkpoint anytime or bring back an earlier version of this handbook.
            </SheetDescription>
          </SheetHeader>

          <SheetBody>
            <form onSubmit={handleCreateSnapshot} className="space-y-2.5 p-3.5 rounded-xl border border-border bg-muted/40">
              <Label>Save a New Backup Checkpoint</Label>
              <Input
                value={snapshotSummary}
                onChange={(e) => setSnapshotSummary(e.target.value)}
                placeholder="Note (e.g., Added safety steps)"
                className="text-xs"
              />
              <Button type="submit" size="sm" className="w-full">
                Save Backup Now
              </Button>
            </form>

            <div className="space-y-2">
              <div className="text-xs font-bold text-foreground">
                Version History
              </div>
              <div className="divide-y divide-border border border-border rounded-lg">
                {handbook.versions.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground text-center">
                    No saved backups yet.
                  </div>
                ) : (
                  handbook.versions.map((ver) => (
                    <div
                      key={ver.versionId}
                      className="p-3 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-foreground">
                          {ver.versionNumber}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                          {new Date(ver.createdAt).toLocaleDateString()} · {ver.stepCount} steps
                        </span>
                      </div>
                      <p className="text-foreground font-medium">{ver.changeSummary}</p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-muted-foreground">
                          By {ver.authorName}
                        </span>
                        {ver.snapshotSteps.length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            onClick={() => handleRestoreSnapshot(ver.versionId)}
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restore
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </SheetBody>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowVersionDrawer(false)}
            >
              Close Drawer
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* 5. PRINT & PDF 3-STEP WIZARD DRAWER */}
      <PrintablePreviewModal
        open={printModalOpen}
        onOpenChange={setPrintModalOpen}
        handbook={handbook}
        onHandbookUpdated={onHandbookChange}
      />
    </div>
  );
};
