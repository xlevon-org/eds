import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface WizardStepItem {
  readonly stepNumber: number;
  readonly title: string;
  readonly subtitle?: string;
}

interface WizardStepperProps {
  steps: ReadonlyArray<WizardStepItem>;
  currentStep: number;
  onStepSelect?: (stepNumber: number) => void;
  className?: string;
}

export const WizardStepper: React.FC<WizardStepperProps> = ({
  steps,
  currentStep,
  onStepSelect,
  className,
}) => {
  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 rounded-xl border border-border bg-muted/40',
        className
      )}
    >
      {steps.map((item) => {
        const isActive = item.stepNumber === currentStep;
        const isCompleted = item.stepNumber < currentStep;

        return (
          <button
            key={item.stepNumber}
            type="button"
            onClick={() => onStepSelect?.(item.stepNumber)}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer',
              isActive
                ? 'bg-background text-foreground shadow-xs border border-border'
                : isCompleted
                ? 'text-foreground hover:bg-background/60'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span
              className={cn(
                'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 tabular-nums border transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : isCompleted
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-muted-foreground border-border'
              )}
            >
              {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : item.stepNumber}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">{item.title}</div>
              {item.subtitle && (
                <div className="text-[11px] text-muted-foreground truncate">
                  {item.subtitle}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
