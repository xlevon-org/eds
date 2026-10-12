import React from 'react';
import { Button } from '@/src/components/ui/button';
import { useTheme } from '../context/ThemeContext';
import { Menu, Sun, Moon, Crosshair, ChevronRight } from 'lucide-react';

export type WorkspaceSection =
  | 'dashboard'
  | 'all-handbooks'
  | 'course-packets'
  | 'templates'
  | 'starred'
  | 'trash';

interface TopBarProps {
  breadcrumbLabel: string;
  onResetHome: () => void;
  onOpenMobileMenu: () => void;
  onOpenCaptureModal: () => void;
}

/**
 * Clean, Production-Grade SaaS Workspace Header:
 * Left: Responsive Mobile Drawer Trigger + 'up' Brand Wordmark + Contextual Breadcrumb
 * Right: Light/Dark Theme Switcher + Primary Action CTA
 */
export const TopBar: React.FC<TopBarProps> = ({
  breadcrumbLabel,
  onResetHome,
  onOpenMobileMenu,
  onOpenCaptureModal,
}) => {
  const { theme, setTheme } = useTheme();

  return (
    <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-4 px-4 sm:px-6 h-14 bg-background/95 backdrop-blur-xs border-b border-border">
      {/* Left Zone: Mobile Menu Trigger + Brand Mark + Contextual Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="lg:hidden h-8 w-8 shrink-0"
          onClick={onOpenMobileMenu}
          title="Open Workspace Menu"
        >
          <Menu className="w-4 h-4" />
        </Button>

        <button
          type="button"
          onClick={onResetHome}
          className="flex items-center gap-2 text-left focus:outline-none cursor-pointer shrink-0"
        >
          <span className="w-7 h-7 rounded-md bg-primary text-primary-foreground font-display font-bold text-sm flex items-center justify-center">
            up
          </span>
          <span className="text-base font-bold tracking-tight text-foreground font-display">
            up
          </span>
        </button>

        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 hidden sm:inline" />

        <span className="text-xs font-medium text-muted-foreground truncate hidden sm:inline max-w-[260px] md:max-w-md">
          {breadcrumbLabel}
        </span>
      </div>

      {/* Right Zone: Light/Dark Theme Control + Primary Action CTA */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div
          role="group"
          aria-label="Theme Switcher"
          className="inline-flex items-center p-0.5 rounded-lg bg-muted border border-border"
        >
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              theme === 'light'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Light Theme"
          >
            <Sun className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Light</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              theme === 'dark'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Dark Theme"
          >
            <Moon className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Dark</span>
          </button>
        </div>

        <Button type="button" size="sm" onClick={onOpenCaptureModal} className="h-8 px-3.5">
          <Crosshair className="w-3.5 h-3.5" />
          <span>Record a Guide</span>
        </Button>
      </div>
    </header>
  );
};
