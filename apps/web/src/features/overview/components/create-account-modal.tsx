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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api, type CreateAccountInput } from '@/lib/api/client';
import { overviewKeys } from '@/lib/api/queries/overview';
import { useTranslation } from '@/lib/i18n';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Only allow pension and other (for cash at home, etc.)
const ACCOUNT_TYPES = [
  { value: 'pension', label: 'Pension Fund', description: 'Caser, Indexa, etc.' },
  { value: 'other', label: 'Other', description: 'Cash at home, etc.' },
] as const;

// Common pension fund institutions
const PENSION_INSTITUTIONS = [
  { value: 'caser', label: 'Caser' },
  { value: 'indexa', label: 'Indexa Capital' },
  { value: 'other', label: 'Other' },
] as const;

export function CreateAccountModal({ isOpen, onClose }: CreateAccountModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CreateAccountInput>({
    type: 'pension',
    institution: '',
    name: '',
    baseCurrency: 'EUR',
    notes: '',
  });
  const [customInstitution, setCustomInstitution] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: CreateAccountInput) => api.createAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: overviewKeys.all });
      handleClose();
    },
  });

  const handleClose = () => {
    setFormData({
      type: 'pension',
      institution: '',
      name: '',
      baseCurrency: 'EUR',
      notes: '',
    });
    setCustomInstitution('');
    createMutation.reset();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const institution = formData.institution === 'other' ? customInstitution : formData.institution;
    createMutation.mutate({ ...formData, institution });
  };

  const isPension = formData.type === 'pension';
  const needsCustomInstitution = formData.institution === 'other';
  const effectiveInstitution = needsCustomInstitution ? customInstitution : formData.institution;
  const isValid = effectiveInstitution.trim() && formData.name.trim();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Manual Account</DialogTitle>
          <DialogDescription>
            Add a pension fund or other account that you'll update manually with periodic
            valuations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Account Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Account Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  type: value as CreateAccountInput['type'],
                  institution: '', // Reset institution when type changes
                }))
              }
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col">
                      <span>{type.label}</span>
                      <span className="text-xs text-muted-foreground">{type.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Institution - dropdown for pension, free text for other */}
          <div className="space-y-2">
            <Label htmlFor="institution">{isPension ? 'Pension Provider' : 'Description'}</Label>
            {isPension ? (
              <Select
                value={formData.institution}
                onValueChange={(value) => {
                  setFormData((prev) => ({ ...prev, institution: value || '' }));
                  if (value !== 'other') setCustomInstitution('');
                }}
              >
                <SelectTrigger id="institution">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PENSION_INSTITUTIONS.map((inst) => (
                    <SelectItem key={inst.value} value={inst.value}>
                      {inst.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="institution"
                placeholder="e.g., Cash at home, Safe deposit"
                value={formData.institution}
                onChange={(e) => setFormData((prev) => ({ ...prev, institution: e.target.value }))}
                required
              />
            )}
          </div>

          {/* Custom Institution (when "Other" is selected for pension) */}
          {isPension && needsCustomInstitution && (
            <div className="space-y-2">
              <Label htmlFor="customInstitution">Provider Name</Label>
              <Input
                id="customInstitution"
                placeholder="Enter provider name"
                value={customInstitution}
                onChange={(e) => setCustomInstitution(e.target.value)}
                required
              />
            </div>
          )}

          {/* Account Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Account Name</Label>
            <Input
              id="name"
              placeholder={isPension ? 'e.g., Plan de Pensiones' : 'e.g., Efectivo casa'}
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              value={formData.notes || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
            />
          </div>

          {/* Error Message */}
          {createMutation.error && (
            <p className="text-sm text-destructive">
              {(createMutation.error as Error).message || 'Failed to create account'}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !isValid}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
