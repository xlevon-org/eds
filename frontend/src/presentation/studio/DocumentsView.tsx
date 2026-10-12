import React, { useCallback, useEffect, useState } from 'react';
import { DocumentRecord } from '../../infrastructure/api/UpApiClient';
import { useStudio } from './StudioContext';
import { FitBadge } from './FitBadge';

export const DocumentsView: React.FC<{ onOpen: (documentId: string) => void }> = ({ onOpen }) => {
  const { api, setError } = useStudio();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDocuments(await api.listDocuments());
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, setError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Documents</h2>
        <button onClick={load} className="rounded-md border border-border px-2.5 py-1 text-xs">
          Refresh
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : documents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No documents yet. Generate one from the Generate tab.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Variant</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Rev</th>
                <th className="px-3 py-2">PDF engine</th>
                <th className="px-3 py-2">Fit</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{doc.title}</td>
                  <td className="px-3 py-2">{doc.variant}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 ${
                        doc.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : doc.status === 'error'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">v{doc.revision}</td>
                  <td className="px-3 py-2">{doc.fidelity?.pdf?.engine || '—'}</td>
                  <td className="px-3 py-2">
                    <FitBadge report={doc.fidelity?.fit?.pdf || doc.fidelity?.fit?.html} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => onOpen(doc.id)} className="rounded-md bg-primary px-2.5 py-1 text-primary-foreground">
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
