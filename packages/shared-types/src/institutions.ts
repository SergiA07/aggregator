import type { AccountType } from './schemas/account';

/**
 * Institution configuration for supported brokers, banks, and other financial institutions.
 * Used across the application for institution selection, parser identification, and display.
 */
export interface Institution {
  /** Unique identifier (lowercase, hyphenated) */
  id: string;
  /** Display name */
  name: string;
  /** Account type category */
  type: AccountType;
  /** Country code (ISO 3166-1 alpha-2) or null for global */
  country: string | null;
  /** Whether a CSV/file parser exists for this institution */
  hasParser: boolean;
  /** Supported currencies for this institution */
  supportedCurrencies: string[];
  /** Optional instructions for exporting data */
  parserInstructions?: string;
  /** Optional logo URL or icon name */
  logoUrl?: string;
}

/**
 * Registry of all supported institutions.
 * Add new institutions here when adding parser support.
 */
export const INSTITUTIONS: Institution[] = [
  // Brokers
  {
    id: 'degiro',
    name: 'DeGiro',
    type: 'broker',
    country: 'NL',
    hasParser: true,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'CHF', 'DKK', 'SEK', 'NOK'],
    parserInstructions: 'Actividad > Estado de cuenta > Exportar CSV',
  },
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    type: 'broker',
    country: 'IE',
    hasParser: true,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'AUD', 'CAD'],
    parserInstructions: 'Reports > Statements > Activity',
  },
  {
    id: 'trade-republic',
    name: 'Trade Republic',
    type: 'broker',
    country: 'DE',
    hasParser: true,
    supportedCurrencies: ['EUR'],
    parserInstructions: 'Via pytr (Python library)',
  },

  // Banks
  {
    id: 'sabadell',
    name: 'Banco Sabadell',
    type: 'bank',
    country: 'ES',
    hasParser: true,
    supportedCurrencies: ['EUR'],
  },
  {
    id: 'bbva',
    name: 'BBVA',
    type: 'bank',
    country: 'ES',
    hasParser: false,
    supportedCurrencies: ['EUR'],
  },
  {
    id: 'pibank',
    name: 'Pibank',
    type: 'bank',
    country: 'ES',
    hasParser: false,
    supportedCurrencies: ['EUR'],
  },

  // Pension funds
  {
    id: 'caser',
    name: 'Caser Pensiones',
    type: 'pension',
    country: 'ES',
    hasParser: false,
    supportedCurrencies: ['EUR'],
    parserInstructions: 'Manual: Enter total value monthly',
  },

  // Other
  {
    id: 'manual',
    name: 'Manual Entry',
    type: 'other',
    country: null,
    hasParser: false,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'CHF'],
  },
];

/**
 * Get institution by ID
 */
export function getInstitution(id: string): Institution | undefined {
  return INSTITUTIONS.find((i) => i.id === id);
}

/**
 * Get institutions by type
 */
export function getInstitutionsByType(type: AccountType): Institution[] {
  return INSTITUTIONS.filter((i) => i.type === type);
}

/**
 * Get institutions that have parsers
 */
export function getInstitutionsWithParser(): Institution[] {
  return INSTITUTIONS.filter((i) => i.hasParser);
}

/**
 * Get all institution IDs
 */
export function getInstitutionIds(): string[] {
  return INSTITUTIONS.map((i) => i.id);
}

/**
 * Check if institution ID is valid
 */
export function isValidInstitution(id: string): boolean {
  return INSTITUTIONS.some((i) => i.id === id);
}
