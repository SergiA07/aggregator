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
    more: 'Més opcions',
  },

  // =========================================================================
  // NAVIGATION
  // =========================================================================
  nav: {
    overview: 'Resum',
    dashboard: 'Tauler',
    investments: 'Inversions',
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
  // OVERVIEW PAGE
  // =========================================================================
  overview: {
    loadError: 'Error en carregar el resum. Si us plau, actualitzeu la pàgina.',
    netWorth: {
      title: 'Patrimoni Net',
      cash: 'Efectiu',
      invested: 'Invertit',
      pnl: 'G/P no realitzada',
    },
    stats: {
      cash: 'Efectiu',
      invested: 'Invertit',
      unrealizedPnl: 'G/P no realitzada',
      ytdChange: 'Canvi YTD',
      accounts: 'Comptes',
    },
    allocation: {
      byType: 'Distribució per tipus',
      byInstitution: 'Distribució per institució',
    },
    accountType: {
      broker: 'Bròker',
      bank: 'Banc',
      pension: 'Pensió',
      crypto: 'Cripto',
      real_estate: 'Immobiliari',
      other: 'Altre',
    },
    accounts: {
      title: 'Tots els comptes',
      empty: 'Sense comptes encara. Importeu el vostre primer compte per començar.',
      loadError: 'Error en carregar els comptes.',
      inactive: 'Inactiu',
      lastUpdate: 'Actualitzat',
      updateBalance: 'Actualitzar saldo',
      importCSV: 'Importar CSV',
    },
    activity: {
      title: 'Activitat recent',
      empty: 'Sense activitat recent.',
      loadError: "Error en carregar l'activitat recent.",
    },
  },

  // =========================================================================
  // INVESTMENTS
  // =========================================================================
  investments: {
    title: 'Inversions',
    tabs: {
      positions: 'Posicions',
      accounts: 'Comptes',
    },
    accounts: {
      loadError: 'Error en carregar els comptes.',
      empty: 'Encara no hi ha comptes de bróker. Importa el teu primer compte per començar.',
      totalInvested: 'Total invertit',
      unrealizedPnl: 'G/P no realitzat',
      ytdChange: 'Canvi YTD',
      ytdPercent: 'YTD %',
      lastUpdate: 'Actualitzat',
      totalValue: 'Total',
      change: 'Canvi',
      allTime: 'Tot',
    },
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
  // ADD DATA MODAL (formerly Import Modal)
  // =========================================================================
  addData: {
    title: 'Afegir dades',
    description: 'Importeu del vostre bròker o afegiu un compte manual.',

    // Data source selection
    dataSource: 'Origen de dades',
    importFromBroker: 'Importar de Bròker/Banc',
    importFromBrokerDesc: 'Pujar CSV o sincronitzar via API',
    manualAccount: 'Compte manual',
    manualAccountDesc: 'Fons de pensions, efectiu, etc.',

    // Import type
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
    syncViaAPI: 'Sincronitzar via API (Recomanat)',

    // Manual account form
    accountType: 'Tipus de compte',
    pensionFund: 'Fons de pensions',
    pensionFundDesc: 'Caser, Indexa, etc.',
    otherAccount: 'Altre',
    otherAccountDesc: 'Efectiu a casa, etc.',
    pensionProvider: 'Gestor del fons',
    selectProvider: 'Seleccionar gestor',
    providerName: 'Nom del gestor',
    enterProviderName: 'Introduïu el nom del gestor',
    accountName: 'Nom del compte',
    accountNamePlaceholder: 'Ex. Pla de Pensions',
    otherAccountNamePlaceholder: 'Ex. Efectiu casa',
    institutionLabel: 'Descripció',
    institutionPlaceholder: 'Ex. Efectiu a casa, Caixa forta',
    notes: 'Notes (opcional)',
    notesPlaceholder: 'Notes addicionals...',
    createAccount: 'Crear compte',
    creating: 'Creant...',

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
    accountCreated: 'Compte creat!',
    completedWithErrors: 'Importació completada amb errors',
    broker: dt('Bròker: {name}', { name: {} }),
    transactionsCount: 'Transaccions',
    positionsCount: 'Posicions',
    securitiesCount: 'Valors',
    warningsCount: dt('Advertències ({count:number})', { count: {} }),
    andMore: dt('...i {count:number} més', { count: {} }),
  },

  // Keep 'import' for backwards compatibility
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
  // VALUATION MODAL
  // =========================================================================
  valuation: {
    title: 'Actualitzar valoració',
    description: dt('Introduïu el valor actual de {name}', { name: {} }),
    currentValue: dt('Valor actual: {value}', { value: {} }),
    amount: dt('Valor actual ({currency})', { currency: {} }),
    date: 'Data de valoració',
    notes: 'Notes (opcional)',
    notesPlaceholder: 'Ex. Actualització mensual, revisió de rendiment...',
    save: 'Desar valoració',
    saving: 'Desant...',
    valued: 'Valorat',
    ytd: 'YTD',
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
  // TABLE PAGINATION
  // =========================================================================
  table: {
    pagination: {
      showing: dt('Mostrant {from:number}-{to:number} de {total:number}', {
        from: {},
        to: {},
        total: {},
      }),
      rowsPerPage: 'Files per pàgina',
      page: dt('Pàgina {current:number} de {total:number}', { current: {}, total: {} }),
      goToFirst: 'Anar a la primera pàgina',
      goToPrevious: 'Anar a la pàgina anterior',
      goToNext: 'Anar a la pàgina següent',
      goToLast: 'Anar a la última pàgina',
    },
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
