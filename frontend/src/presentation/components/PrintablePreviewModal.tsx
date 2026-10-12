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
import { Switch } from '@/src/components/ui/switch';
import { Card } from '@/src/components/ui/card';
import {
  Handbook,
  HandbookDomainPolicy,
  PrintConfiguration,
  StepType,
} from '../../domain/entities/Handbook';
import { useDependencies } from '../context/DependencyContext';
import {
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

interface PrintablePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handbook: Handbook;
  onHandbookUpdated: (updated: Handbook) => void;
}

const PRINT_WIZARD_STEPS = [
  { stepNumber: 1, title: 'Paper & Copies', subtitle: 'Header, size & count' },
  { stepNumber: 2, title: 'Page Options', subtitle: 'Sections & privacy' },
  { stepNumber: 3, title: 'Preview & Print', subtitle: 'Booklet check & PDF' },
] as const;

export const PrintablePreviewModal: React.FC<PrintablePreviewModalProps> = ({
  open,
  onOpenChange,
  handbook,
  onHandbookUpdated,
}) => {
  const { exportPrintablePdfUseCase } = useDependencies();

  const [wizardStep, setWizardStep] = useState<number>(1);
  const [config, setConfig] = useState<PrintConfiguration>({
    paperSize: 'LETTER',
    includeCoverPage: true,
    includeTableOfContents: true,
    includeScreenshots: true,
    includeTeacherNotes: true,
    includeStudentSignOffSheet: true,
    redactAllStudentPii: true,
    institutionName: 'Oakridge School of Science & Arts',
    copiesCount: 30,
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{
    ok: boolean;
    message: string;
    warnings?: ReadonlyArray<string>;
  } | null>(null);

  const readinessCheck = HandbookDomainPolicy.validatePrintReadiness(handbook, config);
  const totalMinutes = handbook.steps.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    setExportStatus(null);
    const res = await exportPrintablePdfUseCase.execute(handbook.id, config);
    setIsExporting(false);

    if (!res.ok) {
      setExportStatus({
        ok: false,
        message: res.error.message,
      });
      return;
    }

    onHandbookUpdated(res.value.updatedHandbook);
    setExportStatus({
      ok: true,
      message: `Saved "${res.value.artifact.filename}" (${res.value.artifact.pageCount} pages, ${(
        res.value.artifact.byteSize / 1024
      ).toFixed(1)} KB) ready for ${config.copiesCount} printed student copies!`,
      warnings: res.value.artifact.warnings,
    });
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            up Print &amp; PDF Booklet Wizard
          </SheetTitle>
          <SheetDescription>
            Follow the 3 steps to set up your paper size, choose booklet sections, and download or print your student handbook.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <WizardStepper
            steps={PRINT_WIZARD_STEPS}
            currentStep={wizardStep}
            onStepSelect={(s) => setWizardStep(s)}
          />

          {exportStatus && (
            <div className="p-3 rounded-lg border border-foreground bg-muted text-xs text-foreground flex flex-col gap-1">
              <div className="flex items-center gap-2 font-semibold">
                {exportStatus.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{exportStatus.message}</span>
              </div>
              {exportStatus.warnings && exportStatus.warnings.length > 0 && (
                <div className="pl-6 text-[11px] text-muted-foreground">
                  Note: {exportStatus.warnings.join(' · ')}
                </div>
              )}
            </div>
          )}

          {!readinessCheck.ok && (
            <div className="p-3 rounded-lg border border-foreground bg-muted text-xs text-foreground font-semibold">
              Please fix before printing: {readinessCheck.error.message}
            </div>
          )}

          {/* STEP 1: PAPER & COPIES SETUP */}
          {wizardStep === 1 && (
            <Card className="p-4 sm:p-5 space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground font-display">
                  Step 1: Paper Size &amp; Classroom Copies
                </h3>
                <p className="text-xs text-muted-foreground">
                  Set the school name printed at the top of each page, paper stock, and number of copies for your class.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>School or Class Header Name</Label>
                  <Input
                    value={config.institutionName}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, institutionName: e.target.value }))
                    }
                    className="text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Paper Size</Label>
                    <Select
                      value={config.paperSize}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          paperSize: e.target.value as 'LETTER' | 'A4',
                        }))
                      }
                    >
                      <option value="LETTER">US Letter (8.5&quot; × 11&quot;)</option>
                      <option value="A4">ISO A4 Paper (210 × 297 mm)</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Number of Copies for Class (1–500)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={config.copiesCount}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          copiesCount: Number(e.target.value),
                        }))
                      }
                      className="text-xs font-mono tabular-nums"
                    />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* STEP 2: PAGE & PRIVACY OPTIONS */}
          {wizardStep === 2 && (
            <Card className="p-4 sm:p-5 space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground font-display">
                  Step 2: Choose Booklet Sections &amp; Privacy
                </h3>
                <p className="text-xs text-muted-foreground">
                  Turn sections on or off depending on what your students need on their printed desks.
                </p>
              </div>

              <div className="divide-y divide-border border border-border rounded-lg bg-background">
                <div className="flex items-center justify-between gap-3 p-3.5">
                  <div>
                    <div className="text-xs font-semibold text-foreground">Show Title Cover Box</div>
                    <div className="text-[11px] text-muted-foreground">
                      Prints handbook title, class code, teacher name, and total time at the top.
                    </div>
                  </div>
                  <Switch
                    checked={config.includeCoverPage}
                    onCheckedChange={(v) =>
                      setConfig((prev) => ({ ...prev, includeCoverPage: v }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-3 p-3.5">
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Show Step-by-Step Checklist Table
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Adds checkboxes so students can check off each step as they work.
                    </div>
                  </div>
                  <Switch
                    checked={config.includeTableOfContents}
                    onCheckedChange={(v) =>
                      setConfig((prev) => ({ ...prev, includeTableOfContents: v }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-3 p-3.5">
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Show Step Screen Pictures &amp; Click Circles
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Includes visual screen diagrams with target circles for each action step.
                    </div>
                  </div>
                  <Switch
                    checked={config.includeScreenshots}
                    onCheckedChange={(v) =>
                      setConfig((prev) => ({ ...prev, includeScreenshots: v }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-3 p-3.5">
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Show Goal Check Notes
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Prints what students should verify before moving to the next step.
                    </div>
                  </div>
                  <Switch
                    checked={config.includeTeacherNotes}
                    onCheckedChange={(v) =>
                      setConfig((prev) => ({ ...prev, includeTeacherNotes: v }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-3 p-3.5">
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Show Student Sign-Off Slip at Bottom
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Adds a tear-off signature slip for students and teachers to sign.
                    </div>
                  </div>
                  <Switch
                    checked={config.includeStudentSignOffSheet}
                    onCheckedChange={(v) =>
                      setConfig((prev) => ({ ...prev, includeStudentSignOffSheet: v }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-3 p-3.5 bg-muted/30">
                  <div>
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      Hide Private Student Info (Names, Emails &amp; IDs)
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Automatically masks student emails and ID numbers on printed copies.
                    </div>
                  </div>
                  <Switch
                    checked={config.redactAllStudentPii}
                    onCheckedChange={(v) =>
                      setConfig((prev) => ({ ...prev, redactAllStudentPii: v }))
                    }
                  />
                </div>
              </div>
            </Card>
          )}

          {/* STEP 3: LIVE PAPER SHEET PREVIEW & EXPORT */}
          {wizardStep === 3 && (
            <div className="border border-border rounded-xl bg-card p-4 sm:p-6 shadow-xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 text-[11px] text-muted-foreground font-mono tabular-nums">
                <span>up · {config.institutionName}</span>
                <span>
                  {handbook.courseCode} · v1.{handbook.revision} · {config.paperSize}
                </span>
              </div>

              {config.includeCoverPage && (
                <div className="p-4 rounded-lg border border-border bg-muted/40 space-y-1.5">
                  <div className="text-[11px] font-bold text-foreground">
                    up HANDBOOK · {handbook.courseCode} · {handbook.gradeLevel} · {handbook.academicTerm}
                  </div>
                  <h3 className="text-base font-bold text-foreground font-display">
                    {handbook.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">{handbook.subtitle}</p>
                  <div className="pt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground font-mono tabular-nums">
                    <span>Teacher: {handbook.authorName}</span>
                    <span>·</span>
                    <span>{handbook.steps.length} Steps</span>
                    <span>·</span>
                    <span>{totalMinutes} mins</span>
                    <span>·</span>
                    <span>{config.copiesCount} copies</span>
                  </div>
                </div>
              )}

              {config.includeTableOfContents && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-foreground">
                    Step-by-Step Checklist
                  </div>
                  <div className="divide-y divide-border border border-border rounded-lg">
                    {handbook.steps.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between px-3 py-1.5 text-xs"
                      >
                        <span className="truncate pr-2 text-foreground">
                          <span className="font-mono text-muted-foreground mr-2">
                            {s.isRequiredForSignOff ? '[ ]' : ' · '}
                          </span>
                          Step {s.orderIndex}: {s.title}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground shrink-0 tabular-nums">
                          {s.durationMinutes}m
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {handbook.steps.map((step) => (
                  <div
                    key={step.id}
                    className="p-3.5 rounded-lg border border-border space-y-2 bg-background"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                        {step.orderIndex}
                      </span>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="text-xs font-bold text-foreground">
                          {step.type !== StepType.ACTION ? `[${step.type}] ` : ''}
                          {config.redactAllStudentPii
                            ? HandbookDomainPolicy.redactPiiPatterns(step.title)
                            : step.title}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {config.redactAllStudentPii
                            ? HandbookDomainPolicy.redactPiiPatterns(step.description)
                            : step.description}
                        </p>
                        {config.includeTeacherNotes && step.expectedStudentOutcome && (
                          <div className="text-[11px] text-foreground font-medium underline underline-offset-2">
                            Goal Check: {step.expectedStudentOutcome}
                          </div>
                        )}
                      </div>
                    </div>

                    {config.includeScreenshots && step.mockup && (
                      <div className="ml-0 sm:ml-8 p-2.5 rounded border border-border bg-muted/50 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="truncate">
                          <span className="font-semibold text-foreground">{step.mockup.appTitle}</span>
                          <span className="mx-1.5 text-muted-foreground">·</span>
                          <span className="font-mono text-muted-foreground">
                            Click Here: {step.annotation?.label || step.mockup.activeElementLabel}
                          </span>
                        </div>
                        {step.annotation && (
                          <span className="inline-flex items-center gap-1 font-mono text-foreground font-semibold shrink-0 tabular-nums">
                            <span className="w-2.5 h-2.5 rounded-full border-2 border-foreground inline-block" />
                            ({step.annotation.xPercent}%, {step.annotation.yPercent}%)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {config.includeStudentSignOffSheet && (
                <div className="pt-4 border-t-2 border-dashed border-border space-y-2 text-xs">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Student &amp; Teacher Completion Sign-Off Slip
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    I finished all {handbook.steps.length} steps in{' '}
                    <strong>{handbook.title}</strong> ({handbook.courseCode}).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-[11px] text-muted-foreground font-mono">
                    <div>Student Name: ______________________</div>
                    <div>Student ID: ________________________</div>
                    <div>Signature: _________________________</div>
                    <div>Date / Table #: ____________________</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetBody>

        <SheetFooter>
          <div className="flex items-center gap-2">
            {wizardStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWizardStep((prev) => prev - 1)}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Previous Step
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {wizardStep < 3 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setWizardStep((prev) => prev + 1)}
              >
                Next Step
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <>
                <Button type="button" variant="secondary" size="sm" onClick={handleBrowserPrint}>
                  <Printer className="w-4 h-4" />
                  Print on Paper
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!readinessCheck.ok || isExporting}
                  onClick={handleDownloadPdf}
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? 'Making PDF...' : 'Download Printable PDF'}
                </Button>
              </>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
