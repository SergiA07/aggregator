import { FILE_UPLOAD, formatMaxFileSize, isAllowedExtension } from '@repo/shared-types/validation';
import {
  BROKERS,
  type BrokerId,
  type CSVParseResult,
  formatBrokerName,
  getDelimiterName,
} from './csv-types';

const VALIDATION_ERROR_TYPES = {
  FILE_TOO_LARGE: 'file_too_large',
  INVALID_TYPE: 'invalid_type',
  EMPTY_FILE: 'empty_file',
  MISSING_COLUMNS: 'missing_columns',
  INVALID_STRUCTURE: 'invalid_structure',
  NO_HEADERS: 'no_headers',
  PARSE_ERROR: 'parse_error',
} as const;

type ValidationErrorType = (typeof VALIDATION_ERROR_TYPES)[keyof typeof VALIDATION_ERROR_TYPES];

const VALIDATION_WARNING_TYPES = {
  ENCODING: 'encoding',
  DELIMITER: 'delimiter',
  ROW_COUNT: 'row_count',
  BROKER_MISMATCH: 'broker_mismatch',
  NO_BROKER_DETECTED: 'no_broker_detected',
} as const;

type ValidationWarningType =
  (typeof VALIDATION_WARNING_TYPES)[keyof typeof VALIDATION_WARNING_TYPES];

export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  details?: string[];
}

export interface ValidationWarning {
  type: ValidationWarningType;
  message: string;
}

const CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'none'] as const;
export type BrokerConfidence = (typeof CONFIDENCE_LEVELS)[number];

export interface BrokerDetectionResult {
  broker: BrokerId | null;
  confidence: BrokerConfidence;
  matchedColumns: string[];
  missingColumns: string[];
}

export interface ValidationResult {
  isValid: boolean;
  detectedBroker: BrokerDetectionResult;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

const BROKER_COLUMNS: Partial<
  Record<
    BrokerId,
    {
      required: string[][];
      optional: string[][];
    }
  >
> = {
  [BROKERS.DEGIRO]: {
    required: [
      ['Fecha', 'Date'],
      ['Producto', 'Product'],
      ['ISIN', 'Código ISIN'],
    ],
    optional: [
      ['Número', 'Quantity', 'Cantidad'],
      ['Precio', 'Price'],
      ['Hora', 'Time'],
      ['Bolsa', 'Exchange', 'Bolsa de', 'Reference Exchange'],
      ['Valor', 'Value', 'Local Value', 'Valor local'],
      ['Costes de transacción', 'Transaction Costs', 'Transaction costs'],
      ['ID Orden', 'Order ID'],
    ],
  },
  [BROKERS.TRADE_REPUBLIC]: {
    required: [
      ['Date', 'Datum', 'Zeitpunkt'],
      ['Shares', 'Anzahl', 'Stück', 'Quantity'],
    ],
    optional: [
      ['Type', 'Art', 'Typ'],
      ['Name', 'Bezeichnung'],
      ['Symbol', 'Asset', 'Wertpapier'],
      ['ISIN'],
      ['Price', 'Preis', 'Kurs'],
      ['Value', 'Wert', 'Amount', 'Betrag'],
      ['Currency', 'Währung'],
    ],
  },
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim();
}

function headerMatches(header: string, alternatives: string[]): boolean {
  const normalized = normalizeHeader(header);
  return alternatives.some((alt) => normalizeHeader(alt) === normalized);
}

/**
 * Validate file size and type before reading
 */
export function validateFile(file: File): ValidationError | null {
  if (file.size > FILE_UPLOAD.MAX_SIZE) {
    return {
      type: VALIDATION_ERROR_TYPES.FILE_TOO_LARGE,
      message: `File too large. Maximum size is ${formatMaxFileSize()}.`,
    };
  }

  if (!isAllowedExtension(file.name)) {
    return {
      type: VALIDATION_ERROR_TYPES.INVALID_TYPE,
      message: `Invalid file type. Allowed extensions: ${FILE_UPLOAD.ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  return null;
}

/**
 * Detect broker from CSV headers
 */
export function detectBroker(headers: string[]): BrokerDetectionResult {
  let bestMatch: BrokerDetectionResult = {
    broker: null,
    confidence: 'none',
    matchedColumns: [],
    missingColumns: [],
  };

  for (const [brokerId, config] of Object.entries(BROKER_COLUMNS) as [
    BrokerId,
    NonNullable<(typeof BROKER_COLUMNS)[BrokerId]>,
  ][]) {
    const matchedRequired: string[] = [];
    const missingRequired: string[] = [];

    for (const alternatives of config.required) {
      const matched = headers.find((h) => headerMatches(h, alternatives));
      if (matched) {
        matchedRequired.push(matched);
      } else {
        missingRequired.push(alternatives[0]);
      }
    }

    let optionalMatches = 0;
    for (const alternatives of config.optional) {
      if (headers.some((h) => headerMatches(h, alternatives))) {
        optionalMatches++;
      }
    }

    const requiredRatio = matchedRequired.length / config.required.length;
    let confidence: BrokerConfidence = 'none';

    if (requiredRatio === 1) {
      confidence = optionalMatches >= 2 ? 'high' : 'medium';
    } else if (requiredRatio >= 0.5) {
      confidence = 'low';
    }

    if (
      confidence !== 'none' &&
      (bestMatch.confidence === 'none' || matchedRequired.length > bestMatch.matchedColumns.length)
    ) {
      bestMatch = {
        broker: brokerId,
        confidence,
        matchedColumns: matchedRequired,
        missingColumns: missingRequired,
      };
    }
  }

  return bestMatch;
}

/**
 * Validate CSV structure and detect broker
 */
export function validateCSVStructure(
  parsed: CSVParseResult,
  selectedBroker?: string,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (parsed.headers.length < 3) {
    errors.push({
      type: VALIDATION_ERROR_TYPES.INVALID_STRUCTURE,
      message: 'File appears to have too few columns. Check the delimiter.',
    });
  }

  if (parsed.totalRows === 0) {
    errors.push({
      type: VALIDATION_ERROR_TYPES.EMPTY_FILE,
      message: 'File contains headers but no data rows.',
    });
  }

  const detectedBroker = detectBroker(parsed.headers);

  if (detectedBroker.broker && detectedBroker.missingColumns.length > 0) {
    errors.push({
      type: VALIDATION_ERROR_TYPES.MISSING_COLUMNS,
      message: `Missing required columns for ${detectedBroker.broker}: ${detectedBroker.missingColumns.join(', ')}`,
      details: detectedBroker.missingColumns,
    });
  }

  if (detectedBroker.confidence === 'none') {
    warnings.push({
      type: VALIDATION_WARNING_TYPES.NO_BROKER_DETECTED,
      message: 'Could not auto-detect broker format. Please select manually.',
    });
  }

  if (selectedBroker && detectedBroker.broker && selectedBroker !== detectedBroker.broker) {
    warnings.push({
      type: VALIDATION_WARNING_TYPES.BROKER_MISMATCH,
      message: `Detected ${formatBrokerName(detectedBroker.broker)} format but ${formatBrokerName(selectedBroker)} is selected.`,
    });
  }

  if (parsed.delimiter !== ',') {
    warnings.push({
      type: VALIDATION_WARNING_TYPES.DELIMITER,
      message: `Using ${getDelimiterName(parsed.delimiter)} as delimiter instead of comma.`,
    });
  }

  if (parsed.totalRows > 1000) {
    warnings.push({
      type: VALIDATION_WARNING_TYPES.ROW_COUNT,
      message: `Large file with ${parsed.totalRows} rows. Import may take longer.`,
    });
  }

  return {
    isValid: errors.length === 0,
    detectedBroker,
    errors,
    warnings,
  };
}
