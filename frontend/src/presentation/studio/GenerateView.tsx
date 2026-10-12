import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ComponentNode,
  DocumentRecord,
  JobProgressEvent,
  KbChunk,
  Template,
  TemplateSection,
} from '../../infrastructure/api/UpApiClient';
import { useStudio } from './StudioContext';
import { FitBadge } from './FitBadge';

interface StageLine {
  stage: string;
  pct: number;
  message: string;
}

function findComponent(sections: TemplateSection[], componentId: string): { section: TemplateSection; node: ComponentNode } | null {
  for (const section of sections) {
    const stack = [...(section.components || [])];
    while (stack.length) {
      const node = stack.shift() as ComponentNode;
      if (node.id === componentId) return { section, node };
      if (Array.isArray(node.children)) stack.push(...node.children);
    }
  }
  return null;
}

function summarise(node: ComponentNode): string {
  const props = node.props || {};
  const text = (props.text as string) || (props.title as string) || (props.code as string) || '';
  if (Array.isArray(props.items) && props.items.length) {
    const first = props.items[0];
    return typeof first === 'string' ? first : JSON.stringify(first).slice(0, 60);
  }
  return text.slice(0, 70) || '—';
}

export const GenerateView: React.FC<{ initialDocumentId?: string }> = ({ initialDocumentId }) => {
  const { api, setError, setNotice } = useStudio();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [variant, setVariant] = useState<'STUDENT' | 'INSTRUCTOR'>('STUDENT');
  const [instruction, setInstruction] = useState('Create a clear, grade-appropriate handbook.');
  const [materialsText, setMaterialsText] = useState('');
  const [chunks, setChunks] = useState<KbChunk[]>([]);
  const [selectedChunkIds, setSelectedChunkIds] = useState<string[]>([]);

  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<StageLine[]>([]);
  const [jobPct, setJobPct] = useState(0);
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [revisions, setRevisions] = useState<Array<{ id: string; versionNum: number; changelog: string }>>([]);

  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [fitBusy, setFitBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const list = await api.listTemplates();
        setTemplates(list);
        if (list.length && !templateId) setTemplateId(list[0].id);
        const kb = await api.listKbChunks();
        setChunks(kb.slice(0, 50));
      } catch (error) {
        setError((error as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const loadDocument = useCallback(
    async (id: string) => {
      const doc = await api.getDocument(id);
      setDocument(doc);
      if (doc.content?.sections) {
        const { html } = await api.renderDocument(id);
        setPreviewHtml(html);
      }
      setRevisions(await api.listRevisions(id));
    },
    [api]
  );

  useEffect(() => {
    if (initialDocumentId) {
      void loadDocument(initialDocumentId).catch((error) => setError((error as Error).message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDocumentId]);

  const generate = async () => {
    if (!templateId) {
      setError('Select a template first.');
      return;
    }
    setRunning(true);
    setStages([]);
    setJobPct(0);
    setDocument(null);
    setPreviewHtml('');
    setError(null);
    try {
      const materials = materialsText.trim()
        ? [{ name: 'pasted-material', type: 'text', text: materialsText }]
        : [];
      const { jobId, documentId } = await api.generate({
        templateId,
        variant,
        instruction,
        materials,
        kbChunkIds: selectedChunkIds,
      });
      setNotice('Generation started.');
      await new Promise<void>((resolve) => {
        const stop = api.trackJob(jobId, (event: JobProgressEvent) => {
          if (event.type === 'progress') {
            setJobPct(event.pct || 0);
            const stageName = event.stage;
            const stagePct = event.pct || 0;
            const stageMsg = event.message || '';
            if (stageName) {
              setStages((prev) =>
                prev.some((s) => s.stage === stageName)
                  ? prev
                  : [...prev, { stage: stageName, pct: stagePct, message: stageMsg }]
              );
            }
          } else if (event.type === 'done') {
            setJobPct(100);
            stop();
            resolve();
          } else if (event.type === 'error') {
            setError(event.message || 'Generation failed.');
            stop();
            resolve();
          }
        });
      });
      await loadDocument(documentId);
      setNotice('Generation completed.');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const sections = useMemo(() => document?.content?.sections || [], [document]);

  const selectComponent = (node: ComponentNode) => {
    setSelectedComponentId(node.id);
    const props = node.props || {};
    if (Array.isArray(props.items)) {
      const first = props.items[0];
      setDraftText(typeof first === 'string' ? props.items.join('\n') : JSON.stringify(props.items, null, 2));
    } else {
      setDraftText(String(props.text ?? props.code ?? props.title ?? ''));
    }
  };

  const applyEdit = async () => {
    if (!document || !selectedComponentId) return;
    const found = findComponent(sections, selectedComponentId);
    if (!found) return;
    const props = found.node.props || {};
    setEditBusy(true);
    try {
      const patch = Array.isArray(props.items)
        ? { items: draftText.split('\n').filter(Boolean) }
        : { text: draftText };
      await api.editBlock(document.id, {
        sectionId: found.section.id,
        componentId: selectedComponentId,
        props: patch,
      });
      await loadDocument(document.id);
      setNotice('Block updated.');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setEditBusy(false);
    }
  };

  const saveRevision = async () => {
    if (!document) return;
    try {
      const result = await api.createRevision(document.id, 'manual save');
      setNotice(`Revision saved (next version ${result.revision}).`);
      setRevisions(await api.listRevisions(document.id));
    } catch (error) {
      setError((error as Error).message);
    }
  };

  const rollback = async (revisionId: string) => {
    if (!document) return;
    try {
      await api.rollback(document.id, revisionId);
      await loadDocument(document.id);
      setNotice('Rolled back.');
    } catch (error) {
      setError((error as Error).message);
    }
  };

  const runFitCheck = async () => {
    if (!document) return;
    setFitBusy(true);
    try {
      const result = await api.fitCheck(document.id, 'both');
      setDocument(result.document);
      const fit = result.fit;
      const errors = (fit.html?.counts?.error || 0) + (fit.pdf?.counts?.error || 0);
      setNotice(errors ? `Fit check: ${errors} issue(s) found.` : 'Fit check: content fits the page.');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setFitBusy(false);
    }
  };

  const download = async (format: 'html' | 'pdf') => {
    if (!document) return;
    try {
      const blob = format === 'pdf' ? await api.renderDocumentPdf(document.id) : new Blob([previewHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.title || 'document'}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setError((error as Error).message);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
      {/* Prompt / controls */}
      <div className="space-y-3 min-w-0">
        <h2 className="text-lg font-semibold">Generate</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs">
            <span className="text-muted-foreground">Template</span>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Select a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Variant</span>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              value={variant}
              onChange={(e) => setVariant(e.target.value as 'STUDENT' | 'INSTRUCTOR')}
            >
              <option value="STUDENT">Student</option>
              <option value="INSTRUCTOR">Instructor</option>
            </select>
          </label>
        </div>

        <label className="block text-xs">
          <span className="text-muted-foreground">Instruction</span>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
        </label>

        <label className="block text-xs">
          <span className="text-muted-foreground">Paste material (optional)</span>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            value={materialsText}
            onChange={(e) => setMaterialsText(e.target.value)}
            placeholder="Paste source text to ground generation…"
          />
        </label>

        {chunks.length > 0 && (
          <div className="rounded-md border border-border p-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Knowledge base chunks to include</p>
            <div className="max-h-28 space-y-1 overflow-auto">
              {chunks.map((chunk) => (
                <label key={chunk.id} className="flex items-start gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={selectedChunkIds.includes(chunk.id)}
                    onChange={(e) =>
                      setSelectedChunkIds((prev) =>
                        e.target.checked ? [...prev, chunk.id] : prev.filter((id) => id !== chunk.id)
                      )
                    }
                  />
                  <span className="line-clamp-2">{chunk.content.slice(0, 90)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={generate}
          disabled={running || !templateId}
          className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {running ? `Generating… ${jobPct}%` : 'Generate document'}
        </button>

        {stages.length > 0 && (
          <div className="rounded-md border border-border bg-card p-2">
            <div className="mb-1 h-1.5 w-full overflow-hidden rounded bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${jobPct}%` }} />
            </div>
            <ul className="space-y-0.5 text-[11px] text-muted-foreground">
              {stages.map((s) => (
                <li key={s.stage}>
                  ✓ <span className="font-medium text-foreground">{s.stage}</span> — {s.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {document && (
          <div className="space-y-2 rounded-md border border-border bg-card p-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Document</h3>
              <span className="text-[11px] text-muted-foreground">
                {document.status} · v{document.revision} · {sections.length} sections
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <FitBadge report={document.fidelity?.fit?.html} label="html fit" />
              <FitBadge report={document.fidelity?.fit?.pdf} label="pdf fit" />
              <button
                onClick={runFitCheck}
                disabled={fitBusy}
                className="rounded-md border border-border px-2.5 py-1 text-xs disabled:opacity-50"
                title="Measure the stored content against the page box (HTML + PDF)"
              >
                {fitBusy ? 'Checking fit…' : 'Fit check'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => download('html')} className="rounded-md border border-border px-2.5 py-1 text-xs">
                Download HTML
              </button>
              <button onClick={() => download('pdf')} className="rounded-md border border-border px-2.5 py-1 text-xs">
                Download PDF
              </button>
              <button onClick={saveRevision} className="rounded-md border border-border px-2.5 py-1 text-xs">
                Save revision
              </button>
            </div>

            <p className="text-xs font-medium text-muted-foreground">Edit a block (in-place correction)</p>
            <div className="max-h-56 space-y-1 overflow-auto">
              {sections.map((section) => (
                <div key={section.id} className="space-y-0.5">
                  <p className="text-[11px] font-semibold">{section.name}</p>
                  {section.components.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => selectComponent(node)}
                      className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] ${
                        selectedComponentId === node.id ? 'bg-secondary' : 'hover:bg-secondary/60'
                      }`}
                    >
                      <span className="rounded border border-border px-1 text-[9px]">{node.type}</span>
                      <span className="truncate">{summarise(node)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {selectedComponentId && (
              <div className="space-y-1">
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                />
                <button
                  onClick={applyEdit}
                  disabled={editBusy}
                  className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {editBusy ? 'Applying…' : 'Apply edit'}
                </button>
              </div>
            )}

            {revisions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Revisions</p>
                <ul className="space-y-0.5 text-[11px]">
                  {revisions.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span>
                        v{r.versionNum} — {r.changelog}
                      </span>
                      <button onClick={() => rollback(r.id)} className="underline">
                        rollback
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="min-w-0">
        <div className="sticky top-2 space-y-2">
          <h3 className="text-sm font-semibold">Preview</h3>
          <iframe
            title="document-preview"
            className="w-full h-[80vh] rounded-lg border border-border bg-white"
            srcDoc={previewHtml || '<p style="font-family:sans-serif;padding:16px">No preview yet.</p>'}
          />
        </div>
      </div>
    </div>
  );
};
