import React, { useCallback, useEffect, useState } from 'react';
import { Template } from '../../infrastructure/api/UpApiClient';
import { useStudio } from './StudioContext';
import { starterTemplate, TemplateBuilderView } from './TemplateBuilderView';

export const TemplatesView: React.FC = () => {
  const { api, setError, setNotice } = useStudio();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await api.listTemplates());
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, setError]);

  useEffect(() => {
    void load();
  }, [load]);

  const createTemplate = async () => {
    try {
      const created = await api.createTemplate(starterTemplate());
      setNotice(`Created "${created.name}".`);
      await load();
      setSelected(created);
    } catch (error) {
      setError((error as Error).message);
    }
  };

  const handleSave = async (template: Template) => {
    try {
      const saved = await api.updateTemplate(template.id, template);
      setSelected(saved);
      setTemplates((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      setNotice(`Saved "${saved.name}" (v${saved.version}).`);
    } catch (error) {
      setError((error as Error).message);
      throw error;
    }
  };

  const duplicate = async (id: string) => {
    try {
      await api.duplicateTemplate(id);
      setNotice('Template duplicated.');
      await load();
    } catch (error) {
      setError((error as Error).message);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteTemplate(id);
      setNotice('Template deleted.');
      await load();
    } catch (error) {
      setError((error as Error).message);
    }
  };

  if (selected) {
    return <TemplateBuilderView template={selected} onSave={handleSave} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Templates</h2>
          <p className="text-xs text-muted-foreground">
            Define output type, page geometry, design tokens, sections and components. Live preview updates as you edit.
          </p>
        </div>
        <button
          onClick={createTemplate}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          + New template
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No templates yet. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {templates.map((template) => (
            <div key={template.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{template.name}</h3>
                  <p className="truncate text-xs text-muted-foreground">{template.description || 'No description'}</p>
                </div>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">v{template.version}</span>
              </div>
              <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                <span className="badge rounded border border-border px-1.5 py-0.5">{template.publicationType}</span>
                <span className="rounded border border-border px-1.5 py-0.5">{template.formatType}</span>
                <span className="rounded border border-border px-1.5 py-0.5">{template.pageSize}</span>
                <span className="rounded border border-border px-1.5 py-0.5">{template.sections.length} sections</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setSelected(template)}
                  className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                >
                  Edit
                </button>
                <button onClick={() => duplicate(template.id)} className="rounded-md border border-border px-2.5 py-1 text-xs">
                  Duplicate
                </button>
                <button onClick={() => remove(template.id)} className="rounded-md border border-border px-2.5 py-1 text-xs text-red-600">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
