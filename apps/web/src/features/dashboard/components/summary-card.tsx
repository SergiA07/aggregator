import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  title: string;
  value: string;
  variant?: 'default' | 'success' | 'destructive' | 'info';
}

export function SummaryCard({ title, value, variant = 'default' }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p
          className={cn(
            'text-2xl font-bold',
            variant === 'success' && 'text-green-500',
            variant === 'destructive' && 'text-red-500',
            variant === 'info' && 'text-primary',
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
