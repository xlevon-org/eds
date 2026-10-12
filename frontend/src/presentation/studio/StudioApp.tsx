import React, { useState } from 'react';
import { StudioProvider, useStudio } from './StudioContext';
import { LoginView } from './LoginView';
import { TemplatesView } from './TemplatesView';
import { GenerateView } from './GenerateView';
import { DocumentsView } from './DocumentsView';
import { KnowledgeBaseView } from './KnowledgeBaseView';
import { ProvidersView } from './ProvidersView';

type Tab = 'generate' | 'templates' | 'documents' | 'kb' | 'providers';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'generate', label: 'Generate' },
  { id: 'templates', label: 'Templates' },
  { id: 'documents', label: 'Documents' },
  { id: 'kb', label: 'Knowledge base' },
  { id: 'providers', label: 'Providers' },
];

const StudioShell: React.FC = () => {
  const { user, ready, notice, error, setNotice, setError, logout, api } = useStudio();
  const [tab, setTab] = useState<Tab>('generate');
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null);

  const downloadPrd = async () => {
    try {
      const markdown = await api.fetchPrd();
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'atomic_system_architecture_prd.md';
      a.click();
      URL.revokeObjectURL(url);
      setNotice('PRD downloaded.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!ready) {
    return <div className="p-8 text-sm text-muted-foreground">Loading session…</div>;
  }

  if (!user) {
    return <LoginView />;
  }

  const openDocument = (id: string) => {
    setOpenDocumentId(id);
    setTab('generate');
  };

  return (
    <div className="min-h-[80vh] bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">up Studio</span>
          <nav className="flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  if (t.id !== 'generate') setOpenDocumentId(null);
                }}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => {
              void downloadPrd();
            }}
            className="rounded-md border border-border px-2 py-1"
          >
            Download PRD
          </button>
          <span className="text-muted-foreground">{user.email}</span>
          <button
            onClick={() => {
              void logout();
            }}
            className="rounded-md border border-border px-2 py-1"
          >
            Sign out
          </button>
        </div>
      </div>

      {notice && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)}>✕</button>
        </div>
      )}
      {error && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {tab === 'generate' && <GenerateView initialDocumentId={openDocumentId || undefined} />}
      {tab === 'templates' && <TemplatesView />}
      {tab === 'documents' && <DocumentsView onOpen={openDocument} />}
      {tab === 'kb' && <KnowledgeBaseView />}
      {tab === 'providers' && <ProvidersView />}
    </div>
  );
};

export const StudioApp: React.FC = () => (
  <StudioProvider>
    <StudioShell />
  </StudioProvider>
);
