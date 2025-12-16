import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { ImportResult } from '../lib/api';
import { api } from '../lib/api';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportType = 'investment' | 'bank';
type ImportMethod = 'file' | 'paste';

const BROKER_INFO = {
  degiro: {
    name: 'DeGiro',
    description: 'Export transactions from DeGiro web platform',
    instructions: [
      'Log in to DeGiro',
      'Go to Activity → Transactions',
      'Click "Export" and select CSV format',
      'Upload the downloaded file',
    ],
  },
  'trade-republic': {
    name: 'Trade Republic',
    description: 'Export from Trade Republic app or web',
    instructions: [
      'Open Trade Republic',
      'Go to your profile settings',
      'Request data export (CSV format)',
      'Upload the exported file',
    ],
  },
  sabadell: {
    name: 'Sabadell Bank',
    description: 'Export bank transactions from Sabadell Online',
    instructions: [
      'Log in to Sabadell Online Banking',
      'Go to Accounts → Movements',
      'Select date range and click Export',
      'Choose TXT or CSV format',
      'Upload the downloaded file',
    ],
  },
};

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [importType, setImportType] = useState<ImportType>('investment');
  const [importMethod, setImportMethod] = useState<ImportMethod>('file');
  const [selectedBroker, setSelectedBroker] = useState<string>('');
  const [pastedContent, setPastedContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async () => {
      if (importMethod === 'file' && selectedFile) {
        return api.uploadFile(selectedFile, selectedBroker || undefined, importType);
      }
      if (importMethod === 'paste' && pastedContent) {
        return api.importCSV({
          content: pastedContent,
          broker: selectedBroker || undefined,
          type: importType,
        });
      }
      throw new Error('No file or content provided');
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['positions-summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
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
    }
  };

  const handleImport = () => {
    importMutation.mutate();
  };

  const handleClose = () => {
    setResult(null);
    setSelectedFile(null);
    setPastedContent('');
    setSelectedBroker('');
    importMutation.reset();
    onClose();
  };

  if (!isOpen) return null;

  const brokers = importType === 'investment' ? ['degiro', 'trade-republic'] : ['sabadell'];

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
            // Result view
            <div className="space-y-4">
              <div
                className={`p-4 rounded-lg ${result.success ? 'bg-green-900/50 border border-green-700' : 'bg-red-900/50 border border-red-700'}`}
              >
                <h3
                  className={`font-semibold ${result.success ? 'text-green-400' : 'text-red-400'}`}
                >
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
                  <h4 className="font-medium text-yellow-400 mb-2">
                    Warnings ({result.errors.length})
                  </h4>
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
                onClick={handleClose}
                className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            // Import form
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
                  {brokers.map((broker) => {
                    const info = BROKER_INFO[broker as keyof typeof BROKER_INFO];
                    return (
                      <button
                        type="button"
                        key={broker}
                        onClick={() => setSelectedBroker(broker)}
                        className={`p-4 rounded-lg text-left transition-colors ${
                          selectedBroker === broker
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
              {selectedBroker && (
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-white mb-2">
                    How to export from{' '}
                    {BROKER_INFO[selectedBroker as keyof typeof BROKER_INFO]?.name}:
                  </h4>
                  <ol className="text-sm text-slate-300 space-y-1">
                    {BROKER_INFO[selectedBroker as keyof typeof BROKER_INFO]?.instructions.map(
                      (step, i) => (
                        <li key={step}>
                          {i + 1}. {step}
                        </li>
                      ),
                    )}
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
                        <p className="text-sm text-slate-400">Click to change file</p>
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

              {/* Error Message */}
              {importMutation.error && (
                <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
                  <p className="text-red-400">{(importMutation.error as Error).message}</p>
                </div>
              )}

              {/* Import Button */}
              <button
                type="button"
                onClick={handleImport}
                disabled={importMutation.isPending || (!selectedFile && !pastedContent)}
                className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
              >
                {importMutation.isPending ? 'Importing...' : 'Import Data'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
