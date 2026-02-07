import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type AccountSummary, type AddValuationInput, api } from '@/lib/api/client';
import { overviewKeys } from '@/lib/api/queries/overview';
import { useTranslation } from '@/lib/i18n';
import { formatCurrency } from '@/utils/formatters';

interface AddValuationModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountSummary | null;
}

export function AddValuationModal({ isOpen, onClose, account }: AddValuationModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<AddValuationInput>({
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const valuationMutation = useMutation({
    mutationFn: (data: AddValuationInput) => {
      if (!account) throw new Error('No account selected');
      return api.addValuation(account.id, {
        ...data,
        date: data.date ? new Date(data.date).toISOString() : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: overviewKeys.all });
      handleClose();
    },
  });

  const handleClose = () => {
    setFormData({
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    valuationMutation.reset();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    valuationMutation.mutate(formData);
  };

  const isValid = formData.amount > 0;

  if (!account) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Valuation</DialogTitle>
          <DialogDescription>
            Enter the current value for <strong>{account.name}</strong>
            {account.totalValue > 0 && (
              <span className="block mt-1">
                Current value: {formatCurrency(account.totalValue, account.baseCurrency)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Current Value ({account.baseCurrency})</Label>
            <Input
              id="amount"
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={formData.amount || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, amount: Number.parseFloat(e.target.value) || 0 }))
              }
              required
              autoFocus
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Valuation Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="e.g., Monthly update, performance review..."
              value={formData.notes || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
            />
          </div>

          {/* Error Message */}
          {valuationMutation.error && (
            <p className="text-sm text-destructive">
              {(valuationMutation.error as Error).message || 'Failed to add valuation'}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={valuationMutation.isPending || !isValid}>
              {valuationMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Valuation'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
