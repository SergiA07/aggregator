import Papa from 'papaparse';
import { type CSVParseResult, DELIMITERS, type Delimiter } from './csv-types';

const WORKER_FILE_SIZE_THRESHOLD = 5 * 1024 * 1024;

export const CSV_ERROR_TYPES = {
  EMPTY_FILE: 'empty_file',
  NO_HEADERS: 'no_headers',
  PARSE_ERROR: 'parse_error',
} as const;

export type CSVErrorType = (typeof CSV_ERROR_TYPES)[keyof typeof CSV_ERROR_TYPES];

const ERROR_MESSAGES: Record<CSVErrorType, string> = {
  [CSV_ERROR_TYPES.EMPTY_FILE]: 'File is empty or contains no data.',
  [CSV_ERROR_TYPES.NO_HEADERS]: 'Could not detect column headers.',
  [CSV_ERROR_TYPES.PARSE_ERROR]: 'Failed to parse CSV',
};

export interface CSVParseError {
  type: CSVErrorType;
  message: string;
}

function createError(type: CSVErrorType, customMessage?: string): CSVParseError {
  return {
    type,
    message: customMessage || ERROR_MESSAGES[type],
  };
}

/**
 * Parse CSV content string for preview (limited rows)
 * @param content - Raw CSV string content
 * @param maxRows - Maximum rows to parse for preview (default 20)
 */
export function parseCSV(content: string, maxRows = 20): CSVParseResult | CSVParseError {
  if (!content.trim()) {
    return createError(CSV_ERROR_TYPES.EMPTY_FILE);
  }

  const result = Papa.parse<string[]>(content, {
    header: false,
    skipEmptyLines: true,
    delimitersToGuess: [...DELIMITERS],
  });

  return processParseResult(result, maxRows);
}

/**
 * Parse CSV file directly using PapaParse
 * @param file - File object to parse
 * @param maxRows - Maximum rows to parse for preview (default 20)
 */
export function parseCSVFile(file: File, maxRows = 20): Promise<CSVParseResult | CSVParseError> {
  const useWorker = file.size > WORKER_FILE_SIZE_THRESHOLD;

  return new Promise((resolve) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      delimitersToGuess: [...DELIMITERS],
      worker: useWorker,
      complete: (result) => {
        resolve(processParseResult(result, maxRows));
      },
      error: (error) => {
        resolve(createError(CSV_ERROR_TYPES.PARSE_ERROR, error.message || 'Failed to read file'));
      },
    });
  });
}

function processParseResult(
  result: Papa.ParseResult<string[]>,
  maxRows: number,
): CSVParseResult | CSVParseError {
  if (result.errors.length > 0 && result.data.length === 0) {
    return createError(CSV_ERROR_TYPES.PARSE_ERROR, result.errors[0]?.message);
  }

  if (result.data.length === 0) {
    return createError(CSV_ERROR_TYPES.EMPTY_FILE);
  }

  const headers = result.data[0];

  if (!headers || headers.length === 0 || headers.every((h) => !h?.trim())) {
    return createError(CSV_ERROR_TYPES.NO_HEADERS);
  }

  const trimmedHeaders = headers.map((h) => h?.trim() || '');
  const allRows = result.data.slice(1);
  const previewRows = allRows.slice(0, maxRows).map((row) => row.map((cell) => cell?.trim() || ''));
  const detectedDelimiter = (result.meta.delimiter as Delimiter) || ',';

  return {
    headers: trimmedHeaders,
    rows: previewRows,
    totalRows: allRows.length,
    delimiter: detectedDelimiter,
  };
}

/**
 * Check if parse result is an error
 */
export function isParseError(result: CSVParseResult | CSVParseError): result is CSVParseError {
  return 'type' in result && 'message' in result && !('headers' in result);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
