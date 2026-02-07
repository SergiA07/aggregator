import type { ImportResult } from '@repo/shared-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleCheck,
  FileSpreadsheet,
  Loader2,
  PiggyBank,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { api, type CreateAccountInput } from '@/lib/api/client';
import { useImportCSV, useUploadFile } from '@/lib/api/queries/import';
import { overviewKeys } from '@/lib/api/queries/overview';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { formatFileSize, isParseError, parseCSV, parseCSVFile } from '@/utils/csv/csv-parser';
import {
  BROKER_INFO,
  BROKERS,
  type BrokerId,
  type CSVParseResult,
  formatBrokerName,
  getBrokersByType,
  getDelimiterName,
} from '@/utils/csv/csv-types';
import {
  type ValidationError,
  type ValidationWarning,
  validateCSVStructure,
  validateFile,
} from '@/utils/csv/csv-validator';
import { TradeRepublicSyncModal } from './trade-republic-sync-modal';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DataSource = 'import' | 'manual';
type ImportType = 'investment' | 'bank';
type ImportMethod = 'file' | 'paste';
type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid' | 'warning';

interface ValidationState {
  status: ValidationStatus;
  preview: CSVParseResult | null;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  detectedBroker: string | null;
  brokerConfidence: string;
}

const initialValidationState: ValidationState = {
  status: 'idle',
  preview: null,
  errors: [],
  warnings: [],
  detectedBroker: null,
  brokerConfidence: 'none',
};

// Manual account types
const ACCOUNT_TYPES = [
  { value: 'pension', labelKey: 'pensionFund', descKey: 'pensionFundDesc' },
  { value: 'other', labelKey: 'otherAccount', descKey: 'otherAccountDesc' },
] as const;

// Common pension fund institutions
const PENSION_INSTITUTIONS = [
  { value: 'caser', label: 'Caser' },
  { value: 'indexa', label: 'Indexa Capital' },
  { value: 'other', label: 'Other' },
] as const;

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Data source selection
  const [dataSource, setDataSource] = useState<DataSource>('import');

  // Import state
  const [importType, setImportType] = useState<ImportType>('investment');
  const [importMethod, setImportMethod] = useState<ImportMethod>('file');
  const [selectedBroker, setSelectedBroker] = useState<string>('');
  const [pastedContent, setPastedContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [validation, setValidation] = useState<ValidationState>(initialValidationState);
  const [showPreview, setShowPreview] = useState(false);
  const [showTRSyncModal, setShowTRSyncModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual account state
  const [manualForm, setManualForm] = useState<CreateAccountInput>({
    type: 'pension',
    institution: '',
    name: '',
    baseCurrency: 'EUR',
    notes: '',
  });
  const [customInstitution, setCustomInstitution] = useState('');
  const [accountCreated, setAccountCreated] = useState(false);

  const uploadMutation = useUploadFile();
  const csvMutation = useImportCSV();
  const createAccountMutation = useMutation({
    mutationFn: (data: CreateAccountInput) => api.createAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: overviewKeys.all });
      setAccountCreated(true);
    },
  });

  // Use the appropriate mutation based on import method
  const activeMutation = importMethod === 'file' ? uploadMutation : csvMutation;

  // Handle file selection with validation
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file first
    const fileError = validateFile(file);
    if (fileError) {
      setValidation({
        status: 'invalid',
        preview: null,
        errors: [fileError],
        warnings: [],
        detectedBroker: null,
        brokerConfidence: 'none',
      });
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setValidation((prev) => ({ ...prev, status: 'validating' }));

    // Try to auto-detect broker from filename
    const filename = file.name.toLowerCase();
    if (filename.includes('degiro')) {
      setSelectedBroker('degiro');
    } else if (filename.includes('trade') || filename.includes('republic')) {
      setSelectedBroker('trade-republic');
    } else if (filename.includes('sabadell')) {
      setSelectedBroker('sabadell');
      setImportType('bank');
    }

    // Parse file directly with PapaParse
    const parseResult = await parseCSVFile(file);

    if (isParseError(parseResult)) {
      setValidation({
        status: 'invalid',
        preview: null,
        errors: [{ type: parseResult.type, message: parseResult.message }],
        warnings: [],
        detectedBroker: null,
        brokerConfidence: 'none',
      });
      return;
    }

    const validationResult = validateCSVStructure(parseResult, selectedBroker || undefined);

    setValidation({
      status: validationResult.isValid
        ? validationResult.warnings.length > 0
          ? 'warning'
          : 'valid'
        : 'invalid',
      preview: parseResult,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      detectedBroker: validationResult.detectedBroker.broker,
      brokerConfidence: validationResult.detectedBroker.confidence,
    });

    // Auto-select broker if detected with high confidence
    if (
      validationResult.detectedBroker.broker &&
      validationResult.detectedBroker.confidence === 'high' &&
      !selectedBroker
    ) {
      setSelectedBroker(validationResult.detectedBroker.broker);
    }
  };

  // Debounced validation for pasted content
  useEffect(() => {
    if (importMethod !== 'paste' || !pastedContent.trim()) {
      if (importMethod === 'paste') {
        setValidation(initialValidationState);
      }
      return;
    }

    const timer = setTimeout(() => {
      setValidation((prev) => ({ ...prev, status: 'validating' }));

      const parseResult = parseCSV(pastedContent);

      if (isParseError(parseResult)) {
        setValidation({
          status: 'invalid',
          preview: null,
          errors: [{ type: 'empty_file', message: parseResult.message }],
          warnings: [],
          detectedBroker: null,
          brokerConfidence: 'none',
        });
        return;
      }

      const validationResult = validateCSVStructure(parseResult, selectedBroker || undefined);

      setValidation({
        status: validationResult.isValid
          ? validationResult.warnings.length > 0
            ? 'warning'
            : 'valid'
          : 'invalid',
        preview: parseResult,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        detectedBroker: validationResult.detectedBroker.broker,
        brokerConfidence: validationResult.detectedBroker.confidence,
      });

      // Auto-select broker if detected with high confidence
      if (
        validationResult.detectedBroker.broker &&
        validationResult.detectedBroker.confidence === 'high' &&
        !selectedBroker
      ) {
        setSelectedBroker(validationResult.detectedBroker.broker);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [pastedContent, importMethod, selectedBroker]);

  const handleImport = () => {
    if (importMethod === 'file' && selectedFile) {
      uploadMutation.mutate(
        { file: selectedFile, broker: selectedBroker || undefined, type: importType },
        { onSuccess: setResult },
      );
    } else if (importMethod === 'paste' && pastedContent) {
      csvMutation.mutate(
        { content: pastedContent, broker: selectedBroker || undefined, type: importType },
        { onSuccess: setResult },
      );
    }
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const institution =
      manualForm.institution === 'other' ? customInstitution : manualForm.institution;
    createAccountMutation.mutate({ ...manualForm, institution });
  };

  const handleClose = () => {
    // Reset import state
    setResult(null);
    setSelectedFile(null);
    setPastedContent('');
    setSelectedBroker('');
    setValidation(initialValidationState);
    setShowPreview(false);
    activeMutation.reset();

    // Reset manual account state
    setManualForm({
      type: 'pension',
      institution: '',
      name: '',
      baseCurrency: 'EUR',
      notes: '',
    });
    setCustomInstitution('');
    setAccountCreated(false);
    createAccountMutation.reset();

    // Reset data source
    setDataSource('import');

    onClose();
  };

  const brokers = getBrokersByType(importType);
  const canImport =
    (selectedFile || pastedContent) &&
    validation.status !== 'invalid' &&
    validation.status !== 'validating';

  // Manual form validation
  const isPension = manualForm.type === 'pension';
  const needsCustomInstitution = manualForm.institution === 'other';
  const effectiveInstitution = needsCustomInstitution ? customInstitution : manualForm.institution;
  const canCreateAccount = effectiveInstitution.trim() && manualForm.name.trim();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{t('addData.title')}</DialogTitle>
          <DialogDescription>{t('addData.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Success states */}
          {result ? (
            <ImportResultView result={result} onClose={handleClose} />
          ) : accountCreated ? (
            <AccountCreatedView onClose={handleClose} />
          ) : (
            <>
              {/* Data Source Selection */}
              <fieldset>
                <Label className="mb-2 block">{t('addData.dataSource')}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDataSource('import')}
                    className={cn(
                      'p-4 text-left transition-colors border-2 rounded-lg',
                      dataSource === 'import'
                        ? 'bg-primary/10 border-primary'
                        : 'bg-muted border-transparent hover:border-border',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-5 w-5" />
                      <div>
                        <p className="font-medium">{t('addData.importFromBroker')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('addData.importFromBrokerDesc')}
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDataSource('manual')}
                    className={cn(
                      'p-4 text-left transition-colors border-2 rounded-lg',
                      dataSource === 'manual'
                        ? 'bg-primary/10 border-primary'
                        : 'bg-muted border-transparent hover:border-border',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <PiggyBank className="h-5 w-5" />
                      <div>
                        <p className="font-medium">{t('addData.manualAccount')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('addData.manualAccountDesc')}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </fieldset>

              {dataSource === 'import' ? (
                <ImportForm
                  importType={importType}
                  setImportType={setImportType}
                  importMethod={importMethod}
                  setImportMethod={setImportMethod}
                  selectedBroker={selectedBroker}
                  setSelectedBroker={setSelectedBroker}
                  selectedFile={selectedFile}
                  pastedContent={pastedContent}
                  setPastedContent={setPastedContent}
                  validation={validation}
                  showPreview={showPreview}
                  setShowPreview={setShowPreview}
                  fileInputRef={fileInputRef}
                  handleFileChange={handleFileChange}
                  brokers={brokers}
                  activeMutation={activeMutation}
                  setShowTRSyncModal={setShowTRSyncModal}
                />
              ) : (
                <ManualAccountForm
                  form={manualForm}
                  setForm={setManualForm}
                  customInstitution={customInstitution}
                  setCustomInstitution={setCustomInstitution}
                  isPension={isPension}
                  needsCustomInstitution={needsCustomInstitution}
                  error={createAccountMutation.error}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!result && !accountCreated && (
          <DialogFooter>
            {dataSource === 'import' ? (
              <Button onClick={handleImport} disabled={activeMutation.isPending || !canImport}>
                {activeMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {t('addData.importing')}
                  </>
                ) : (
                  t('addData.importData')
                )}
              </Button>
            ) : (
              <Button
                onClick={handleCreateAccount}
                disabled={createAccountMutation.isPending || !canCreateAccount}
              >
                {createAccountMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {t('addData.creating')}
                  </>
                ) : (
                  t('addData.createAccount')
                )}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>

      {/* Trade Republic Sync Modal */}
      <TradeRepublicSyncModal
        isOpen={showTRSyncModal}
        onClose={() => {
          setShowTRSyncModal(false);
          handleClose();
        }}
      />
    </Dialog>
  );
}

// Import Form Component
function ImportForm({
  importType,
  setImportType,
  importMethod,
  setImportMethod,
  selectedBroker,
  setSelectedBroker,
  selectedFile,
  pastedContent,
  setPastedContent,
  validation,
  showPreview,
  setShowPreview,
  fileInputRef,
  handleFileChange,
  brokers,
  activeMutation,
  setShowTRSyncModal,
}: {
  importType: ImportType;
  setImportType: (type: ImportType) => void;
  importMethod: ImportMethod;
  setImportMethod: (method: ImportMethod) => void;
  selectedBroker: string;
  setSelectedBroker: (broker: string) => void;
  selectedFile: File | null;
  pastedContent: string;
  setPastedContent: (content: string) => void;
  validation: ValidationState;
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  brokers: string[];
  activeMutation: ReturnType<typeof useUploadFile> | ReturnType<typeof useImportCSV>;
  setShowTRSyncModal: (show: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      {/* Import Type Toggle */}
      <fieldset>
        <Label className="mb-2 block">{t('addData.importType')}</Label>
        <div className="flex w-full">
          <Button
            variant={importType === 'investment' ? 'default' : 'outline'}
            className="flex-1 rounded-r-none"
            onClick={() => {
              setImportType('investment');
              setSelectedBroker('');
            }}
          >
            {t('addData.investmentAccount')}
          </Button>
          <Button
            variant={importType === 'bank' ? 'default' : 'outline'}
            className="flex-1 rounded-l-none border-l-0"
            onClick={() => {
              setImportType('bank');
              setSelectedBroker('sabadell');
            }}
          >
            {t('addData.bankAccount')}
          </Button>
        </div>
      </fieldset>

      {/* Broker Selection */}
      <fieldset>
        <Label className="mb-2 block">{t('addData.selectBroker')}</Label>
        <div className="grid grid-cols-2 gap-3">
          {brokers.map((brokerId) => {
            const info = BROKER_INFO[brokerId as BrokerId];
            const isTradeRepublic = brokerId === BROKERS.TRADE_REPUBLIC;

            return (
              <div
                key={brokerId}
                className={cn(
                  'p-4 text-left transition-colors border-2 rounded-lg',
                  selectedBroker === brokerId
                    ? 'bg-primary/10 border-primary'
                    : 'bg-muted border-transparent hover:border-border',
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedBroker(brokerId)}
                  className="w-full text-left"
                >
                  <p className="font-medium">{info.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{info.description}</p>
                </button>

                {/* Trade Republic: Add sync button */}
                {isTradeRepublic && selectedBroker === brokerId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => setShowTRSyncModal(true)}
                  >
                    <RefreshCw className="size-4" />
                    {t('addData.syncViaAPI')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      {/* Instructions */}
      {selectedBroker && BROKER_INFO[selectedBroker as BrokerId] && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="font-medium mb-2">
              How to export from {BROKER_INFO[selectedBroker as BrokerId].name}:
            </h4>
            <ol className="text-sm text-muted-foreground space-y-1">
              {BROKER_INFO[selectedBroker as BrokerId].instructions.map((step, i) => (
                <li key={step}>
                  {i + 1}. {step}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Import Method Toggle */}
      <fieldset>
        <Label className="mb-2 block">{t('addData.importMethod')}</Label>
        <div className="flex w-full">
          <Button
            variant={importMethod === 'file' ? 'default' : 'outline'}
            className="flex-1 rounded-r-none"
            onClick={() => setImportMethod('file')}
          >
            {t('addData.uploadFile')}
          </Button>
          <Button
            variant={importMethod === 'paste' ? 'default' : 'outline'}
            className="flex-1 rounded-l-none border-l-0"
            onClick={() => setImportMethod('paste')}
          >
            {t('addData.pasteCSV')}
          </Button>
        </div>
      </fieldset>

      {/* File Upload or Paste Area */}
      {importMethod === 'file' ? (
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,.txt,.xls,.xlsx"
            className="hidden"
            id="file-upload"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'w-full border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              selectedFile
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-muted-foreground',
            )}
          >
            {selectedFile ? (
              <div>
                <CircleCheck className="size-12 mx-auto text-primary" />
                <p className="mt-2 font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)} - Click to change file
                </p>
              </div>
            ) : (
              <div>
                <Upload className="size-12 mx-auto text-muted-foreground" />
                <p className="mt-2">{t('addData.clickToUpload')}</p>
                <p className="text-sm text-muted-foreground">{t('addData.dragAndDrop')}</p>
              </div>
            )}
          </button>
        </div>
      ) : (
        <div>
          <Textarea
            value={pastedContent}
            onChange={(e) => setPastedContent(e.target.value)}
            placeholder={t('addData.pasteHere')}
            className="h-40 font-mono"
          />
        </div>
      )}

      {/* Validation Feedback */}
      {validation.status !== 'idle' && (
        <ValidationFeedback
          validation={validation}
          selectedFile={selectedFile}
          showPreview={showPreview}
          onTogglePreview={() => setShowPreview(!showPreview)}
        />
      )}

      {/* Error Message from API */}
      {activeMutation.error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-4">
            <p className="text-destructive">{(activeMutation.error as Error).message}</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// Manual Account Form Component
function ManualAccountForm({
  form,
  setForm,
  customInstitution,
  setCustomInstitution,
  isPension,
  needsCustomInstitution,
  error,
}: {
  form: CreateAccountInput;
  setForm: React.Dispatch<React.SetStateAction<CreateAccountInput>>;
  customInstitution: string;
  setCustomInstitution: (value: string) => void;
  isPension: boolean;
  needsCustomInstitution: boolean;
  error: Error | null;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Account Type */}
      <div className="space-y-2">
        <Label htmlFor="type">{t('addData.accountType')}</Label>
        <Select
          value={form.type}
          onValueChange={(value) =>
            setForm((prev) => ({
              ...prev,
              type: value as CreateAccountInput['type'],
              institution: '',
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
                  <span>{t(`addData.${type.labelKey}`)}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`addData.${type.descKey}`)}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Institution - dropdown for pension, free text for other */}
      <div className="space-y-2">
        <Label htmlFor="institution">
          {isPension ? t('addData.pensionProvider') : t('addData.institutionLabel')}
        </Label>
        {isPension ? (
          <Select
            value={form.institution}
            onValueChange={(value) => {
              setForm((prev) => ({ ...prev, institution: value || '' }));
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
            placeholder={t('addData.institutionPlaceholder')}
            value={form.institution}
            onChange={(e) => setForm((prev) => ({ ...prev, institution: e.target.value }))}
            required
          />
        )}
      </div>

      {/* Custom Institution (when "Other" is selected for pension) */}
      {isPension && needsCustomInstitution && (
        <div className="space-y-2">
          <Label htmlFor="customInstitution">{t('addData.providerName')}</Label>
          <Input
            id="customInstitution"
            placeholder={t('addData.enterProviderName')}
            value={customInstitution}
            onChange={(e) => setCustomInstitution(e.target.value)}
            required
          />
        </div>
      )}

      {/* Account Name */}
      <div className="space-y-2">
        <Label htmlFor="name">{t('addData.accountName')}</Label>
        <Input
          id="name"
          placeholder={
            isPension
              ? t('addData.accountNamePlaceholder')
              : t('addData.otherAccountNamePlaceholder')
          }
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">{t('addData.notes')}</Label>
        <Textarea
          id="notes"
          placeholder={t('addData.notesPlaceholder')}
          value={form.notes || ''}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          rows={2}
        />
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive">{error.message || 'Failed to create account'}</p>
      )}
    </div>
  );
}

// Validation Feedback Component
function ValidationFeedback({
  validation,
  selectedFile,
  showPreview,
  onTogglePreview,
}: {
  validation: ValidationState;
  selectedFile: File | null;
  showPreview: boolean;
  onTogglePreview: () => void;
}) {
  const { status, preview, errors, warnings, detectedBroker, brokerConfidence } = validation;

  return (
    <div className="space-y-3">
      {/* Status Badge */}
      <Card
        className={cn(
          status === 'valid' && 'border-green-500 bg-green-500/10',
          status === 'warning' && 'border-yellow-500 bg-yellow-500/10',
          status === 'invalid' && 'border-destructive bg-destructive/10',
        )}
      >
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            {status === 'validating' && <Loader2 className="size-5 animate-spin" />}
            {status === 'valid' && <Check className="size-5 text-green-500" />}
            {status === 'warning' && <AlertTriangle className="size-5 text-yellow-500" />}
            {status === 'invalid' && <X className="size-5 text-destructive" />}
            <span
              className={cn(
                'font-medium',
                status === 'valid' && 'text-green-500',
                status === 'warning' && 'text-yellow-500',
                status === 'invalid' && 'text-destructive',
              )}
            >
              {status === 'validating' && 'Validating...'}
              {status === 'valid' &&
                (detectedBroker
                  ? `Valid ${formatBrokerName(detectedBroker)} format`
                  : 'Valid CSV format')}
              {status === 'warning' &&
                (detectedBroker
                  ? `${formatBrokerName(detectedBroker)} format with warnings`
                  : 'CSV format with warnings')}
              {status === 'invalid' && 'Invalid file'}
            </span>
          </div>

          {/* File/Content Info */}
          {preview && (
            <p className="text-sm text-muted-foreground mt-1">
              {selectedFile && `${formatFileSize(selectedFile.size)} - `}
              {preview.totalRows} rows - {getDelimiterName(preview.delimiter)}-separated
              {detectedBroker && brokerConfidence !== 'none' && (
                <span className="text-muted-foreground/70"> - Confidence: {brokerConfidence}</span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-destructive mb-1">Errors:</p>
            <ul className="text-sm text-destructive/80 space-y-1">
              {errors.map((error) => (
                <li key={`${error.type}-${error.message}`}>- {error.message}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-yellow-600 mb-1">Warnings:</p>
            <ul className="text-sm text-yellow-600/80 space-y-1">
              {warnings.map((warning) => (
                <li key={`${warning.type}-${warning.message}`}>- {warning.message}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Preview Toggle */}
      {preview && preview.rows.length > 0 && (
        <Button variant="ghost" size="sm" onClick={onTogglePreview} className="gap-1">
          <ChevronRight className={cn('size-4 transition-transform', showPreview && 'rotate-90')} />
          {showPreview
            ? 'Hide preview'
            : `Preview (${Math.min(5, preview.rows.length)} of ${preview.totalRows} rows)`}
        </Button>
      )}

      {/* Preview Table */}
      {showPreview && preview && preview.rows.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                {preview.headers.slice(0, 6).map((header) => (
                  <TableHead key={header}>
                    {header.length > 15 ? `${header.slice(0, 15)}...` : header}
                  </TableHead>
                ))}
                {preview.headers.length > 6 && (
                  <TableHead className="text-muted-foreground">
                    +{preview.headers.length - 6} more
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.slice(0, 5).map((row, rowIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Preview rows lack unique IDs
                <TableRow key={rowIndex}>
                  {row.slice(0, 6).map((cell, cellIndex) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: Preview cells lack unique IDs
                    <TableCell key={cellIndex}>
                      {cell.length > 20 ? `${cell.slice(0, 20)}...` : cell || '-'}
                    </TableCell>
                  ))}
                  {row.length > 6 && <TableCell className="text-muted-foreground">...</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// Import Result View Component
function ImportResultView({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <Card className={result.success ? 'border-green-500 bg-green-500/10' : 'border-destructive'}>
        <CardContent className="pt-4">
          <h3
            className={cn('font-semibold', result.success ? 'text-green-500' : 'text-destructive')}
          >
            {result.success ? t('addData.success') : t('addData.completedWithErrors')}
          </h3>
          <p className="text-muted-foreground mt-1">Broker: {result.broker}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{result.transactionsImported}</p>
            <p className="text-sm text-muted-foreground">{t('addData.transactionsCount')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{result.positionsCreated}</p>
            <p className="text-sm text-muted-foreground">{t('addData.positionsCount')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{result.securitiesCreated}</p>
            <p className="text-sm text-muted-foreground">{t('addData.securitiesCount')}</p>
          </CardContent>
        </Card>
      </div>

      {result.errors.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="font-medium text-yellow-600 mb-2">Warnings ({result.errors.length})</h4>
            <ul className="text-sm text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
              {result.errors.slice(0, 10).map((error) => (
                <li key={error}>- {error}</li>
              ))}
              {result.errors.length > 10 && (
                <li className="text-muted-foreground/70">
                  ...and {result.errors.length - 10} more
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      <Button onClick={onClose} className="w-full">
        {t('common.close')}
      </Button>
    </div>
  );
}

// Account Created View Component
function AccountCreatedView({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <Card className="border-green-500 bg-green-500/10">
        <CardContent className="pt-4 text-center">
          <CircleCheck className="size-12 mx-auto text-green-500 mb-2" />
          <h3 className="font-semibold text-green-500">{t('addData.accountCreated')}</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            You can now add valuations to track its performance.
          </p>
        </CardContent>
      </Card>

      <Button onClick={onClose} className="w-full">
        {t('common.close')}
      </Button>
    </div>
  );
}
