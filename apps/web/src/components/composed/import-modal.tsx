import type { ImportResult } from '@repo/shared-types';
import { useEffect, useRef, useState } from 'react';
import { useImportCSV, useUploadFile } from '@/lib/api/queries/import';
import { formatFileSize, isParseError, parseCSV, parseCSVFile } from '@/utils/csv/csv-parser';
import {
  BROKER_INFO,
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

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [importType, setImportType] = useState<ImportType>('investment');
  const [importMethod, setImportMethod] = useState<ImportMethod>('file');
  const [selectedBroker, setSelectedBroker] = useState<string>('');
  const [pastedContent, setPastedContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [validation, setValidation] = useState<ValidationState>(initialValidationState);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadFile();
  const csvMutation = useImportCSV();

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

  const handleClose = () => {
    setResult(null);
    setSelectedFile(null);
    setPastedContent('');
    setSelectedBroker('');
    setValidation(initialValidationState);
    setShowPreview(false);
    activeMutation.reset();
    onClose();
  };

  if (!isOpen) return null;

  const brokers = getBrokersByType(importType);
  const canImport =
    (selectedFile || pastedContent) &&
    validation.status !== 'invalid' &&
    validation.status !== 'validating';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Import Data</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {result ? (
            <ImportResultView result={result} onClose={handleClose} />
          ) : (
            <>
              {/* Import Type Toggle */}
              <fieldset>
                <legend className="block text-sm font-medium text-slate-300 mb-2">
                  Import Type
                </legend>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportType('investment');
                      setSelectedBroker('');
                    }}
                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                      importType === 'investment'
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Investment Account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportType('bank');
                      setSelectedBroker('sabadell');
                    }}
                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                      importType === 'bank'
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Bank Account
                  </button>
                </div>
              </fieldset>

              {/* Broker Selection */}
              <fieldset>
                <legend className="block text-sm font-medium text-slate-300 mb-2">
                  Select Broker/Bank
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {brokers.map((brokerId) => {
                    const info = BROKER_INFO[brokerId];
                    return (
                      <button
                        type="button"
                        key={brokerId}
                        onClick={() => setSelectedBroker(brokerId)}
                        className={`p-4 rounded-lg text-left transition-colors ${
                          selectedBroker === brokerId
                            ? 'bg-primary-600/20 border-2 border-primary-500'
                            : 'bg-slate-700 border-2 border-transparent hover:border-slate-600'
                        }`}
                      >
                        <p className="font-medium text-white">{info.name}</p>
                        <p className="text-sm text-slate-400 mt-1">{info.description}</p>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Instructions */}
              {selectedBroker && BROKER_INFO[selectedBroker as BrokerId] && (
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-white mb-2">
                    How to export from {BROKER_INFO[selectedBroker as BrokerId].name}:
                  </h4>
                  <ol className="text-sm text-slate-300 space-y-1">
                    {BROKER_INFO[selectedBroker as BrokerId].instructions.map((step, i) => (
                      <li key={step}>
                        {i + 1}. {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Import Method Toggle */}
              <fieldset>
                <legend className="block text-sm font-medium text-slate-300 mb-2">
                  Import Method
                </legend>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMethod('file')}
                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                      importMethod === 'file'
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMethod('paste')}
                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                      importMethod === 'paste'
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Paste CSV
                  </button>
                </div>
              </fieldset>

              {/* File Upload or Paste Area */}
              {importMethod === 'file' ? (
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv,.txt"
                    className="hidden"
                    id="file-upload"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      selectedFile
                        ? 'border-primary-500 bg-primary-900/20'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    {selectedFile ? (
                      <div>
                        <svg
                          className="w-12 h-12 mx-auto text-primary-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <p className="mt-2 text-white font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-slate-400">
                          {formatFileSize(selectedFile.size)} • Click to change file
                        </p>
                      </div>
                    ) : (
                      <div>
                        <svg
                          className="w-12 h-12 mx-auto text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <p className="mt-2 text-white">Click to upload CSV file</p>
                        <p className="text-sm text-slate-400">or drag and drop</p>
                      </div>
                    )}
                  </button>
                </div>
              ) : (
                <div>
                  <textarea
                    value={pastedContent}
                    onChange={(e) => setPastedContent(e.target.value)}
                    placeholder="Paste your CSV content here..."
                    className="w-full h-40 px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
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
                <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
                  <p className="text-red-400">{(activeMutation.error as Error).message}</p>
                </div>
              )}

              {/* Import Button */}
              <button
                type="button"
                onClick={handleImport}
                disabled={activeMutation.isPending || !canImport}
                className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
              >
                {activeMutation.isPending ? 'Importing...' : 'Import Data'}
              </button>
            </>
          )}
        </div>
      </div>
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

  const statusConfig = {
    validating: { bg: 'bg-slate-700', border: 'border-slate-600', text: 'text-slate-300' },
    valid: { bg: 'bg-green-900/50', border: 'border-green-700', text: 'text-green-400' },
    warning: { bg: 'bg-yellow-900/50', border: 'border-yellow-700', text: 'text-yellow-400' },
    invalid: { bg: 'bg-red-900/50', border: 'border-red-700', text: 'text-red-400' },
    idle: { bg: 'bg-slate-700', border: 'border-slate-600', text: 'text-slate-300' },
  };

  const config = statusConfig[status];

  return (
    <div className="space-y-3">
      {/* Status Badge */}
      <div className={`${config.bg} border ${config.border} rounded-lg p-4`}>
        <div className="flex items-center gap-2">
          {status === 'validating' && (
            <svg
              className="w-5 h-5 text-slate-400 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {status === 'valid' && (
            <svg
              className="w-5 h-5 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
          {status === 'warning' && (
            <svg
              className="w-5 h-5 text-yellow-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
          {status === 'invalid' && (
            <svg
              className="w-5 h-5 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
          <span className={`font-medium ${config.text}`}>
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
          <p className="text-sm text-slate-400 mt-1">
            {selectedFile && `${formatFileSize(selectedFile.size)} • `}
            {preview.totalRows} rows • {getDelimiterName(preview.delimiter)}-separated
            {detectedBroker && brokerConfidence !== 'none' && (
              <span className="text-slate-500"> • Confidence: {brokerConfidence}</span>
            )}
          </p>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
          <p className="text-sm font-medium text-red-400 mb-1">Errors:</p>
          <ul className="text-sm text-red-300 space-y-1">
            {errors.map((error) => (
              <li key={`${error.type}-${error.message}`}>• {error.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-3">
          <p className="text-sm font-medium text-yellow-400 mb-1">Warnings:</p>
          <ul className="text-sm text-yellow-300 space-y-1">
            {warnings.map((warning) => (
              <li key={`${warning.type}-${warning.message}`}>• {warning.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview Toggle */}
      {preview && preview.rows.length > 0 && (
        <button
          type="button"
          onClick={onTogglePreview}
          className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showPreview ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {showPreview
            ? 'Hide preview'
            : `Preview (${Math.min(5, preview.rows.length)} of ${preview.totalRows} rows)`}
        </button>
      )}

      {/* Preview Table - using indices as keys is intentional for preview data without unique IDs */}
      {showPreview && preview && preview.rows.length > 0 && (
        <div className="bg-slate-900 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800">
                  {preview.headers.slice(0, 6).map((header) => (
                    <th key={header} className="px-3 py-2 text-left text-slate-400 font-medium">
                      {header.length > 15 ? `${header.slice(0, 15)}...` : header}
                    </th>
                  ))}
                  {preview.headers.length > 6 && (
                    <th key="more-columns" className="px-3 py-2 text-left text-slate-500">
                      +{preview.headers.length - 6} more
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 5).map((row, rowIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Preview rows lack unique IDs
                  <tr key={rowIndex} className="border-t border-slate-800">
                    {row.slice(0, 6).map((cell, cellIndex) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: Preview cells lack unique IDs
                      <td key={cellIndex} className="px-3 py-2 text-slate-300">
                        {cell.length > 20 ? `${cell.slice(0, 20)}...` : cell || '-'}
                      </td>
                    ))}
                    {row.length > 6 && <td className="px-3 py-2 text-slate-500">...</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Import Result View Component
function ImportResultView({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div
        className={`p-4 rounded-lg ${result.success ? 'bg-green-900/50 border border-green-700' : 'bg-red-900/50 border border-red-700'}`}
      >
        <h3 className={`font-semibold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
          {result.success ? 'Import Successful!' : 'Import Completed with Errors'}
        </h3>
        <p className="text-slate-300 mt-1">Broker: {result.broker}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-700 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-white">{result.transactionsImported}</p>
          <p className="text-sm text-slate-400">Transactions</p>
        </div>
        <div className="bg-slate-700 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-white">{result.positionsCreated}</p>
          <p className="text-sm text-slate-400">Positions</p>
        </div>
        <div className="bg-slate-700 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-white">{result.securitiesCreated}</p>
          <p className="text-sm text-slate-400">Securities</p>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="bg-slate-700 rounded-lg p-4">
          <h4 className="font-medium text-yellow-400 mb-2">Warnings ({result.errors.length})</h4>
          <ul className="text-sm text-slate-300 space-y-1 max-h-32 overflow-y-auto">
            {result.errors.slice(0, 10).map((error) => (
              <li key={error}>• {error}</li>
            ))}
            {result.errors.length > 10 && (
              <li className="text-slate-400">...and {result.errors.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md transition-colors"
      >
        Close
      </button>
    </div>
  );
}
