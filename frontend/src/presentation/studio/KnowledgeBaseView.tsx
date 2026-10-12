import React, { useCallback, useEffect, useState } from 'react';
import { KbChunk, KbSource } from '../../infrastructure/api/UpApiClient';
import { useStudio } from './StudioContext';

export const KnowledgeBaseView: React.FC = () => {
  const { api, setError, setNotice } = useStudio();
  const [sources, setSources] = useState<KbSource[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [tagInput, setTagInput] = useState('general');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ score: number; chunk: KbChunk }>>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSources(await api.listKbSources());
      setTags(await api.kbTags());
    } catch (error) {
      setError((error as Error).message);
    }
  }, [api, setError]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!name.trim() || !text.trim()) {
      setError('Name and text are required to add a source.');
      return;
    }
    setBusy(true);
    try {
      const tagsArr = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
      const result = await api.createKbSource({ name, type: 'TEXT', text, tags: tagsArr });
      setNotice(`Added "${result.source.name}" with ${result.chunkCount} chunk(s).`);
      setName('');
      setText('');
      await load();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const search = async () => {
    try {
      const result = await api.kbSearch(query);
      setResults(result.results);
    } catch (error) {
      setError((error as Error).message);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteKbSource(id);
      setNotice('Source removed.');
      await load();
    } catch (error) {
      setError((error as Error).message);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
      <div className="space-y-3 min-w-0">
        <h2 className="text-lg font-semibold">Knowledge base</h2>
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Add extracted text (paste from a PDF/image OCR or type directly), tag it, and select chunks during generation.
          </p>
          <input
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            placeholder="Source name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            placeholder="Tags (comma separated)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
          />
          <textarea
            rows={5}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            placeholder="Paste text content…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            onClick={add}
            disabled={busy}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? 'Adding…' : 'Add source'}
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              placeholder="Search chunks…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button onClick={search} className="rounded-md border border-border px-2.5 py-1 text-xs">
              Search
            </button>
          </div>
          {results.length > 0 && (
            <ul className="space-y-1 text-[11px]">
              {results.map((r) => (
                <li key={r.chunk.id} className="rounded border border-border p-1.5">
                  <span className="mr-1 rounded bg-secondary px-1 text-[9px]">score {r.score}</span>
                  {r.chunk.content.slice(0, 120)}
                </li>
              ))}
            </ul>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {tags.map((t) => (
                <span key={t} className="rounded border border-border px-1.5 py-0.5 text-[10px]">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-2">
        <h3 className="text-sm font-semibold">Sources ({sources.length})</h3>
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sources yet.</p>
        ) : (
          <ul className="space-y-2">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.type} · {s.status} · {s.chunkCount} chunks
                  </p>
                </div>
                <button onClick={() => remove(s.id)} className="text-red-600">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
