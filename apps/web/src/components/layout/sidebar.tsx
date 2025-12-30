import { Link, useMatchRoute } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, LayoutDashboard, PieChart, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  collapsed: boolean;
}

function NavItem({ to, icon: Icon, label, collapsed }: NavItemProps) {
  const matchRoute = useMatchRoute();
  const isActive = matchRoute({ to, fuzzy: true });

  const linkContent = (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isActive && 'bg-accent text-accent-foreground font-medium',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon className="size-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger render={linkContent} />
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const { t } = useTranslation();
  const { sidebarCollapsed, toggleSidebar } = usePreferences();

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('nav.overview') },
    { to: '/positions', icon: PieChart, label: t('nav.positions') },
    { to: '/transactions', icon: Receipt, label: t('nav.transactions') },
  ];

  return (
    <aside
      className={cn(
        'bg-card border-r border-border flex flex-col transition-all duration-200 relative',
        sidebarCollapsed ? 'w-16' : 'w-56',
        className,
      )}
    >
      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            collapsed={sidebarCollapsed}
          />
        ))}
      </nav>

      {/* Collapse Toggle - positioned at the edge */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleSidebar}
              className="absolute -right-3 bottom-6 z-10 size-6 rounded-full border bg-card shadow-sm hover:bg-accent"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="size-3" />
              ) : (
                <ChevronLeft className="size-3" />
              )}
            </Button>
          }
        />
        <TooltipContent side="right">
          {sidebarCollapsed ? t('nav.expand') : t('nav.collapse')}
        </TooltipContent>
      </Tooltip>
    </aside>
  );
}
