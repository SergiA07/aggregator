/**
 * English (Base) Translations
 *
 * This is the base translation file. All keys defined here must exist
 * in other language files (or they'll fall back to English).
 *
 * Organization:
 * - common: Shared UI elements (buttons, labels, etc.)
 * - nav: Navigation items
 * - auth: Authentication-related strings
 * - dashboard: Dashboard page
 * - positions: Positions page
 * - transactions: Transactions page
 * - errors: Error messages
 */

import { dt } from '../define';

export const en = {
  // =========================================================================
  // COMMON UI ELEMENTS
  // =========================================================================
  common: {
    appName: 'Portfolio Aggregator',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    confirm: 'Confirm',
    search: 'Search',
    filter: 'Filter',
    all: 'All',
    currency: 'Currency',
  },

  // =========================================================================
  // NAVIGATION
  // =========================================================================
  nav: {
    overview: 'Overview',
    positions: 'Positions',
    transactions: 'Transactions',
  },

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================
  auth: {
    signIn: 'Sign In',
    signOut: 'Sign Out',
    signingOut: 'Signing out...',
    email: 'Email',
    password: 'Password',
  },

  // =========================================================================
  // HEADER
  // =========================================================================
  header: {
    import: 'Import',
  },

  // =========================================================================
  // DASHBOARD
  // =========================================================================
  dashboard: {
    title: 'Dashboard',
    totalValue: 'Total Value',
    totalCost: 'Total Cost',
    totalPnl: 'Total P&L',
    return: 'Return',
    accounts: {
      title: 'Investment Accounts',
      empty: {
        title: 'No accounts yet',
        description: 'Use the Import button in the header to add your first brokerage account.',
      },
      error: 'Failed to load accounts. Please try refreshing the page.',
      mainAccount: 'Main Account',
    },
    recentTransactions: 'Recent Transactions',
  },

  // =========================================================================
  // POSITIONS
  // =========================================================================
  positions: {
    title: 'Positions',
    table: {
      symbol: 'Symbol',
      name: 'Name',
      quantity: 'Qty',
      avgCost: 'Avg Cost',
      price: 'Price',
      value: 'Value',
      pnl: 'P&L',
      pnlPercent: 'P&L %',
      account: 'Account',
      total: 'Total',
    },
    empty: {
      title: 'No positions yet',
      description: 'Import your broker CSV data to see your portfolio holdings and performance.',
    },
    error: 'Error loading positions',
  },

  // =========================================================================
  // TRANSACTIONS
  // =========================================================================
  transactions: {
    title: 'Transactions',
    filterByType: 'Filter by type:',
    types: {
      buy: 'Buy',
      sell: 'Sell',
      dividend: 'Dividend',
      fee: 'Fee',
      split: 'Split',
      other: 'Other',
    },
    table: {
      date: 'Date',
      type: 'Type',
      symbol: 'Symbol',
      name: 'Name',
      quantity: 'Qty',
      price: 'Price',
      amount: 'Amount',
      fees: 'Fees',
      account: 'Account',
    },
    empty: {
      title: 'No transactions yet',
      description: 'Import your broker CSV data to start tracking your investment transactions.',
    },
    error: 'Error loading transactions',
    // Example of plural usage
    count: dt('{count:plural}', {
      count: {
        one: '{?} transaction',
        other: '{?} transactions',
      },
    }),
    showing: dt('showing {shown:number} of {total:number}', {
      shown: {},
      total: {},
    }),
  },

  // =========================================================================
  // IMPORT
  // =========================================================================
  import: {
    title: 'Import Data',
    description: 'Upload your broker CSV file to import transactions.',
    selectBroker: 'Select broker',
    selectFile: 'Select file',
    dropzone: 'Drop your CSV file here or click to browse',
    importing: 'Importing...',
    success: 'Import successful!',
    error: 'Import failed. Please check your file format.',
  },

  // =========================================================================
  // ERRORS
  // =========================================================================
  errors: {
    generic: 'Something went wrong. Please try again.',
    notFound: 'Page not found',
    unauthorized: 'You must be signed in to view this page.',
    network: 'Network error. Please check your connection.',
  },

  // =========================================================================
  // FORMATTING (for reference, used with formatters)
  // =========================================================================
  formatting: {
    // Example of date formatting
    date: dt('Date: {value:date}', {
      value: { dateStyle: 'medium' },
    }),
    // Example of currency (though we use formatCurrency directly)
    currency: dt('{value:number}', {
      value: { style: 'currency', currency: 'USD' },
    }),
  },
} as const;

// Export the type for use in other files
export type EnglishTranslations = typeof en;
