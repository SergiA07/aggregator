import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { accountListOptions } from '@/lib/api/queries/accounts';
import { positionListOptions, positionSummaryOptions } from '@/lib/api/queries/positions';
import { transactionListOptions } from '@/lib/api/queries/transactions';

interface NavTabProps {
  to: string;
  label: string;
}

export function NavTab({ to, label }: NavTabProps) {
  const queryClient = useQueryClient();

  // Prefetch data on hover (fire-and-forget - doesn't block)
  const handleMouseEnter = () => {
    if (to === '/dashboard') {
      queryClient.prefetchQuery(accountListOptions());
      queryClient.prefetchQuery(positionSummaryOptions());
    } else if (to === '/positions') {
      queryClient.prefetchQuery(positionListOptions());
    } else if (to === '/transactions') {
      queryClient.prefetchQuery(transactionListOptions());
    }
  };

  return (
    <Link
      to={to}
      className="px-4 py-3 font-medium capitalize transition-colors"
      activeProps={{ className: 'text-primary-400 border-b-2 border-primary-400' }}
      inactiveProps={{ className: 'text-slate-400 hover:text-white' }}
      onMouseEnter={handleMouseEnter}
    >
      {label}
    </Link>
  );
}
