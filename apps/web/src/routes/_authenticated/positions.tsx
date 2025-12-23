import { createFileRoute } from '@tanstack/react-router';
import { Positions, PositionsError } from '@/features/positions';

export const Route = createFileRoute('/_authenticated/positions')({
  component: Positions,
  errorComponent: PositionsError,
});
