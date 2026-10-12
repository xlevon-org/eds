import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ComponentNode,
  FitReport,
  SectionImageInstruction,
  Template,
  TemplateSection,
} from '../../infrastructure/api/UpApiClient';
import { useStudio } from './StudioContext';
import { FitBadge } from './FitBadge';

export const COMPONENT_TYPES = [
  'Heading',
  'Paragraph',
  'BulletList',
  'NumberedList',
  'CalloutBox',
  'GridContainer',
  'TableBlock',
  'MediaAssetBlock',
  'Toc',
  'CoverContainer',
  'ObjectiveList',
  'Glossary',
  'QuestionItem',
  'AnswerKey',
  'CodeBlock',
  'Divider',
  'Spacer',
  'PageBreak',
] as const;

const PUBLICATION_TYPES = [
  'HANDBOOK',
  'LEAFLET',
  'SHORT_NOTE',
  'QUESTION_PAPER',
  'WORKSHEET',
  'LESSON_PLAN',
  'SYLLABUS',
  'ASSESSMENT',
];

const PAGE_SIZES: Record<string, { widthMm: number; heightMm: number }> = {
  A4: { widthMm: 210, heightMm: 297 },
  A3: { widthMm: 297, heightMm: 420 },
  A5: { widthMm: 148, heightMm: 210 },
  LETTER: { widthMm: 215.9, heightMm: 279.4 },
  LEGAL: { widthMm: 215.9, heightMm: 355.6 },
};

export function defaultPropsFor(type: string): Record<string, unknown> {
  switch (type) {
    case 'Heading':
      return { text: 'Section heading', level: 2 };
    case 'Paragraph':
      return { text: '' };
    case 'BulletList':
    case 'NumberedList':
      return { items: [] };
    case 'CalloutBox':
      return { intent: 'info', title: 'Note', text: '' };
    case 'CoverContainer':
      return { title: '', subtitle: '', meta: '' };
    case 'MediaAssetBlock':
      return { alt: 'Illustration', caption: '' };
    case 'ObjectiveList':
      return { title: 'Learning objectives', items: [] };
    case 'Glossary':
      return { title: 'Keywords', items: [] };
    case 'QuestionItem':
      return { number: 'Q1', text: '' };
    case 'AnswerKey':
      return { title: 'Answer key', items: [] };
    case 'TableBlock':
      return { headers: ['Item', 'Description'], rows: [] };
    case 'Toc':
      return { title: 'Table of contents', items: [] };
    case 'Spacer':
      return { heightPx: 16 };
    case 'CodeBlock':
      return { code: '' };
    default:
      return {};
  }
}

export function newComponent(type: string): ComponentNode {
  return { id: crypto.randomUUID(), type, props: defaultPropsFor(type) };
}

export function newSection(name = 'New section'): TemplateSection {
  return {
    id: crypto.randomUUID(),
    name,
    layoutType: 'standard',
    aiInstruction: '',
    components: [newComponent('Heading'), newComponent('Paragraph')],
  };
}

export function starterTemplate(): Partial<Template> {
  return {
    name: 'Untitled handbook',
    description: '',
    formatType: 'BOTH',
    publicationType: 'HANDBOOK',
    pageSize: 'A4',
    geometry: {
      preset: 'A4',
      widthMm: 210,
      heightMm: 297,
      orientation: 'portrait',
      marginsMm: { top: 20, right: 18, bottom: 20, left: 18 },
    },
    designTokens: {
      palette: { primary: '#1f6feb', text: '#1f2328', surface: '#f6f8fa' },
      typography: { baseFontPt: 11, lineHeight: 1.5 },
    },
    documentDefaults: { tocIncludeLevels: [1, 2, 3] },
    sections: [
      { id: crypto.randomUUID(), name: 'Cover', layoutType: 'cover', components: [newComponent('CoverContainer')] },
      { id: crypto.randomUUID(), name: 'Table of contents', layoutType: 'toc', components: [newComponent('Toc')] },
      newSection('Introduction'),
    ],
  };
}

interface Props {
  template: Template;
  onSave: (template: Template) => Promise<void>;
  onBack: () => void;
}

export const TemplateBuilderView: React.FC<Props> = ({ template, onSave, onBack }) => {
  const { api } = useStudio();
  const [draft, setDraft] = useState<Template>(template);
  const [variant, setVariant] = useState<'STUDENT' | 'INSTRUCTOR'>('STUDENT');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFit, setPreviewFit] = useState<FitReport | null>(null);
  const [pdfFit, setPdfFit] = useState<FitReport | null>(null);
  const [fitBusy, setFitBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(template);
  }, [template]);

  // Live preview: debounce a render of the (possibly unsaved) draft. The worker
  // also returns a fit preflight so overflow is visible while editing.
  useEffect(() => {
    const handle = setTimeout(async () => {
      try {
        const { html, fit } = await api.previewTemplate(draft, variant);
        setPreviewHtml(html);
        setPreviewFit(fit || null);
        setPdfFit(null);
        setPreviewError(null);
      } catch (error) {
        setPreviewError((error as Error).message);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [draft, variant, api]);

  const verifyPdfFit = async () => {
    setFitBusy(true);
    try {
      const { fit } = await api.previewFit(draft, 'pdf', variant);
      setPdfFit(fit.pdf || null);
      setPreviewError(null);
    } catch (error) {
      setPreviewError((error as Error).message);
    } finally {
      setFitBusy(false);
    }
  };

  const update = useCallback((patch: Partial<Template>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateSection = useCallback((sectionId: string, patch: Partial<TemplateSection>) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
    }));
  }, []);

  const moveSection = (index: number, delta: number) => {
    setDraft((prev) => {
      const sections = [...prev.sections];
      const target = index + delta;
      if (target < 0 || target >= sections.length) return prev;
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...prev, sections };
    });
  };

  const removeSection = (sectionId: string) => {
    setDraft((prev) => ({ ...prev, sections: prev.sections.filter((s) => s.id !== sectionId) }));
  };

  const addSection = () => setDraft((prev) => ({ ...prev, sections: [...prev.sections, newSection()] }));

  const setGeometry = (patch: Partial<NonNullable<Template['geometry']>>) =>
    setDraft((prev) => ({ ...prev, geometry: { ...prev.geometry, ...patch } }));

  const setMargins = (patch: Partial<NonNullable<NonNullable<Template['geometry']>['marginsMm']>>) =>
    setDraft((prev) => ({
      ...prev,
      geometry: { ...prev.geometry, marginsMm: { ...prev.geometry?.marginsMm, ...patch } },
    }));

  const setPalette = (key: string, value: string) =>
    setDraft((prev) => ({
      ...prev,
      designTokens: { ...prev.designTokens, palette: { ...prev.designTokens?.palette, [key]: value } },
    }));

  const setTypography = (key: string, value: string | number) =>
    setDraft((prev) => ({
      ...prev,
      designTokens: { ...prev.designTokens, typography: { ...prev.designTokens?.typography, [key]: value } },
    }));

  const applyPageSize = (preset: string) => {
    const size = PAGE_SIZES[preset];
    setDraft((prev) => ({
      ...prev,
      pageSize: preset,
      geometry: { ...prev.geometry, preset, ...(size || {}) },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setProblems([]);
    try {
      const validation = await api.validateTemplate(draft);
      if (!validation.valid) {
        setProblems(validation.problems);
        return;
      }
      await onSave(draft);
    } catch (error) {
      setProblems([(error as Error).message]);
    } finally {
      setSaving(false);
    }
  };

  // Debounced autosave so the preview and DB stay in step.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        const validation = await api.validateTemplate(draft).catch(() => null);
        if (validation?.valid) await onSave(draft).catch(() => undefined);
      })();
    }, 2500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const palette = draft.designTokens?.palette || {};
  const typography = draft.designTokens?.typography || {};

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
      {/* Editor column */}
      <div className="space-y-4 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <button onClick={onBack} className="text-xs text-muted-foreground underline">
            ← Templates
          </button>
          <div className="flex items-center gap-2">
            {problems.length > 0 && (
              <span className="text-xs text-red-600">{problems.length} problem(s)</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </div>

        {problems.length > 0 && (
          <ul className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700 space-y-1">
            {problems.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
        )}

        <section className="rounded-lg border border-border bg-card p-3 space-y-3">
          <h3 className="text-sm font-semibold">Document</h3>
          <Field label="Name">
            <input className={inputCls} value={draft.name} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field label="Description">
            <input
              className={inputCls}
              value={draft.description || ''}
              onChange={(e) => update({ description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Output">
              <select
                className={inputCls}
                value={draft.formatType || 'BOTH'}
                onChange={(e) => update({ formatType: e.target.value })}
              >
                <option value="BOTH">Both</option>
                <option value="PDF_PRINT">PDF</option>
                <option value="RESPONSIVE_HTML">HTML</option>
              </select>
            </Field>
            <Field label="Publication">
              <select
                className={inputCls}
                value={draft.publicationType || 'HANDBOOK'}
                onChange={(e) => update({ publicationType: e.target.value })}
              >
                {PUBLICATION_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Page size">
              <select
                className={inputCls}
                value={draft.pageSize || 'A4'}
                onChange={(e) => applyPageSize(e.target.value)}
              >
                {Object.keys(PAGE_SIZES).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value="CUSTOM">CUSTOM</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-3 space-y-3">
          <h3 className="text-sm font-semibold">Page geometry</h3>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Width (mm)">
              <input
                type="number"
                className={inputCls}
                value={draft.geometry?.widthMm ?? 210}
                onChange={(e) => setGeometry({ widthMm: Number(e.target.value) })}
              />
            </Field>
            <Field label="Height (mm)">
              <input
                type="number"
                className={inputCls}
                value={draft.geometry?.heightMm ?? 297}
                onChange={(e) => setGeometry({ heightMm: Number(e.target.value) })}
              />
            </Field>
            <Field label="Orientation">
              <select
                className={inputCls}
                value={draft.geometry?.orientation || 'portrait'}
                onChange={(e) => setGeometry({ orientation: e.target.value })}
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
              <Field key={side} label={`Margin ${side}`}>
                <input
                  type="number"
                  className={inputCls}
                  value={draft.geometry?.marginsMm?.[side] ?? 18}
                  onChange={(e) => setMargins({ [side]: Number(e.target.value) })}
                />
              </Field>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-3 space-y-3">
          <h3 className="text-sm font-semibold">Design tokens</h3>
          <div className="grid grid-cols-3 gap-2">
            {(['primary', 'text', 'surface'] as const).map((key) => (
              <Field key={key} label={key}>
                <input
                  type="color"
                  className="h-8 w-full rounded border border-border bg-background"
                  value={(palette[key] as string) || '#000000'}
                  onChange={(e) => setPalette(key, e.target.value)}
                />
              </Field>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Base font (pt)">
              <input
                type="number"
                step="0.5"
                className={inputCls}
                value={Number(typography.baseFontPt ?? 11)}
                onChange={(e) => setTypography('baseFontPt', Number(e.target.value))}
              />
            </Field>
            <Field label="Line height">
              <input
                type="number"
                step="0.05"
                className={inputCls}
                value={Number(typography.lineHeight ?? 1.5)}
                onChange={(e) => setTypography('lineHeight', Number(e.target.value))}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Sections ({draft.sections.length})</h3>
            <button onClick={addSection} className="rounded-md border border-border px-2 py-1 text-xs">
              + Add section
            </button>
          </div>
          {draft.sections.map((section, index) => (
            <SectionEditor
              key={section.id}
              section={section}
              index={index}
              total={draft.sections.length}
              onChange={(patch) => updateSection(section.id, patch)}
              onMove={(delta) => moveSection(index, delta)}
              onRemove={() => removeSection(section.id)}
            />
          ))}
        </section>
      </div>

      {/* Preview column */}
      <div className="min-w-0">
        <div className="sticky top-2 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Live preview</h3>
            <div className="flex items-center gap-2">
              <FitBadge report={previewFit} label="fit" />
              {pdfFit ? <FitBadge report={pdfFit} label="pdf" /> : null}
              <button
                onClick={verifyPdfFit}
                disabled={fitBusy}
                className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
                title="Render a PDF and verify page size, margins and overflow"
              >
                {fitBusy ? 'Verifying…' : 'Verify PDF fit'}
              </button>
              <select
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                value={variant}
                onChange={(e) => setVariant(e.target.value as 'STUDENT' | 'INSTRUCTOR')}
              >
                <option value="STUDENT">Student</option>
                <option value="INSTRUCTOR">Instructor</option>
              </select>
            </div>
          </div>
          {previewError ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              Preview: {previewError}
            </div>
          ) : null}
          <iframe
            title="preview"
            className="w-full h-[80vh] rounded-lg border border-border bg-white"
            srcDoc={previewHtml || '<p style="font-family:sans-serif;padding:16px">Preview loading…</p>'}
          />
        </div>
      </div>
    </div>
  );
};

const inputCls =
  'mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block text-xs">
    <span className="text-muted-foreground capitalize">{label}</span>
    {children}
  </label>
);

interface SectionEditorProps {
  section: TemplateSection;
  index: number;
  total: number;
  onChange: (patch: Partial<TemplateSection>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

const SectionEditor: React.FC<SectionEditorProps> = ({ section, index, total, onChange, onMove, onRemove }) => {
  const imageInstruction: SectionImageInstruction = section.imageInstruction || {};

  const patchComponent = (componentId: string, patch: Partial<ComponentNode>) => {
    onChange({
      components: section.components.map((c) => (c.id === componentId ? { ...c, ...patch } : c)),
    });
  };

  const setProps = (componentId: string, props: Record<string, unknown>) => {
    onChange({
      components: section.components.map((c) => (c.id === componentId ? { ...c, props: { ...c.props, ...props } } : c)),
    });
  };

  const addComponent = (type: string) =>
    onChange({ components: [...section.components, newComponent(type)] });

  const removeComponent = (id: string) => onChange({ components: section.components.filter((c) => c.id !== id) });

  const moveComponent = (i: number, delta: number) => {
    const next = [...section.components];
    const target = i + delta;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    onChange({ components: next });
  };

  return (
    <div className="rounded-md border border-border p-2 space-y-2 bg-background">
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
        <input
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
          value={section.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <button className="px-1 text-xs" disabled={index === 0} onClick={() => onMove(-1)}>
          ↑
        </button>
        <button className="px-1 text-xs" disabled={index === total - 1} onClick={() => onMove(1)}>
          ↓
        </button>
        <button className="px-1 text-xs text-red-600" onClick={onRemove}>
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Layout">
          <select
            className={inputCls}
            value={section.layoutType || 'standard'}
            onChange={(e) => onChange({ layoutType: e.target.value })}
          >
            {['standard', 'cover', 'toc', 'two-column', 'full-bleed'].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Break after">
          <select
            className={inputCls}
            value={section.pageRules?.pageBreakAfter ? 'yes' : 'no'}
            onChange={(e) => onChange({ pageRules: { pageBreakAfter: e.target.value === 'yes' } })}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
      </div>

      <Field label="AI instruction (per-section)">
        <textarea
          rows={2}
          className={inputCls}
          value={section.aiInstruction || ''}
          onChange={(e) => onChange({ aiInstruction: e.target.value })}
          placeholder="Explain this section for the target grade…"
        />
      </Field>

      <div className="rounded border border-dashed border-border p-2 space-y-1">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={Boolean(imageInstruction.enabled)}
            onChange={(e) =>
              onChange({ imageInstruction: { ...imageInstruction, enabled: e.target.checked } })
            }
          />
          Image generation for this section
        </label>
        {imageInstruction.enabled && (
          <input
            className={inputCls}
            placeholder="Image prompt template"
            value={imageInstruction.promptTemplate || ''}
            onChange={(e) =>
              onChange({ imageInstruction: { ...imageInstruction, promptTemplate: e.target.value } })
            }
          />
        )}
      </div>

      <div className="space-y-2">
        {section.components.map((component, i) => (
          <div key={component.id} className="rounded border border-border p-2 space-y-1">
            <div className="flex items-center gap-1">
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium">{component.type}</span>
              <div className="flex-1" />
              <button className="px-1 text-xs" disabled={i === 0} onClick={() => moveComponent(i, -1)}>
                ↑
              </button>
              <button
                className="px-1 text-xs"
                disabled={i === section.components.length - 1}
                onClick={() => moveComponent(i, 1)}
              >
                ↓
              </button>
              <button className="px-1 text-xs text-red-600" onClick={() => removeComponent(component.id)}>
                ✕
              </button>
            </div>
            <PropsEditor
              component={component}
              onProps={(props) => setProps(component.id, props)}
              onAiInstruction={(v) => patchComponent(component.id, { aiInstruction: v })}
            />
          </div>
        ))}
        <div className="flex items-center gap-2">
          <select
            className="rounded border border-border bg-background px-2 py-1 text-xs"
            value=""
            onChange={(e) => {
              if (e.target.value) addComponent(e.target.value);
            }}
          >
            <option value="">+ Add component…</option>
            {COMPONENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

const PropsEditor: React.FC<{
  component: ComponentNode;
  onProps: (props: Record<string, unknown>) => void;
  onAiInstruction: (value: string) => void;
}> = ({ component, onProps, onAiInstruction }) => {
  const props = component.props || {};
  const type = component.type;

  const text = (key: string) => (
    <input
      className={inputCls}
      value={String(props[key] ?? '')}
      onChange={(e) => onProps({ [key]: e.target.value })}
    />
  );

  const listEditor = (key: string, placeholder: string) => (
    <textarea
      rows={2}
      className={inputCls}
      placeholder={placeholder}
      value={Array.isArray(props[key]) ? (props[key] as string[]).join('\n') : ''}
      onChange={(e) => onProps({ [key]: e.target.value.split('\n').filter(Boolean) })}
    />
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      {type === 'Heading' && (
        <>
          <Field label="Text">{text('text')}</Field>
          <Field label="Level">
            <select className={inputCls} value={String(props.level ?? 2)} onChange={(e) => onProps({ level: Number(e.target.value) })}>
              {[1, 2, 3, 4].map((l) => (
                <option key={l} value={l}>
                  H{l}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}
      {(type === 'Paragraph' || type === 'CalloutBox') && <Field label="Text">{text('text')}</Field>}
      {type === 'CalloutBox' && (
        <>
          <Field label="Title">{text('title')}</Field>
          <Field label="Intent">
            <select className={inputCls} value={String(props.intent ?? 'info')} onChange={(e) => onProps({ intent: e.target.value })}>
              {['info', 'tip', 'warning', 'definition', 'danger'].map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}
      {(type === 'BulletList' || type === 'NumberedList') && (
        <Field label="Items (one per line)">{listEditor('items', 'Item one\nItem two')}</Field>
      )}
      {type === 'ObjectiveList' && (
        <>
          <Field label="Title">{text('title')}</Field>
          <Field label="Objectives">{listEditor('items', 'Objective one')}</Field>
        </>
      )}
      {type === 'AnswerKey' && (
        <>
          <Field label="Title">{text('title')}</Field>
          <Field label="Answers">{listEditor('items', 'Answer one')}</Field>
        </>
      )}
      {type === 'MediaAssetBlock' && (
        <>
          <Field label="Alt text">{text('alt')}</Field>
          <Field label="Caption">{text('caption')}</Field>
        </>
      )}
      {type === 'CoverContainer' && (
        <>
          <Field label="Title">{text('title')}</Field>
          <Field label="Subtitle">{text('subtitle')}</Field>
        </>
      )}
      {type === 'Toc' && <Field label="Title">{text('title')}</Field>}
      {type === 'QuestionItem' && (
        <>
          <Field label="Number">{text('number')}</Field>
          <Field label="Question">{text('text')}</Field>
        </>
      )}
      {type === 'TableBlock' && (
        <>
          <Field label="Headers (comma)">
            <input
              className={inputCls}
              value={Array.isArray(props.headers) ? (props.headers as string[]).join(', ') : ''}
              onChange={(e) => onProps({ headers: e.target.value.split(',').map((s) => s.trim()) })}
            />
          </Field>
          <Field label="Rows (cells | separated, one row per line)">
            <textarea
              rows={2}
              className={inputCls}
              value={Array.isArray(props.rows) ? (props.rows as string[][]).map((r) => r.join(' | ')).join('\n') : ''}
              onChange={(e) =>
                onProps({
                  rows: e.target.value
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => line.split('|').map((c) => c.trim())),
                })
              }
            />
          </Field>
        </>
      )}
      {type === 'Spacer' && (
        <Field label="Height (px)">
          <input
            type="number"
            className={inputCls}
            value={Number(props.heightPx ?? 16)}
            onChange={(e) => onProps({ heightPx: Number(e.target.value) })}
          />
        </Field>
      )}
      {type === 'CodeBlock' && (
        <Field label="Code">
          <textarea rows={2} className={inputCls} value={String(props.code ?? '')} onChange={(e) => onProps({ code: e.target.value })} />
        </Field>
      )}
      {(type === 'Divider' || type === 'PageBreak') && (
        <p className="col-span-2 text-[11px] text-muted-foreground">No properties.</p>
      )}
      <div className="col-span-2">
        <Field label="Component AI instruction">
          <input
            className={inputCls}
            value={component.aiInstruction || ''}
            onChange={(e) => onAiInstruction(e.target.value)}
            placeholder="Overrides the section instruction for this block"
          />
        </Field>
      </div>
    </div>
  );
};
