import React, { useMemo, useState } from 'react';
import {
  Handbook,
  HandbookFolder,
  HandbookKind,
  HandbookStatus,
} from '../../domain/entities/Handbook';
import { CurriculumTemplate } from '../../domain/repositories/IHandbookRepository';
import { WorkspaceSection } from './TopBar';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Card } from '@/src/components/ui/card';
import { Checkbox } from '@/src/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
} from '@/src/components/ui/sheet';
import { WizardStepper } from '@/src/components/ui/wizard-stepper';
import {
  Search,
  Plus,
  Printer,
  Copy,
  Trash2,
  RotateCcw,
  Star,
  Layers,
  BookOpen,
  LayoutGrid,
  List,
  AlertCircle,
  CheckCircle2,
  Crosshair,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

interface DashboardViewProps {
  activeSection: WorkspaceSection;
  selectedFolderId: string | null;
  handbooks: ReadonlyArray<Handbook>;
  folders: ReadonlyArray<HandbookFolder>;
  templates: ReadonlyArray<CurriculumTemplate>;
  onOpenHandbook: (handbookId: string) => void;
  onOpenPrintModalForHandbook: (handbook: Handbook) => void;
  onOpenCaptureModal: () => void;
  onCreateBlankHandbook: () => void;
  onInstantiateTemplate: (templateId: string) => void;
  onDuplicateHandbook: (handbookId: string) => void;
  onMoveToTrash: (handbookId: string) => void;
  onRestoreFromTrash: (handbookId: string) => void;
  onDeletePermanently: (handbookId: string) => void;
  onToggleStar: (handbookId: string, currentStarred: boolean) => void;
  onCombineIntoCoursePacket: (
    title: string,
    courseCode: string,
    sourceIds: ReadonlyArray<string>
  ) => string | null;
}

const COMBINE_WIZARD_STEPS = [
  { stepNumber: 1, title: 'Select Guides', subtitle: 'Pick 2 or more guides' },
  { stepNumber: 2, title: 'Booklet Details', subtitle: 'Title & class code' },
  { stepNumber: 3, title: 'Create Booklet', subtitle: 'Merge all steps' },
] as const;

export const DashboardView: React.FC<DashboardViewProps> = ({
  activeSection,
  selectedFolderId,
  handbooks,
  folders,
  templates,
  onOpenHandbook,
  onOpenPrintModalForHandbook,
  onOpenCaptureModal,
  onCreateBlankHandbook,
  onInstantiateTemplate,
  onDuplicateHandbook,
  onMoveToTrash,
  onRestoreFromTrash,
  onDeletePermanently,
  onToggleStar,
  onCombineIntoCoursePacket,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');
  const [layoutMode, setLayoutMode] = useState<'GRID' | 'TABLE'>('GRID');

  // Multi-Select Booklet Compiler Wizard Drawer State
  const [selectedForCombine, setSelectedForCombine] = useState<string[]>([]);
  const [combineWizardOpen, setCombineWizardOpen] = useState(false);
  const [combineWizardStep, setCombineWizardStep] = useState(1);
  const [packetTitle, setPacketTitle] = useState(
    'Fall 2026 Combined Student Class & Lab Booklet'
  );
  const [packetCourseCode, setPacketCourseCode] = useState('SCI-100');
  const [combineFeedback, setCombineFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const activeHandbooks = useMemo(
    () => handbooks.filter((h) => !h.isTrashed),
    [handbooks]
  );

  const filteredHandbooks = useMemo(() => {
    return handbooks.filter((hb) => {
      if (activeSection === 'trash') {
        if (!hb.isTrashed) return false;
      } else {
        if (hb.isTrashed) return false;
      }

      if (activeSection === 'starred' && !hb.isStarred) return false;
      if (
        activeSection === 'course-packets' &&
        hb.kind !== HandbookKind.COURSE_PAGE_PACKET
      ) {
        return false;
      }

      if (selectedFolderId && hb.departmentFolderId !== selectedFolderId) {
        return false;
      }

      if (statusFilter === 'PUBLISHED' && hb.status !== HandbookStatus.PUBLISHED) {
        return false;
      }
      if (statusFilter === 'DRAFT' && hb.status !== HandbookStatus.DRAFT) {
        return false;
      }

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = hb.title.toLowerCase().includes(q);
        const matchesCourse = hb.courseCode.toLowerCase().includes(q);
        const matchesAuthor = hb.authorName.toLowerCase().includes(q);
        const matchesGrade = hb.gradeLevel.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCourse && !matchesAuthor && !matchesGrade) {
          return false;
        }
      }

      return true;
    });
  }, [handbooks, activeSection, selectedFolderId, statusFilter, searchQuery]);

  const totalStepsCount = useMemo(
    () => activeHandbooks.reduce((sum, h) => sum + h.steps.length, 0),
    [activeHandbooks]
  );
  const publishedCount = useMemo(
    () => activeHandbooks.filter((h) => h.status === HandbookStatus.PUBLISHED).length,
    [activeHandbooks]
  );
  const totalPdfExports = useMemo(
    () => activeHandbooks.reduce((sum, h) => sum + h.downloadedPdfCount, 0),
    [activeHandbooks]
  );

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  const toggleSelectForCombine = (id: string) => {
    setCombineFeedback(null);
    setSelectedForCombine((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCompilePacket = () => {
    const err = onCombineIntoCoursePacket(
      packetTitle,
      packetCourseCode,
      selectedForCombine
    );
    if (err) {
      setCombineFeedback({ ok: false, message: err });
      return;
    }
    setSelectedForCombine([]);
    setCombineWizardOpen(false);
    setCombineFeedback({
      ok: true,
      message: 'Combined your selected guides into a new Printable Student Booklet!',
    });
  };

  const getFolderName = (folderId: string): string => {
    return folders.find((f) => f.id === folderId)?.name || 'Class Folder';
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      {/* Workspace Section Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            {selectedFolder
              ? `Class Folder · ${selectedFolder.departmentCode}`
              : 'Student Handbooks & Printable Step-by-Step Guides'}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-display text-balance">
            {selectedFolder
              ? selectedFolder.name
              : activeSection === 'course-packets'
              ? 'Combined Student Booklets'
              : activeSection === 'templates'
              ? 'Starter Templates'
              : activeSection === 'starred'
              ? 'Favorite Handbooks'
              : activeSection === 'trash'
              ? 'Trash'
              : 'Workspace Dashboard'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setCombineWizardStep(1);
              setCombineWizardOpen(true);
            }}
          >
            <Layers className="w-4 h-4" />
            Combine Booklet Wizard
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCreateBlankHandbook}>
            <Plus className="w-4 h-4" />
            New Blank Handbook
          </Button>
          <Button type="button" size="sm" onClick={onOpenCaptureModal}>
            <Crosshair className="w-4 h-4" />
            Record a Guide
          </Button>
        </div>
      </div>

      {/* Kid & Teacher Friendly 1-2-3 Workflow Guide */}
      {activeSection === 'dashboard' && !selectedFolderId && (
        <Card className="p-4 bg-muted/40">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 tabular-nums">
                1
              </span>
              <div>
                <div className="font-bold text-foreground">Pick or Record a Guide</div>
                <div className="text-muted-foreground">
                  Click &ldquo;Record a Guide&rdquo; or start from a template below.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 tabular-nums">
                2
              </span>
              <div>
                <div className="font-bold text-foreground">Edit Steps &amp; Pictures</div>
                <div className="text-muted-foreground">
                  Write easy instructions and tap pictures to place the click circle.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 tabular-nums">
                3
              </span>
              <div>
                <div className="font-bold text-foreground">Print or Save PDF Booklet</div>
                <div className="text-muted-foreground">
                  Download a clean Black &amp; White PDF or print copies for class.
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* High-Density Workspace Summary Metrics (Tabular Numerals) */}
      {activeSection === 'dashboard' && !selectedFolderId && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground">Student Handbooks</div>
            <div className="text-xl sm:text-2xl font-bold text-foreground font-mono tabular-nums">
              {activeHandbooks.length}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {publishedCount} published · {activeHandbooks.length - publishedCount} drafts
            </div>
          </Card>

          <Card className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground">Visual Steps</div>
            <div className="text-xl sm:text-2xl font-bold text-foreground font-mono tabular-nums">
              {totalStepsCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              With target callout circles
            </div>
          </Card>

          <Card className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground">PDF Booklets Exported</div>
            <div className="text-xl sm:text-2xl font-bold text-foreground font-mono tabular-nums">
              {totalPdfExports}
            </div>
            <div className="text-[11px] text-muted-foreground">
              US Letter &amp; A4 print-ready
            </div>
          </Card>

          <Card className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground">Class Folders</div>
            <div className="text-xl sm:text-2xl font-bold text-foreground font-mono tabular-nums">
              {folders.length}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Organized by subject
            </div>
          </Card>
        </div>
      )}

      {/* Quick Action Bar When Handbooks Are Checked */}
      {selectedForCombine.length > 0 && (
        <Card className="p-3.5 bg-muted/60 border-foreground flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Layers className="w-4 h-4" />
            <span>{selectedForCombine.length} guide(s) selected for Booklet</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedForCombine([])}
            >
              Clear Selection
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setCombineWizardStep(2);
                setCombineWizardOpen(true);
              }}
            >
              Open Combine Booklet Wizard
            </Button>
          </div>
        </Card>
      )}

      {combineFeedback && (
        <div className="p-3 rounded-lg border border-foreground bg-muted text-xs text-foreground flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium">
            {combineFeedback.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            {combineFeedback.message}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs underline"
            onClick={() => setCombineFeedback(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Quick-Start Templates Section */}
      {(activeSection === 'dashboard' || activeSection === 'templates') &&
        !selectedFolderId && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-foreground font-display">
                Starter Templates
              </h2>
              <span className="text-xs text-muted-foreground">
                Create a structured student handbook in one click
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {templates.map((tpl) => (
                <Card
                  key={tpl.templateId}
                  className="p-4 flex flex-col justify-between gap-4 hover:border-foreground/50 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="text-xs text-muted-foreground font-mono tabular-nums">
                      <span>{tpl.category}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>{tpl.courseCode}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>{tpl.estimatedMinutes} min</span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground font-display">
                      {tpl.name}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tpl.summary}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-[11px] text-muted-foreground">{tpl.gradeBand}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onInstantiateTemplate(tpl.templateId)}
                    >
                      Use Template
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

      {/* Search, Segmented Status Filter & View Switcher Bar */}
      {activeSection !== 'templates' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search handbooks by title, class code, or teacher..."
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
              {/* Interactive Segmented Filter Controls */}
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg border border-border">
                {(
                  [
                    { id: 'ALL', label: 'All Guides' },
                    { id: 'PUBLISHED', label: 'Published' },
                    { id: 'DRAFT', label: 'Drafts' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      statusFilter === tab.id
                        ? 'bg-background text-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Layout Mode Switcher */}
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setLayoutMode('GRID')}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    layoutMode === 'GRID'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Card View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('TABLE')}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    layoutMode === 'TABLE'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Table View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Empty State */}
          {filteredHandbooks.length === 0 ? (
            <Card className="p-8 sm:p-12 text-center space-y-3">
              <BookOpen className="w-8 h-8 text-muted-foreground mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground font-display">
                  No Student Handbooks Found
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {activeSection === 'trash'
                    ? 'Trash is empty. Deleted handbooks will appear here so you can restore them.'
                    : 'Record a new step-by-step guide or clear your search filter to view all handbooks.'}
                </p>
              </div>
              {activeSection !== 'trash' && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('ALL');
                    }}
                  >
                    Reset Filters
                  </Button>
                  <Button type="button" size="sm" onClick={onOpenCaptureModal}>
                    Record a Guide
                  </Button>
                </div>
              )}
            </Card>
          ) : layoutMode === 'GRID' ? (
            /* Populated Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredHandbooks.map((hb) => {
                const totalMins = hb.steps.reduce(
                  (acc, s) => acc + (s.durationMinutes || 0),
                  0
                );
                const isChecked = selectedForCombine.includes(hb.id);

                return (
                  <Card
                    key={hb.id}
                    className="p-4 sm:p-5 flex flex-col justify-between gap-4 hover:border-foreground/50 transition-colors"
                  >
                    <div className="space-y-2">
                      {/* Quiet 1-line unboxed metadata kicker */}
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground font-mono tabular-nums">
                        <div className="flex items-center gap-2 truncate">
                          {!hb.isTrashed && (
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleSelectForCombine(hb.id)}
                              title="Select to combine into a Booklet"
                            />
                          )}
                          <span className="font-bold text-foreground">{hb.courseCode}</span>
                          <span aria-hidden="true">·</span>
                          <span>{hb.status}</span>
                          <span aria-hidden="true">·</span>
                          <span>{hb.steps.length} steps</span>
                          <span aria-hidden="true">·</span>
                          <span>{totalMins} mins</span>
                        </div>

                        {!hb.isTrashed && (
                          <button
                            type="button"
                            onClick={() => onToggleStar(hb.id, hb.isStarred)}
                            className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer p-1"
                            title="Favorite"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                hb.isStarred ? 'fill-current text-foreground' : ''
                              }`}
                            />
                          </button>
                        )}
                      </div>

                      {/* Primary Card Title */}
                      <button
                        type="button"
                        onClick={() => !hb.isTrashed && onOpenHandbook(hb.id)}
                        className="text-left block group cursor-pointer"
                      >
                        <h3 className="text-base font-bold text-foreground font-display group-hover:underline underline-offset-4">
                          {hb.title}
                        </h3>
                      </button>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {hb.subtitle}
                      </p>

                      {/* Secondary Unboxed Metadata Line */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                        <span>{hb.authorName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{hb.gradeLevel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{getFolderName(hb.departmentFolderId)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {hb.downloadedPdfCount} PDFs
                        </span>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
                      {hb.isTrashed ? (
                        <div className="flex flex-wrap items-center gap-2 w-full justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onRestoreFromTrash(hb.id)}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restore
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => onDeletePermanently(hb.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Permanently
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => onOpenHandbook(hb.id)}
                            >
                              Open &amp; Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onOpenPrintModalForHandbook(hb)}
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Print / PDF
                            </Button>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onDuplicateHandbook(hb.id)}
                              title="Duplicate Handbook"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onMoveToTrash(hb.id)}
                              title="Move to Trash"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* Responsive High-Density Table View */
            <Card className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-border bg-muted/60 text-muted-foreground font-semibold">
                    <th className="py-2.5 px-4">Handbook Title</th>
                    <th className="py-2.5 px-3">Class</th>
                    <th className="py-2.5 px-3">Grades</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Steps</th>
                    <th className="py-2.5 px-3 text-right">PDFs</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredHandbooks.map((hb) => (
                    <tr key={hb.id} className="hover:bg-accent/40 h-10">
                      <td className="py-2 px-4 font-semibold text-foreground">
                        <button
                          type="button"
                          onClick={() => !hb.isTrashed && onOpenHandbook(hb.id)}
                          className="hover:underline text-left font-bold truncate max-w-xs sm:max-w-md block cursor-pointer"
                        >
                          {hb.title}
                        </button>
                      </td>
                      <td className="py-2 px-3 font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                        {hb.courseCode}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                        {hb.gradeLevel}
                      </td>
                      <td className="py-2 px-3 text-foreground font-medium whitespace-nowrap">
                        {hb.status}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-foreground tabular-nums">
                        {hb.steps.length}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-foreground tabular-nums">
                        {hb.downloadedPdfCount}
                      </td>
                      <td className="py-2 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {!hb.isTrashed ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5"
                                onClick={() => onOpenHandbook(hb.id)}
                              >
                                Open
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2.5"
                                onClick={() => onOpenPrintModalForHandbook(hb)}
                              >
                                PDF
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onRestoreFromTrash(hb.id)}
                            >
                              Restore
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* COMBINE BOOKLET 3-STEP WIZARD DRAWER */}
      <Sheet open={combineWizardOpen} onOpenChange={setCombineWizardOpen}>
        <SheetContent side="right" size="lg">
          <SheetHeader>
            <SheetTitle>Combine Guides into Booklet — 3-Step Wizard</SheetTitle>
            <SheetDescription>
              Join two or more step-by-step guides into one master printable student booklet.
            </SheetDescription>
          </SheetHeader>

          <SheetBody>
            <WizardStepper
              steps={COMBINE_WIZARD_STEPS}
              currentStep={combineWizardStep}
              onStepSelect={(s) => setCombineWizardStep(s)}
            />

            {combineWizardStep === 1 && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-foreground">
                  Step 1: Check at least 2 Handbooks ({selectedForCombine.length} selected)
                </div>
                <div className="divide-y divide-border border border-border rounded-lg">
                  {activeHandbooks.map((hb) => {
                    const checked = selectedForCombine.includes(hb.id);
                    return (
                      <div
                        key={hb.id}
                        onClick={() => toggleSelectForCombine(hb.id)}
                        className="flex items-center justify-between p-3 text-xs hover:bg-accent/50 cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleSelectForCombine(hb.id)}
                          />
                          <div className="truncate">
                            <div className="font-bold text-foreground truncate">{hb.title}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {hb.courseCode} · {hb.steps.length} steps
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {combineWizardStep === 2 && (
              <Card className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label>Combined Booklet Title</Label>
                  <Input
                    value={packetTitle}
                    onChange={(e) => setPacketTitle(e.target.value)}
                    placeholder="e.g., Fall 2026 Master Science & Portal Booklet"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Class Code</Label>
                  <Input
                    value={packetCourseCode}
                    onChange={(e) => setPacketCourseCode(e.target.value)}
                    placeholder="SCI-100"
                    className="font-mono"
                  />
                </div>
              </Card>
            )}

            {combineWizardStep === 3 && (
              <Card className="p-4 space-y-3 text-xs">
                <div className="font-bold text-foreground text-sm">
                  Ready to Create Combined Booklet
                </div>
                <div>
                  <span className="text-muted-foreground">Booklet Title: </span>
                  <strong className="text-foreground">{packetTitle}</strong> ({packetCourseCode})
                </div>
                <div className="text-muted-foreground">
                  Includes {selectedForCombine.length} selected handbooks joined in order.
                </div>
              </Card>
            )}
          </SheetBody>

          <SheetFooter>
            <div>
              {combineWizardStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCombineWizardStep((p) => p - 1)}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Previous
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCombineWizardOpen(false)}
                >
                  Cancel
                </Button>
              )}
            </div>
            <div>
              {combineWizardStep < 3 ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={combineWizardStep === 1 && selectedForCombine.length < 2}
                  onClick={() => setCombineWizardStep((p) => p + 1)}
                >
                  Next
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={selectedForCombine.length < 2}
                  onClick={handleCompilePacket}
                >
                  <Layers className="w-4 h-4" />
                  Create Combined Booklet
                </Button>
              )}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};
