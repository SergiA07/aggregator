/**
 * Catalan Translations
 *
 * This file should mirror the structure of en.ts.
 * Missing keys will fall back to English.
 */

import { dt } from '../define';
import type { I18nMessages } from '../types';

export const ca: I18nMessages = {
  // =========================================================================
  // COMMON UI ELEMENTS
  // =========================================================================
  common: {
    appName: 'Agregador de Cartera',
    loading: 'Carregant...',
    save: 'Desar',
    cancel: 'Cancel·lar',
    delete: 'Eliminar',
    edit: 'Editar',
    close: 'Tancar',
    confirm: 'Confirmar',
    search: 'Cercar',
    filter: 'Filtrar',
    all: 'Tot',
    currency: 'Divisa',
    total: 'Total',
    tryAgain: 'Tornar-ho a provar',
    goToDashboard: 'Anar al Tauler',
    showDetails: "Mostrar detalls de l'error",
    pleaseWait: 'Si us plau, espereu...',
  },

  // =========================================================================
  // NAVIGATION
  // =========================================================================
  nav: {
    overview: 'Resum',
    positions: 'Posicions',
    transactions: 'Transaccions',
    collapse: 'Contreure',
    expand: 'Expandir',
    menu: 'Menú de navegació',
    openMenu: 'Obrir menú',
  },

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================
  auth: {
    signIn: 'Iniciar sessió',
    signUp: 'Registrar-se',
    signOut: 'Tancar sessió',
    signingOut: 'Tancant sessió...',
    email: 'Correu electrònic',
    password: 'Contrasenya',
    authFailed: "Error d'autenticació",
    signOutFailed: 'Error en tancar sessió',
    hasAccount: 'Ja tens compte? Inicia sessió',
    noAccount: "No tens compte? Registra't",
  },

  // =========================================================================
  // HEADER
  // =========================================================================
  header: {
    import: 'Importar',
  },

  // =========================================================================
  // DASHBOARD
  // =========================================================================
  dashboard: {
    title: 'Tauler de control',
    totalValue: 'Valor total',
    totalCost: 'Cost total',
    totalPnl: 'Guany/Pèrdua total',
    return: 'Rendibilitat',
    loadError: 'Error en carregar el resum de la cartera. Si us plau, actualitzeu la pàgina.',
    accounts: {
      title: "Comptes d'inversió",
      empty: {
        title: 'Sense comptes',
        description:
          'Utilitzeu el botó Importar a la capçalera per afegir el vostre primer compte de corretatge.',
      },
      error: 'Error en carregar els comptes. Si us plau, actualitzeu la pàgina.',
      mainAccount: 'Compte principal',
    },
    recentTransactions: 'Transaccions recents',
  },

  // =========================================================================
  // POSITIONS
  // =========================================================================
  positions: {
    title: 'Posicions',
    table: {
      symbol: 'Símbol',
      name: 'Nom',
      quantity: 'Quant.',
      avgCost: 'Cost mitjà',
      price: 'Preu',
      value: 'Valor',
      pnl: 'G/P',
      pnlPercent: 'G/P %',
      account: 'Compte',
      total: 'Total',
    },
    empty: {
      title: 'Sense posicions',
      description:
        'Importeu les dades CSV del vostre bròker per veure els vostres actius i el seu rendiment.',
    },
    error: 'Error en carregar les posicions',
  },

  // =========================================================================
  // TRANSACTIONS
  // =========================================================================
  transactions: {
    title: 'Transaccions',
    filterByType: 'Filtrar per tipus:',
    types: {
      buy: 'Compra',
      sell: 'Venda',
      dividend: 'Dividend',
      fee: 'Comissió',
      split: 'Divisió',
      other: 'Altre',
    },
    table: {
      date: 'Data',
      type: 'Tipus',
      symbol: 'Símbol',
      name: 'Nom',
      quantity: 'Quant.',
      price: 'Preu',
      amount: 'Import',
      fees: 'Comissions',
      account: 'Compte',
    },
    empty: {
      title: 'Sense transaccions',
      description:
        "Importeu les dades CSV del vostre bròker per començar a registrar les vostres transaccions d'inversió.",
    },
    error: 'Error en carregar les transaccions',
    count: dt('{count:plural}', {
      count: {
        one: '{?} transacció',
        other: '{?} transaccions',
      },
    }),
    showing: dt('(mostrant {shown:number} de {total:number})', {
      shown: {},
      total: {},
    }),
  },

  // =========================================================================
  // IMPORT MODAL
  // =========================================================================
  import: {
    title: 'Importar dades',
    description: 'Pugeu el fitxer CSV del vostre bròker per importar transaccions.',
    importType: "Tipus d'importació",
    investmentAccount: "Compte d'inversió",
    bankAccount: 'Compte bancari',
    selectBroker: 'Seleccionar bròker/banc',
    howToExport: dt('Com exportar des de {broker}:', { broker: {} }),
    importMethod: "Mètode d'importació",
    uploadFile: 'Pujar fitxer',
    pasteCSV: 'Enganxar CSV',
    clickToUpload: 'Feu clic per pujar un fitxer CSV',
    dragAndDrop: 'o arrossegueu i deixeu anar',
    pasteHere: 'Enganxeu el contingut CSV aquí...',
    importing: 'Important...',
    importData: 'Importar dades',

    // Validation
    validating: 'Validant...',
    validFormat: dt('Format {broker} vàlid', { broker: {} }),
    validCSV: 'Format CSV vàlid',
    formatWithWarnings: dt('Format {broker} amb advertències', { broker: {} }),
    csvWithWarnings: 'Format CSV amb advertències',
    invalidFile: 'Fitxer invàlid',
    rows: 'files',
    errors: 'Errors:',
    warnings: 'Advertències:',

    // Preview
    hidePreview: 'Amagar vista prèvia',
    showPreview: dt('Vista prèvia ({shown:number} de {total:number} files)', {
      shown: {},
      total: {},
    }),
    moreColumns: dt('+{count:number} més', { count: {} }),

    // Result
    success: 'Importació exitosa!',
    completedWithErrors: 'Importació completada amb errors',
    broker: dt('Bròker: {name}', { name: {} }),
    transactionsCount: 'Transaccions',
    positionsCount: 'Posicions',
    securitiesCount: 'Valors',
    warningsCount: dt('Advertències ({count:number})', { count: {} }),
    andMore: dt('...i {count:number} més', { count: {} }),
  },

  // =========================================================================
  // ERRORS
  // =========================================================================
  errors: {
    generic: 'Alguna cosa ha anat malament. Si us plau, torneu-ho a provar.',
    unexpected: "S'ha produït un error inesperat",
    notFound: 'Pàgina no trobada',
    unauthorized: 'Heu d iniciar sessió per veure aquesta pàgina.',
    network: 'Error de xarxa. Si us plau, comproveu la vostra connexió.',
    failedToLoad: dt('Error en carregar {page}', { page: {} }),
  },

  // =========================================================================
  // LANGUAGES
  // =========================================================================
  languages: {
    en: 'Anglès',
    es: 'Castellà',
    ca: 'Català',
  },
} as const;
