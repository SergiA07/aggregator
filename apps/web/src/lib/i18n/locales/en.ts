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
 * - import: Import modal
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
    total: 'Total',
    tryAgain: 'Try again',
    goToDashboard: 'Go to Dashboard',
    showDetails: 'Show error details',
    pleaseWait: 'Please wait...',
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
    signUp: 'Sign Up',
    signOut: 'Sign Out',
    signingOut: 'Signing out...',
    email: 'Email',
    password: 'Password',
    authFailed: 'Authentication failed',
    signOutFailed: 'Failed to sign out',
    hasAccount: 'Already have an account? Sign In',
    noAccount: "Don't have an account? Sign Up",
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
    loadError: 'Failed to load portfolio summary. Please try refreshing the page.',
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
    count: dt('{count:plural}', {
      count: {
        one: '{?} transaction',
        other: '{?} transactions',
      },
    }),
    showing: dt('(showing {shown:number} of {total:number})', {
      shown: {},
      total: {},
    }),
  },

  // =========================================================================
  // IMPORT MODAL
  // =========================================================================
  import: {
    title: 'Import Data',
    description: 'Upload your broker CSV file to import transactions.',
    importType: 'Import Type',
    investmentAccount: 'Investment Account',
    bankAccount: 'Bank Account',
    selectBroker: 'Select Broker/Bank',
    howToExport: dt('How to export from {broker}:', { broker: {} }),
    importMethod: 'Import Method',
    uploadFile: 'Upload File',
    pasteCSV: 'Paste CSV',
    clickToUpload: 'Click to upload CSV file',
    dragAndDrop: 'or drag and drop',
    pasteHere: 'Paste your CSV content here...',
    importing: 'Importing...',
    importData: 'Import Data',

    // Validation
    validating: 'Validating...',
    validFormat: dt('Valid {broker} format', { broker: {} }),
    validCSV: 'Valid CSV format',
    formatWithWarnings: dt('{broker} format with warnings', { broker: {} }),
    csvWithWarnings: 'CSV format with warnings',
    invalidFile: 'Invalid file',
    rows: 'rows',
    errors: 'Errors:',
    warnings: 'Warnings:',

    // Preview
    hidePreview: 'Hide preview',
    showPreview: dt('Preview ({shown:number} of {total:number} rows)', {
      shown: {},
      total: {},
    }),
    moreColumns: dt('+{count:number} more', { count: {} }),

    // Result
    success: 'Import Successful!',
    completedWithErrors: 'Import Completed with Errors',
    broker: dt('Broker: {name}', { name: {} }),
    transactionsCount: 'Transactions',
    positionsCount: 'Positions',
    securitiesCount: 'Securities',
    warningsCount: dt('Warnings ({count:number})', { count: {} }),
    andMore: dt('...and {count:number} more', { count: {} }),
  },

  // =========================================================================
  // ERRORS
  // =========================================================================
  errors: {
    generic: 'Something went wrong. Please try again.',
    unexpected: 'An unexpected error occurred',
    notFound: 'Page not found',
    unauthorized: 'You must be signed in to view this page.',
    network: 'Network error. Please check your connection.',
    failedToLoad: dt('Failed to load {page}', { page: {} }),
  },

  // =========================================================================
  // LANGUAGES
  // =========================================================================
  languages: {
    en: 'English',
    es: 'Spanish',
    ca: 'Catalan',
  },
} as const;

// Export the type for use in other files
export type EnglishTranslations = typeof en;
