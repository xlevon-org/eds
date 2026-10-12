/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  DependencyProvider,
  useDependencies,
} from './presentation/context/DependencyContext';
import { ThemeProvider } from './presentation/context/ThemeContext';
import { TopBar, WorkspaceSection } from './presentation/components/TopBar';
import { Sidebar, SidebarContent } from './presentation/components/Sidebar';
import { DashboardView } from './presentation/components/DashboardView';
import { HandbookEditorView } from './presentation/components/HandbookEditorView';
import { CaptureRecorderModal } from './presentation/components/CaptureRecorderModal';
import { PrintablePreviewModal } from './presentation/components/PrintablePreviewModal';
import { Handbook, HandbookFolder } from './domain/entities/Handbook';
import { StudioApp } from './presentation/studio/StudioApp';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from './components/ui/sheet';

const SECTION_LABELS: Record<WorkspaceSection, string> = {
  dashboard: 'Workspace Dashboard',
  'all-handbooks': 'All Handbooks',
  'course-packets': 'Combined Booklets',
  templates: 'Starter Templates',
  starred: 'Favorites',
  trash: 'Trash',
};

const WorkspaceShell: React.FC = () => {
  const {
    workspaceQueryUseCase,
    manageFolderUseCase,
    instantiateTemplateUseCase,
    createHandbookUseCase,
    updateMetadataUseCase,
    lifecycleStateUseCase,
  } = useDependencies();

  const [handbooks, setHandbooks] = useState<ReadonlyArray<Handbook>>([]);
  const [folders, setFolders] = useState<ReadonlyArray<HandbookFolder>>([]);
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('dashboard');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [editingHandbookId, setEditingHandbookId] = useState<string | null>(null);

  // Modals & Responsive Drawer
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [captureModalOpen, setCaptureModalOpen] = useState(false);
  const [printPreviewHandbook, setPrintPreviewHandbook] = useState<Handbook | null>(
    null
  );

  const refreshAll = useCallback(() => {
    const hbRes = workspaceQueryUseCase.getHandbooks();
    if (hbRes.ok) {
      setHandbooks(hbRes.value);
    }
    const folderRes = workspaceQueryUseCase.getFolders();
    if (folderRes.ok) {
      setFolders(folderRes.value);
    }
  }, [workspaceQueryUseCase]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const activeEditingHandbook = handbooks.find((h) => h.id === editingHandbookId) || null;
  const activeFolder = folders.find((f) => f.id === selectedFolderId) || null;

  const breadcrumbLabel = activeEditingHandbook
    ? `${activeEditingHandbook.courseCode} · ${activeEditingHandbook.title}`
    : activeFolder
    ? `Class Folders / ${activeFolder.name}`
    : SECTION_LABELS[activeSection];

  const handleCreateBlankHandbook = () => {
    const res = createHandbookUseCase.execute({
      title: 'New Student Step-by-Step Handbook',
      subtitle: 'Easy visual instructions and printable checklist for students.',
      courseCode: 'EDU-101',
      gradeLevel: 'Grades 5–12',
      academicTerm: 'Fall 2026',
      authorName: 'Class Teacher',
      departmentFolderId: selectedFolderId || folders[0]?.id || 'folder-stem',
    });
    if (res.ok) {
      refreshAll();
      setEditingHandbookId(res.value.id);
    }
  };

  const handleInstantiateTemplate = (templateId: string) => {
    const res = instantiateTemplateUseCase.execute(
      templateId,
      'Dr. Elena Rostova',
      selectedFolderId || 'folder-stem'
    );
    if (res.ok) {
      refreshAll();
      setEditingHandbookId(res.value.id);
    }
  };

  const handleCreateFolder = (name: string, deptCode: string): string | null => {
    const res = manageFolderUseCase.createFolder(
      name,
      deptCode,
      'Custom class folder'
    );
    if (!res.ok) {
      return res.error.message;
    }
    refreshAll();
    return null;
  };

  const handleCombineIntoCoursePacket = (
    title: string,
    courseCode: string,
    sourceIds: ReadonlyArray<string>
  ): string | null => {
    const res = lifecycleStateUseCase.combineIntoCoursePacket({
      packetTitle: title,
      courseCode,
      gradeLevel: 'Grades 5–12',
      authorName: 'School Teaching Team',
      departmentFolderId: selectedFolderId || 'folder-stem',
      sourceHandbookIds: sourceIds,
    });
    if (!res.ok) {
      return res.error.message;
    }
    refreshAll();
    setEditingHandbookId(res.value.id);
    return null;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <TopBar
        breadcrumbLabel={breadcrumbLabel}
        onResetHome={() => {
          setEditingHandbookId(null);
          setSelectedFolderId(null);
          setActiveSection('dashboard');
        }}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenCaptureModal={() => setCaptureModalOpen(true)}
      />

      {/* Mobile & Tablet Slide-Out Navigation Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="overflow-y-auto flex flex-col">
          <SheetHeader>
            <SheetTitle>up Workspace</SheetTitle>
          </SheetHeader>
          <div className="flex-1 pt-3">
            <SidebarContent
              activeSection={activeSection}
              selectedFolderId={selectedFolderId}
              handbooks={handbooks}
              folders={folders}
              onSelectSection={(sec) => {
                setEditingHandbookId(null);
                setActiveSection(sec);
              }}
              onSelectFolder={(folderId) => {
                setEditingHandbookId(null);
                setSelectedFolderId(folderId);
              }}
              onCreateBlankHandbook={handleCreateBlankHandbook}
              onCreateFolder={handleCreateFolder}
              onItemClickCloseDrawer={() => setMobileMenuOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 min-w-0">
        <Sidebar
          activeSection={activeSection}
          selectedFolderId={selectedFolderId}
          handbooks={handbooks}
          folders={folders}
          onSelectSection={(sec) => {
            setEditingHandbookId(null);
            setActiveSection(sec);
          }}
          onSelectFolder={(folderId) => {
            setEditingHandbookId(null);
            setSelectedFolderId(folderId);
          }}
          onCreateBlankHandbook={handleCreateBlankHandbook}
          onCreateFolder={handleCreateFolder}
        />

        <main className="flex-1 min-w-0">
          {activeEditingHandbook ? (
            <HandbookEditorView
              handbook={activeEditingHandbook}
              folders={folders}
              onBack={() => {
                setEditingHandbookId(null);
                refreshAll();
              }}
              onHandbookChange={() => {
                refreshAll();
              }}
            />
          ) : (
            <DashboardView
              activeSection={activeSection}
              selectedFolderId={selectedFolderId}
              handbooks={handbooks}
              folders={folders}
              templates={workspaceQueryUseCase.getTemplates()}
              onOpenHandbook={(id) => setEditingHandbookId(id)}
              onOpenPrintModalForHandbook={(hb) => setPrintPreviewHandbook(hb)}
              onOpenCaptureModal={() => setCaptureModalOpen(true)}
              onCreateBlankHandbook={handleCreateBlankHandbook}
              onInstantiateTemplate={handleInstantiateTemplate}
              onDuplicateHandbook={(id) => {
                lifecycleStateUseCase.duplicateHandbook(id);
                refreshAll();
              }}
              onMoveToTrash={(id) => {
                lifecycleStateUseCase.moveToTrash(id);
                refreshAll();
              }}
              onRestoreFromTrash={(id) => {
                lifecycleStateUseCase.restoreFromTrash(id);
                refreshAll();
              }}
              onDeletePermanently={(id) => {
                lifecycleStateUseCase.deletePermanently(id);
                refreshAll();
              }}
              onToggleStar={(id, currentStarred) => {
                updateMetadataUseCase.execute(id, { isStarred: !currentStarred });
                refreshAll();
              }}
              onCombineIntoCoursePacket={handleCombineIntoCoursePacket}
            />
          )}
        </main>
      </div>

      {/* Interactive up Guide Recorder Modal */}
      <CaptureRecorderModal
        open={captureModalOpen}
        onOpenChange={setCaptureModalOpen}
        folders={folders}
        onHandbookCreated={(newHb) => {
          refreshAll();
          setEditingHandbookId(newHb.id);
        }}
      />

      {/* Printable PDF Preview Modal from Dashboard */}
      {printPreviewHandbook && (
        <PrintablePreviewModal
          open={Boolean(printPreviewHandbook)}
          onOpenChange={(open) => {
            if (!open) setPrintPreviewHandbook(null);
          }}
          handbook={printPreviewHandbook}
          onHandbookUpdated={(updated) => {
            setPrintPreviewHandbook(updated);
            refreshAll();
          }}
        />
      )}
    </div>
  );
};

export default function App() {
  const [mode, setMode] = React.useState<'studio' | 'legacy'>(() => {
    try {
      return (localStorage.getItem('up_app_mode') as 'studio' | 'legacy') || 'studio';
    } catch {
      return 'studio';
    }
  });

  const choose = (next: 'studio' | 'legacy') => {
    setMode(next);
    try {
      localStorage.setItem('up_app_mode', next);
    } catch {
      /* ignore */
    }
  };

  return (
    <ThemeProvider>
      <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5 text-xs">
        <span className="font-semibold">up</span>
        <button
          onClick={() => choose('studio')}
          className={`rounded px-2 py-0.5 ${mode === 'studio' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          Studio
        </button>
        <button
          onClick={() => choose('legacy')}
          className={`rounded px-2 py-0.5 ${mode === 'legacy' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          Legacy workspace
        </button>
      </div>
      {mode === 'studio' ? (
        <StudioApp />
      ) : (
        <DependencyProvider>
          <WorkspaceShell />
        </DependencyProvider>
      )}
    </ThemeProvider>
  );
}
