import React, { useState } from 'react';
import { Handbook, HandbookFolder, HandbookKind } from '../../domain/entities/Handbook';
import { WorkspaceSection } from './TopBar';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
} from '@/src/components/ui/sheet';
import {
  LayoutGrid,
  BookOpen,
  Layers,
  Sparkles,
  Star,
  Trash2,
  Folder,
  FolderPlus,
  Plus,
} from 'lucide-react';

interface SidebarProps {
  activeSection: WorkspaceSection;
  selectedFolderId: string | null;
  handbooks: ReadonlyArray<Handbook>;
  folders: ReadonlyArray<HandbookFolder>;
  onSelectSection: (section: WorkspaceSection) => void;
  onSelectFolder: (folderId: string | null) => void;
  onCreateBlankHandbook: () => void;
  onCreateFolder: (name: string, deptCode: string) => string | null;
  onItemClickCloseDrawer?: () => void;
}

export const SidebarContent: React.FC<SidebarProps> = ({
  activeSection,
  selectedFolderId,
  handbooks,
  folders,
  onSelectSection,
  onSelectFolder,
  onCreateBlankHandbook,
  onCreateFolder,
  onItemClickCloseDrawer,
}) => {
  const [folderDrawerOpen, setFolderDrawerOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderCode, setNewFolderCode] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);

  const activeHandbooks = handbooks.filter((h) => !h.isTrashed);
  const trashedCount = handbooks.filter((h) => h.isTrashed).length;
  const starredCount = activeHandbooks.filter((h) => h.isStarred).length;
  const packetCount = activeHandbooks.filter(
    (h) => h.kind === HandbookKind.COURSE_PAGE_PACKET
  ).length;

  const handleSaveFolder = (e: React.FormEvent) => {
    e.preventDefault();
    setFolderError(null);
    const err = onCreateFolder(newFolderName, newFolderCode);
    if (err) {
      setFolderError(err);
      return;
    }
    setNewFolderName('');
    setNewFolderCode('');
    setFolderDrawerOpen(false);
  };

  const navItems: ReadonlyArray<{
    id: WorkspaceSection;
    label: string;
    count?: number;
    icon: React.ReactNode;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutGrid className="w-4 h-4" />,
    },
    {
      id: 'all-handbooks',
      label: 'All Handbooks',
      count: activeHandbooks.length,
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: 'course-packets',
      label: 'Combined Booklets',
      count: packetCount,
      icon: <Layers className="w-4 h-4" />,
    },
    {
      id: 'templates',
      label: 'Starter Templates',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: 'starred',
      label: 'Favorites',
      count: starredCount,
      icon: <Star className="w-4 h-4" />,
    },
    {
      id: 'trash',
      label: 'Trash',
      count: trashedCount,
      icon: <Trash2 className="w-4 h-4" />,
    },
  ];

  return (
    <div className="flex flex-col justify-between h-full space-y-6">
      <div className="space-y-5">
        {/* Quick Create Blank Handbook */}
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start font-semibold"
          onClick={() => {
            onCreateBlankHandbook();
            onItemClickCloseDrawer?.();
          }}
        >
          <Plus className="w-4 h-4" />
          New Blank Handbook
        </Button>

        {/* Primary Workspace Navigation */}
        <div className="space-y-1">
          <div className="px-2.5 pb-1 text-[11px] font-semibold text-muted-foreground">
            Workspace
          </div>
          {navItems.map((item) => {
            const isSelected = activeSection === item.id && selectedFolderId === null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectFolder(null);
                  onSelectSection(item.id);
                  onItemClickCloseDrawer?.();
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {item.count !== undefined && (
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Class & Subject Folders */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-2.5">
            <span className="text-[11px] font-semibold text-muted-foreground">
              Class Folders
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => {
                setFolderError(null);
                setFolderDrawerOpen(true);
              }}
              title="Open New Class Folder Drawer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="space-y-0.5">
            {folders.map((folder) => {
              const count = activeHandbooks.filter(
                (h) => h.departmentFolderId === folder.id
              ).length;
              const isSelected = selectedFolderId === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    onSelectSection('all-handbooks');
                    onSelectFolder(isSelected ? null : folder.id);
                    onItemClickCloseDrawer?.();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Folder className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  <span
                    className={`font-mono text-[11px] tabular-nums shrink-0 ${
                      isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quiet Production Workspace Footer */}
      <div className="pt-4 border-t border-border text-[11px] text-muted-foreground px-2">
        <div className="font-medium text-foreground">up Handbook Studio</div>
        <div>Printable PDF &amp; Classroom Guides</div>
      </div>

      {/* Quick-Action Drawer for Adding a New Class Folder */}
      <Sheet open={folderDrawerOpen} onOpenChange={setFolderDrawerOpen}>
        <SheetContent side="right" size="sm">
          <SheetHeader>
            <SheetTitle>New Class Folder</SheetTitle>
            <SheetDescription>
              Create a folder to organize student handbooks by subject or grade.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSaveFolder} className="flex flex-col flex-1 overflow-hidden">
            <SheetBody>
              {folderError && (
                <div className="p-2.5 rounded-lg border border-foreground bg-muted text-xs text-foreground font-semibold">
                  {folderError}
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Class or Subject Name</Label>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g., Art & Design Studio"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Short Folder Code</Label>
                <Input
                  value={newFolderCode}
                  onChange={(e) => setNewFolderCode(e.target.value)}
                  placeholder="e.g., ART-101"
                  className="font-mono"
                />
              </div>
            </SheetBody>

            <SheetFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFolderDrawerOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Create Folder
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = (props) => {
  return (
    <aside className="no-print hidden lg:flex w-64 shrink-0 border-r border-border bg-card flex-col justify-between min-h-[calc(100vh-56px)] p-4">
      <SidebarContent {...props} />
    </aside>
  );
};
