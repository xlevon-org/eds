import React, { useState } from 'react';
import { FitReport } from '../../infrastructure/api/UpApiClient';

/**
 * FitBadge — renders the content-fit verdict for an HTML preflight or PDF
 * verification report. Green = measured and inside the page box; amber = fits
 * but with warnings; red = error-level overflow; grey = not checked.
 */
export const FitBadge: React.FC<{ report?: FitReport | null; label?: string; compact?: boolean }> = ({
  report,
  label,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);

  if (!report) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
        {label ? `${label}: ` : ''}not checked
      </span>
    );
  }

  const errors = report.counts?.error ?? 0;
  const warnings = report.counts?.warning ?? 0;
  const tone = !report.checked
    ? 'border-border bg-secondary text-muted-foreground'
    : errors > 0
    ? 'border-red-300 bg-red-100 text-red-700'
    : warnings > 0
    ? 'border-amber-300 bg-amber-100 text-amber-800'
    : 'border-green-300 bg-green-100 text-green-700';

  const verdict = !report.checked
    ? 'skipped'
    : errors > 0
    ? `${errors} issue${errors === 1 ? '' : 's'}`
    : warnings > 0
    ? `fits · ${warnings} warning${warnings === 1 ? '' : 's'}`
    : 'fits';

  const clickable = Boolean(report.issues && report.issues.length);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        disabled={!clickable && !compact}
        onClick={() => clickable && setOpen((v) => !v)}
        title={report.reason || `${report.scope.toUpperCase()} fit via ${report.engine}`}
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${tone} ${
          clickable ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        {label ? <span className="opacity-70">{label}</span> : null}
        <span>✓ {verdict}</span>
      </button>
      {open && clickable ? (
        <div className="absolute right-0 top-6 z-20 w-80 rounded-md border border-border bg-background p-2 text-[11px] shadow-lg">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">
              {report.scope.toUpperCase()} fit report ({report.engine})
            </span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground">
              ✕
            </button>
          </div>
          <ul className="max-h-52 space-y-1 overflow-auto">
            {report.issues!.map((issue, index) => (
              <li
                key={`${issue.code}-${index}`}
                className={issue.severity === 'error' ? 'text-red-700' : 'text-amber-700'}
              >
                • <span className="font-medium">{issue.code}</span>: {issue.message}
              </li>
            ))}
          </ul>
          {report.metrics?.['pageCount'] ? (
            <p className="mt-1 text-muted-foreground">pages: {String(report.metrics['pageCount'])}</p>
          ) : null}
        </div>
      ) : null}
    </span>
  );
};
