const DELIMITERS = [',', ';', '\t'] as const;
export type Delimiter = (typeof DELIMITERS)[number];
export { DELIMITERS };

const DELIMITER_NAMES: Record<Delimiter, string> = {
  ',': 'comma',
  ';': 'semicolon',
  '\t': 'tab',
};

export function getDelimiterName(delimiter: Delimiter): string {
  return DELIMITER_NAMES[delimiter];
}

export const BROKERS = {
  DEGIRO: 'degiro',
  TRADE_REPUBLIC: 'trade-republic',
  SABADELL: 'sabadell',
} as const;

export type BrokerId = (typeof BROKERS)[keyof typeof BROKERS];

export interface BrokerInfo {
  name: string;
  description: string;
  instructions: string[];
  type: 'investment' | 'bank';
}

export const BROKER_INFO: Record<BrokerId, BrokerInfo> = {
  [BROKERS.DEGIRO]: {
    name: 'DeGiro',
    description: 'Export transactions from DeGiro web platform',
    type: 'investment',
    instructions: [
      'Log in to DeGiro',
      'Go to Activity → Transactions',
      'Click "Export" and select CSV format',
      'Upload the downloaded file',
    ],
  },
  [BROKERS.TRADE_REPUBLIC]: {
    name: 'Trade Republic',
    description: 'Export from Trade Republic app or web',
    type: 'investment',
    instructions: [
      'Open Trade Republic',
      'Go to your profile settings',
      'Request data export (CSV format)',
      'Upload the exported file',
    ],
  },
  [BROKERS.SABADELL]: {
    name: 'Sabadell Bank',
    description: 'Export bank transactions from Sabadell Online',
    type: 'bank',
    instructions: [
      'Log in to Sabadell Online Banking',
      'Go to Accounts → Movements',
      'Select date range and click Export',
      'Choose TXT or CSV format',
      'Upload the downloaded file',
    ],
  },
};

export function formatBrokerName(brokerId: string): string {
  return BROKER_INFO[brokerId as BrokerId]?.name || brokerId;
}

export function getBrokersByType(type: 'investment' | 'bank'): BrokerId[] {
  return (Object.entries(BROKER_INFO) as [BrokerId, BrokerInfo][])
    .filter(([, info]) => info.type === type)
    .map(([id]) => id);
}

export interface CSVParseResult {
  headers: string[];
  rows: string[][];
  totalRows: number;
  delimiter: Delimiter;
}
