import React, { useState } from 'react';
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
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select } from '@/src/components/ui/select';
import { Card } from '@/src/components/ui/card';
import {
  CaptureActionEvent,
  Handbook,
  HandbookDomainPolicy,
  HandbookFolder,
  ScreenMockupState,
} from '../../domain/entities/Handbook';
import { useDependencies } from '../context/DependencyContext';
import {
  Crosshair,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

interface CaptureRecorderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: ReadonlyArray<HandbookFolder>;
  onHandbookCreated: (handbook: Handbook) => void;
}

const SIMULATED_TARGETS: Record<
  ScreenMockupState['screenTheme'],
  ReadonlyArray<{
    label: string;
    urlBar: string;
    xPercent: number;
    yPercent: number;
    verb: CaptureActionEvent['actionVerb'];
  }>
> = {
  'lms-canvas': [
    {
      label: 'Student Sign-In Button',
      urlBar: 'https://school.edu/login',
      xPercent: 72,
      yPercent: 32,
      verb: 'Click',
    },
    {
      label: 'Class Menu: Lessons Tab',
      urlBar: 'https://school.edu/courses/101/lessons',
      xPercent: 18,
      yPercent: 45,
      verb: 'Click',
    },
    {
      label: 'Choose Homework PDF File',
      urlBar: 'https://school.edu/courses/101/homework/upload',
      xPercent: 56,
      yPercent: 64,
      verb: 'Select',
    },
    {
      label: 'Turn In Homework Button',
      urlBar: 'https://school.edu/courses/101/homework/done',
      xPercent: 80,
      yPercent: 78,
      verb: 'Submit',
    },
  ],
  'lab-simulator': [
    {
      label: 'Plug In pH Sensor Cable',
      urlBar: 'https://lab.school.edu/sensors/connect',
      xPercent: 28,
      yPercent: 36,
      verb: 'Click',
    },
    {
      label: 'Setup pH Sensor (7.00 Check)',
      urlBar: 'https://lab.school.edu/sensors/setup',
      xPercent: 66,
      yPercent: 44,
      verb: 'Click',
    },
    {
      label: 'Start Recording Graph Numbers',
      urlBar: 'https://lab.school.edu/experiment/live',
      xPercent: 52,
      yPercent: 70,
      verb: 'Verify',
    },
  ],
  'git-terminal': [
    {
      label: 'Accept Coding Starter Project',
      urlBar: 'https://classroom.school.edu/a/coding-project',
      xPercent: 50,
      yPercent: 52,
      verb: 'Click',
    },
    {
      label: 'Run Code Test Checker',
      urlBar: 'editor://workspace/tests/run',
      xPercent: 34,
      yPercent: 76,
      verb: 'Verify',
    },
    {
      label: 'Save & Turn In Code Project',
      urlBar: 'editor://workspace/project/save',
      xPercent: 74,
      yPercent: 28,
      verb: 'Submit',
    },
  ],
  'chromebook-os': [
    {
      label: 'Sign Out of Laptop Desktop',
      urlBar: 'chrome://settings/signout',
      xPercent: 84,
      yPercent: 88,
      verb: 'Click',
    },
    {
      label: 'Open School Test App',
      urlBar: 'chrome://apps/test-mode',
      xPercent: 18,
      yPercent: 84,
      verb: 'Select',
    },
  ],
  'iep-portal': [
    {
      label: 'Turn On Read-Aloud Voice',
      urlBar: 'https://portal.school.edu/reader/voice',
      xPercent: 82,
      yPercent: 24,
      verb: 'Click',
    },
    {
      label: 'Turn On 3-Line Reading Ruler',
      urlBar: 'https://portal.school.edu/reader/ruler',
      xPercent: 60,
      yPercent: 55,
      verb: 'Select',
    },
  ],
};

const WIZARD_STEPS = [
  { stepNumber: 1, title: 'Guide Details', subtitle: 'Title, class & teacher' },
  { stepNumber: 2, title: 'Record Actions', subtitle: 'Tap classroom buttons' },
  { stepNumber: 3, title: 'Review & Finish', subtitle: 'Check steps & create' },
] as const;

export const CaptureRecorderModal: React.FC<CaptureRecorderModalProps> = ({
  open,
  onOpenChange,
  folders,
  onHandbookCreated,
}) => {
  const { captureWorkflowUseCase } = useDependencies();

  const [wizardStep, setWizardStep] = useState<number>(1);
  const [title, setTitle] = useState('Science Class — How to Setup Your Sensor & Turn In Work');
  const [courseCode, setCourseCode] = useState('SCI-101');
  const [gradeLevel, setGradeLevel] = useState('Grades 5–10');
  const [authorName, setAuthorName] = useState('Dr. Elena Rostova');
  const [folderId, setFolderId] = useState(folders[0]?.id || 'folder-stem');
  const [selectedTheme, setSelectedTheme] =
    useState<ScreenMockupState['screenTheme']>('lms-canvas');

  const [recordedEvents, setRecordedEvents] = useState<CaptureActionEvent[]>([
    {
      targetLabel: SIMULATED_TARGETS['lms-canvas'][0].label,
      urlBar: SIMULATED_TARGETS['lms-canvas'][0].urlBar,
      xPercent: SIMULATED_TARGETS['lms-canvas'][0].xPercent,
      yPercent: SIMULATED_TARGETS['lms-canvas'][0].yPercent,
      screenTheme: 'lms-canvas',
      actionVerb: SIMULATED_TARGETS['lms-canvas'][0].verb,
    },
    {
      targetLabel: SIMULATED_TARGETS['lms-canvas'][1].label,
      urlBar: SIMULATED_TARGETS['lms-canvas'][1].urlBar,
      xPercent: SIMULATED_TARGETS['lms-canvas'][1].xPercent,
      yPercent: SIMULATED_TARGETS['lms-canvas'][1].yPercent,
      screenTheme: 'lms-canvas',
      actionVerb: SIMULATED_TARGETS['lms-canvas'][1].verb,
    },
  ]);
  const [customTargetLabel, setCustomTargetLabel] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleNextStep = () => {
    setErrorMessage(null);
    if (wizardStep === 1) {
      const check = HandbookDomainPolicy.validateHandbookMetadata({
        title,
        courseCode,
        gradeLevel,
        authorName,
      });
      if (!check.ok) {
        setErrorMessage(check.error.message);
        return;
      }
      setWizardStep(2);
    } else if (wizardStep === 2) {
      if (recordedEvents.length === 0) {
        setErrorMessage('Please record at least 1 step before moving to Review.');
        return;
      }
      setWizardStep(3);
    }
  };

  const handleRecordPresetClick = (preset: {
    label: string;
    urlBar: string;
    xPercent: number;
    yPercent: number;
    verb: CaptureActionEvent['actionVerb'];
  }) => {
    setErrorMessage(null);
    setRecordedEvents((prev) => [
      ...prev,
      {
        targetLabel: preset.label,
        urlBar: preset.urlBar,
        xPercent: preset.xPercent,
        yPercent: preset.yPercent,
        screenTheme: selectedTheme,
        actionVerb: preset.verb,
      },
    ]);
  };

  const handleAddCustomEvent = () => {
    if (!customTargetLabel.trim()) return;
    setErrorMessage(null);
    setRecordedEvents((prev) => [
      ...prev,
      {
        targetLabel: customTargetLabel.trim(),
        urlBar: `https://workspace.school.edu/${selectedTheme}/step-${prev.length + 1}`,
        xPercent: 55,
        yPercent: 48,
        screenTheme: selectedTheme,
        actionVerb: 'Click',
      },
    ]);
    setCustomTargetLabel('');
  };

  const handleCompleteCapture = () => {
    setErrorMessage(null);
    const result = captureWorkflowUseCase.createHandbookFromCaptureSession({
      title,
      courseCode,
      gradeLevel,
      authorName,
      departmentFolderId: folderId,
      events: recordedEvents,
    });

    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    setWizardStep(1);
    onHandbookCreated(result.value);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Crosshair className="w-5 h-5" />
            Record a New up Guide — 3-Step Setup Wizard
          </SheetTitle>
          <SheetDescription>
            Follow the 3 simple steps below to set up your handbook, record classroom screen actions, and generate your visual student guide.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <WizardStepper
            steps={WIZARD_STEPS}
            currentStep={wizardStep}
            onStepSelect={(s) => {
              setErrorMessage(null);
              setWizardStep(s);
            }}
          />

          {errorMessage && (
            <div className="p-3 rounded-lg border border-foreground bg-muted text-xs text-foreground font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* WIZARD STEP 1: GUIDE DETAILS */}
          {wizardStep === 1 && (
            <Card className="p-4 sm:p-5 space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground font-display">
                  Step 1: Enter Handbook Details
                </h3>
                <p className="text-xs text-muted-foreground">
                  Give your student handbook a clear title, class code, and folder so students can find it easily.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Handbook Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Science Lab Sensor Setup"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Class Code</Label>
                    <Input
                      value={courseCode}
                      onChange={(e) => setCourseCode(e.target.value)}
                      placeholder="SCI-101"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Grade / Age Group</Label>
                    <Input
                      value={gradeLevel}
                      onChange={(e) => setGradeLevel(e.target.value)}
                      placeholder="Grades 5–10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Teacher / Author Name</Label>
                    <Input
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      placeholder="Dr. Elena Rostova"
                    />
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
                </div>
              </div>
            </Card>
          )}

          {/* WIZARD STEP 2: RECORD SCREEN ACTIONS */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <Card className="p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-foreground font-display">
                      Step 2: Tap Classroom Buttons to Record
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Pick a classroom screen and click any action below to add it to your guide.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-foreground tabular-nums px-2.5 py-1 rounded bg-muted border border-border">
                    {recordedEvents.length} Steps Recorded
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1 bg-muted p-1 rounded-lg border border-border">
                  {(
                    [
                      { id: 'lms-canvas', label: 'Class Portal' },
                      { id: 'lab-simulator', label: 'Science Lab' },
                      { id: 'git-terminal', label: 'Coding App' },
                      { id: 'chromebook-os', label: 'School Laptop' },
                      { id: 'iep-portal', label: 'Reading Helper' },
                    ] as const
                  ).map((env) => (
                    <button
                      key={env.id}
                      type="button"
                      onClick={() => setSelectedTheme(env.id)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedTheme === env.id
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {env.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SIMULATED_TARGETS[selectedTheme].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleRecordPresetClick(preset)}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-left cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold text-foreground truncate">
                          {preset.verb}: &ldquo;{preset.label}&rdquo;
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground truncate">
                          Target ({preset.xPercent}%, {preset.yPercent}%)
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-foreground underline shrink-0">
                        + Record
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3 border-t border-border">
                  <Input
                    value={customTargetLabel}
                    onChange={(e) => setCustomTargetLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomEvent();
                      }
                    }}
                    placeholder="Or type your own custom step (e.g., Click 'Save Quiz' button)..."
                    className="text-xs"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddCustomEvent}>
                    <Plus className="w-3.5 h-3.5" />
                    Add Custom Step
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* WIZARD STEP 3: REVIEW & FINISH */}
          {wizardStep === 3 && (
            <Card className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground font-display">
                    Step 3: Review Your Handbook Steps ({recordedEvents.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {title} · {courseCode} · {gradeLevel}
                  </p>
                </div>
                {recordedEvents.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setRecordedEvents([])}
                  >
                    Clear All
                  </Button>
                )}
              </div>

              {recordedEvents.length === 0 ? (
                <div className="p-8 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
                  No steps recorded yet. Go back to Step 2 to record at least one action.
                </div>
              ) : (
                <div className="divide-y divide-border border border-border rounded-lg bg-background">
                  {recordedEvents.map((ev, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-[11px] shrink-0 tabular-nums">
                          {index + 1}
                        </span>
                        <span className="font-semibold text-foreground truncate">
                          {ev.actionVerb} on &ldquo;{ev.targetLabel}&rdquo;
                        </span>
                        <span className="text-muted-foreground font-mono text-[11px] shrink-0 tabular-nums hidden sm:inline">
                          ({ev.xPercent}%, {ev.yPercent}%)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() =>
                          setRecordedEvents((prev) => prev.filter((_, i) => i !== index))
                        }
                        title="Remove step"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </SheetBody>

        <SheetFooter>
          <div className="flex items-center gap-2">
            {wizardStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setErrorMessage(null);
                  setWizardStep((prev) => prev - 1);
                }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Previous Step
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {wizardStep < 3 ? (
              <Button type="button" size="sm" onClick={handleNextStep}>
                Next Step
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={handleCompleteCapture}>
                <CheckCircle2 className="w-4 h-4" />
                Create Handbook ({recordedEvents.length} Steps)
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
