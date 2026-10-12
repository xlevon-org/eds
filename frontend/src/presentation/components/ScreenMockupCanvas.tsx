import React from 'react';
import { ClickTargetAnnotation, ScreenMockupState } from '../../domain/entities/Handbook';
import { Globe, Lock, ShieldCheck, Crosshair } from 'lucide-react';

interface ScreenMockupCanvasProps {
  mockup: ScreenMockupState;
  annotation?: ClickTargetAnnotation;
  interactive?: boolean;
  onRepositionClickTarget?: (xPercent: number, yPercent: number) => void;
}

export const ScreenMockupCanvas: React.FC<ScreenMockupCanvasProps> = ({
  mockup,
  annotation,
  interactive = false,
  onRepositionClickTarget,
}) => {
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !onRepositionClickTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    onRepositionClickTarget(xPercent, yPercent);
  };

  const renderDomainScreenContent = () => {
    switch (mockup.screenTheme) {
      case 'lab-simulator':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 sm:p-4 bg-card text-card-foreground min-h-[176px] text-xs">
            <div className="sm:col-span-5 flex flex-col justify-between border border-border rounded-md p-3 bg-muted/60">
              <div>
                <div className="text-[11px] text-muted-foreground">Live Science Sensor</div>
                <div className="text-lg sm:text-xl font-mono font-bold text-foreground tabular-nums mt-1">
                  pH 7.02 · 22.4 °C
                </div>
              </div>
              <div className="space-y-1 text-[11px] text-muted-foreground font-mono tabular-nums mt-2">
                <div>Liquid Volume: 14.25 mL</div>
                <div>Sensor Status: Ready</div>
              </div>
            </div>
            <div className="sm:col-span-7 flex flex-col justify-between border border-border rounded-md p-3 bg-background">
              <div className="flex items-center justify-between border-b border-border pb-2 gap-2">
                <span className="font-semibold text-foreground truncate">{mockup.activeElementLabel}</span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {mockup.redactedPii ? 'Table: HIDDEN' : 'Table: #04'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 my-2">
                <div className="px-2.5 py-2 rounded bg-primary text-primary-foreground font-medium text-center truncate">
                  Setup Sensor
                </div>
                <div className="px-2.5 py-2 rounded border border-border text-foreground text-center truncate">
                  Save Number (mL)
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Tap or click anywhere on this picture to move the target circle
              </div>
            </div>
          </div>
        );

      case 'git-terminal':
        return (
          <div className="p-3 sm:p-4 bg-card text-card-foreground font-mono text-xs min-h-[176px] flex flex-col justify-between">
            <div className="space-y-1.5 break-all sm:break-normal">
              <div className="text-muted-foreground">
                $ open project/coding-lesson-
                {mockup.redactedPii ? 'student-hidden' : 'alex'}.zip
              </div>
              <div className="text-foreground font-semibold">
                ✓ Opened coding project folder
              </div>
              <div className="text-muted-foreground">$ run test-checker</div>
              <div className="text-foreground font-bold underline underline-offset-4">
                [PASS] 14 of 14 Checks Passed — {mockup.activeElementLabel}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground mt-2">
              <span>Folder: main</span>
              <span className="truncate ml-2">Target: {annotation?.label || mockup.activeElementLabel}</span>
            </div>
          </div>
        );

      case 'chromebook-os':
        return (
          <div className="p-3 sm:p-4 bg-muted/50 text-foreground min-h-[176px] flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>School Laptop Test Mode</span>
              <span className="font-mono tabular-nums">Battery: 98% · Wi-Fi: OK</span>
            </div>
            <div className="mx-auto max-w-xs w-full bg-card border border-border rounded-lg p-3 text-center space-y-1">
              <div className="text-xs font-bold text-foreground">{mockup.activeElementLabel}</div>
              <div className="text-[11px] text-muted-foreground">
                Ready for Class Quiz · {mockup.redactedPii ? 'Student Name Hidden' : 'Name Visible'}
              </div>
            </div>
            <div className="flex items-center justify-between bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs">
              <span className="font-semibold">Apps (Open Test Mode)</span>
              <span className="font-mono text-[11px] opacity-80">Sign Out</span>
            </div>
          </div>
        );

      case 'iep-portal':
        return (
          <div className="p-3 sm:p-4 bg-card text-card-foreground min-h-[176px] flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between border-b border-border pb-2 gap-2">
              <span className="text-xs font-semibold text-foreground truncate">
                Reading Helper · Extra Time (1.5x)
              </span>
              <span className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[11px] font-medium shrink-0">
                {mockup.activeElementLabel}
              </span>
            </div>
            <div className="p-3 bg-muted/50 border border-border rounded-md">
              <p className="text-xs leading-relaxed text-foreground font-medium">
                Reading Ruler Active: Read each science question step by step before picking your answer.
              </p>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Student: {mockup.redactedPii ? '[NAME HIDDEN]' : 'Student #402'}</span>
              <span>Voice Speed: 1.0x Normal</span>
            </div>
          </div>
        );

      case 'lms-canvas':
      default:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 sm:p-4 bg-muted/30 text-foreground min-h-[176px] text-xs">
            <div className="sm:col-span-3 border-b sm:border-b-0 sm:border-r border-border pb-2 sm:pb-0 sm:pr-2 flex sm:flex-col justify-between sm:justify-start gap-2 text-[11px] text-muted-foreground">
              <div className="font-bold text-foreground">Class Menu</div>
              <div>Lessons</div>
              <div className="text-foreground font-semibold underline underline-offset-4">Homework</div>
              <div className="hidden sm:block">Grades</div>
              <div className="font-mono">
                {mockup.redactedPii ? 'Student: [HIDDEN]' : 'Student: Alex'}
              </div>
            </div>
            <div className="sm:col-span-9 flex flex-col justify-between bg-card border border-border rounded-md p-3 gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-foreground text-xs">
                    Homework Turn-In Box
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    File Type: PDF · Checklist Included
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium text-xs">
                  {mockup.activeElementLabel}
                </span>
              </div>
              <div className="border border-dashed border-border rounded p-2.5 text-center text-[11px] text-muted-foreground bg-muted/40">
                Drop your finished PDF file here or click Choose File
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card select-none">
      {/* Captured Screen Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-muted border-b border-border text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="font-semibold text-foreground truncate">{mockup.appTitle}</span>
          <span className="text-muted-foreground hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-[11px] text-muted-foreground truncate hidden sm:flex items-center gap-1">
            <Lock className="w-3 h-3 text-foreground shrink-0" />
            {mockup.urlBar}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground">
          {mockup.redactedPii && (
            <span className="inline-flex items-center gap-1 text-foreground font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Student Info Hidden</span>
            </span>
          )}
          <span className="font-mono tabular-nums">Zoom {mockup.zoomScale.toFixed(2)}x</span>
        </div>
      </div>

      {/* Interactive Screen Capture Canvas */}
      <div
        onClick={handleCanvasClick}
        title={
          interactive
            ? 'Click or tap anywhere on this picture to move the target circle'
            : undefined
        }
        className={`relative overflow-hidden ${
          interactive ? 'cursor-crosshair' : 'cursor-default'
        }`}
      >
        {renderDomainScreenContent()}

        {/* High-Contrast Monochrome Click Target Callout Ring (Pure SVG Coordinate Overlay, Zero Inline Styles) */}
        {annotation && (
          <>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 w-full h-full z-10"
              aria-hidden="true"
            >
              <circle
                cx={annotation.xPercent}
                cy={annotation.yPercent}
                r="4.5"
                className="fill-background/80 stroke-foreground"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={annotation.xPercent}
                cy={annotation.yPercent}
                r="1.5"
                className="fill-foreground"
              />
            </svg>
            <div className="pointer-events-none absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-foreground text-background text-[10px] font-semibold whitespace-nowrap shadow-xs border border-background font-mono tabular-nums">
              Target: {annotation.label} ({annotation.xPercent}%, {annotation.yPercent}%)
            </div>
          </>
        )}

        {interactive && (
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-foreground text-background text-[10px] font-medium flex items-center gap-1 pointer-events-none">
            <Crosshair className="w-3 h-3" />
            Tap picture to move target circle
          </div>
        )}
      </div>
    </div>
  );
};
