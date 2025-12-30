import { Link, useMatchRoute } from '@tanstack/react-router';
import { LayoutDashboard, PieChart, Receipt } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
}

function NavItem({ to, icon: Icon, label }: NavItemProps) {
  const matchRoute = useMatchRoute();
  const isActive = matchRoute({ to, fuzzy: true });

  return (
    <Link
      to={to}
      className={cn(
        'flex flex-col items-center justify-center gap-1 py-2 px-3 text-xs transition-colors',
        isActive ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="size-5" />
      <span>{label}</span>
    </Link>
  );
}

export function BottomNav() {
  const { t } = useTranslation();

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('nav.overview') },
    { to: '/positions', icon: PieChart, label: t('nav.positions') },
    { to: '/transactions', icon: Receipt, label: t('nav.transactions') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
      <div className="flex items-center justify-around">
        {navItems.map((item) => (
          <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} />
        ))}
      </div>
    </nav>
  );
}
