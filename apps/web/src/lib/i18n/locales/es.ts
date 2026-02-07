/**
 * Spanish Translations
 *
 * This file should mirror the structure of en.ts.
 * Missing keys will fall back to English.
 */

import { dt } from '../define';
import type { I18nMessages } from '../types';

export const es: I18nMessages = {
  // =========================================================================
  // COMMON UI ELEMENTS
  // =========================================================================
  common: {
    appName: 'Agregador de Cartera',
    loading: 'Cargando...',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    close: 'Cerrar',
    confirm: 'Confirmar',
    search: 'Buscar',
    filter: 'Filtrar',
    all: 'Todo',
    currency: 'Divisa',
    total: 'Total',
    tryAgain: 'Reintentar',
    goToDashboard: 'Ir al Panel',
    showDetails: 'Mostrar detalles del error',
    pleaseWait: 'Por favor, espere...',
    more: 'Más opciones',
  },

  // =========================================================================
  // NAVIGATION
  // =========================================================================
  nav: {
    overview: 'Resumen',
    dashboard: 'Panel',
    investments: 'Inversiones',
    positions: 'Posiciones',
    transactions: 'Transacciones',
    collapse: 'Contraer',
    expand: 'Expandir',
    menu: 'Menú de navegación',
    openMenu: 'Abrir menú',
  },

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================
  auth: {
    signIn: 'Iniciar sesión',
    signUp: 'Registrarse',
    signOut: 'Cerrar sesión',
    signingOut: 'Cerrando sesión...',
    email: 'Correo electrónico',
    password: 'Contraseña',
    authFailed: 'Error de autenticación',
    signOutFailed: 'Error al cerrar sesión',
    hasAccount: '¿Ya tienes cuenta? Inicia sesión',
    noAccount: '¿No tienes cuenta? Regístrate',
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
    title: 'Panel de control',
    totalValue: 'Valor total',
    totalCost: 'Coste total',
    totalPnl: 'Ganancia/Pérdida total',
    return: 'Rentabilidad',
    loadError: 'Error al cargar el resumen de la cartera. Por favor, actualice la página.',
    accounts: {
      title: 'Cuentas de inversión',
      empty: {
        title: 'Sin cuentas',
        description:
          'Use el botón Importar en la cabecera para añadir su primera cuenta de corretaje.',
      },
      error: 'Error al cargar las cuentas. Por favor, actualice la página.',
      mainAccount: 'Cuenta principal',
    },
    recentTransactions: 'Transacciones recientes',
  },

  // =========================================================================
  // OVERVIEW PAGE
  // =========================================================================
  overview: {
    loadError: 'Error al cargar el resumen. Por favor, actualice la página.',
    netWorth: {
      title: 'Patrimonio Neto',
      cash: 'Efectivo',
      invested: 'Invertido',
      pnl: 'G/P no realizada',
    },
    stats: {
      cash: 'Efectivo',
      invested: 'Invertido',
      unrealizedPnl: 'G/P no realizada',
      ytdChange: 'Cambio YTD',
      accounts: 'Cuentas',
    },
    allocation: {
      byType: 'Distribución por tipo',
      byInstitution: 'Distribución por institución',
    },
    accountType: {
      broker: 'Bróker',
      bank: 'Banco',
      pension: 'Pensión',
      crypto: 'Cripto',
      real_estate: 'Inmobiliario',
      other: 'Otro',
    },
    accounts: {
      title: 'Todas las cuentas',
      empty: 'Sin cuentas aún. Importe su primera cuenta para comenzar.',
      loadError: 'Error al cargar las cuentas.',
      inactive: 'Inactiva',
      lastUpdate: 'Actualizado',
      updateBalance: 'Actualizar saldo',
      importCSV: 'Importar CSV',
    },
    activity: {
      title: 'Actividad reciente',
      empty: 'Sin actividad reciente.',
      loadError: 'Error al cargar la actividad reciente.',
    },
  },

  // =========================================================================
  // INVESTMENTS
  // =========================================================================
  investments: {
    title: 'Inversiones',
    tabs: {
      positions: 'Posiciones',
      accounts: 'Cuentas',
    },
    accounts: {
      loadError: 'Error al cargar las cuentas.',
      empty: 'Sin cuentas de bróker aún. Importe su primera cuenta para comenzar.',
      totalInvested: 'Total invertido',
      unrealizedPnl: 'G/P no realizada',
      ytdChange: 'Cambio YTD',
      ytdPercent: 'YTD %',
      lastUpdate: 'Actualizado',
      totalValue: 'Total',
      change: 'Cambio',
      allTime: 'Todo',
    },
  },

  // =========================================================================
  // POSITIONS
  // =========================================================================
  positions: {
    title: 'Posiciones',
    table: {
      symbol: 'Símbolo',
      name: 'Nombre',
      quantity: 'Cant.',
      avgCost: 'Coste medio',
      price: 'Precio',
      value: 'Valor',
      pnl: 'G/P',
      pnlPercent: 'G/P %',
      account: 'Cuenta',
      total: 'Total',
    },
    empty: {
      title: 'Sin posiciones',
      description: 'Importe los datos CSV de su bróker para ver sus activos y su rendimiento.',
    },
    error: 'Error al cargar las posiciones',
  },

  // =========================================================================
  // TRANSACTIONS
  // =========================================================================
  transactions: {
    title: 'Transacciones',
    filterByType: 'Filtrar por tipo:',
    types: {
      buy: 'Compra',
      sell: 'Venta',
      dividend: 'Dividendo',
      fee: 'Comisión',
      split: 'División',
      other: 'Otro',
    },
    table: {
      date: 'Fecha',
      type: 'Tipo',
      symbol: 'Símbolo',
      name: 'Nombre',
      quantity: 'Cant.',
      price: 'Precio',
      amount: 'Importe',
      fees: 'Comisiones',
      account: 'Cuenta',
    },
    empty: {
      title: 'Sin transacciones',
      description:
        'Importe los datos CSV de su bróker para comenzar a registrar sus transacciones de inversión.',
    },
    error: 'Error al cargar las transacciones',
    count: dt('{count:plural}', {
      count: {
        one: '{?} transacción',
        other: '{?} transacciones',
      },
    }),
    showing: dt('(mostrando {shown:number} de {total:number})', {
      shown: {},
      total: {},
    }),
  },

  // =========================================================================
  // ADD DATA MODAL (formerly Import Modal)
  // =========================================================================
  addData: {
    title: 'Añadir datos',
    description: 'Importe desde su bróker o añada una cuenta manual.',

    // Data source selection
    dataSource: 'Origen de datos',
    importFromBroker: 'Importar de Bróker/Banco',
    importFromBrokerDesc: 'Subir CSV o sincronizar vía API',
    manualAccount: 'Cuenta manual',
    manualAccountDesc: 'Fondo de pensiones, efectivo, etc.',

    // Import type
    importType: 'Tipo de importación',
    investmentAccount: 'Cuenta de inversión',
    bankAccount: 'Cuenta bancaria',
    selectBroker: 'Seleccionar bróker/banco',
    howToExport: dt('Cómo exportar desde {broker}:', { broker: {} }),
    importMethod: 'Método de importación',
    uploadFile: 'Subir archivo',
    pasteCSV: 'Pegar CSV',
    clickToUpload: 'Haga clic para subir un archivo CSV',
    dragAndDrop: 'o arrastre y suelte',
    pasteHere: 'Pegue el contenido CSV aquí...',
    importing: 'Importando...',
    importData: 'Importar datos',
    syncViaAPI: 'Sincronizar vía API (Recomendado)',

    // Manual account form
    accountType: 'Tipo de cuenta',
    pensionFund: 'Fondo de pensiones',
    pensionFundDesc: 'Caser, Indexa, etc.',
    otherAccount: 'Otro',
    otherAccountDesc: 'Efectivo en casa, etc.',
    pensionProvider: 'Gestor del fondo',
    selectProvider: 'Seleccionar gestor',
    providerName: 'Nombre del gestor',
    enterProviderName: 'Introduzca el nombre del gestor',
    accountName: 'Nombre de la cuenta',
    accountNamePlaceholder: 'Ej. Plan de Pensiones',
    otherAccountNamePlaceholder: 'Ej. Efectivo casa',
    institutionLabel: 'Descripción',
    institutionPlaceholder: 'Ej. Efectivo en casa, Caja fuerte',
    notes: 'Notas (opcional)',
    notesPlaceholder: 'Notas adicionales...',
    createAccount: 'Crear cuenta',
    creating: 'Creando...',

    // Validation
    validating: 'Validando...',
    validFormat: dt('Formato {broker} válido', { broker: {} }),
    validCSV: 'Formato CSV válido',
    formatWithWarnings: dt('Formato {broker} con advertencias', { broker: {} }),
    csvWithWarnings: 'Formato CSV con advertencias',
    invalidFile: 'Archivo inválido',
    rows: 'filas',
    errors: 'Errores:',
    warnings: 'Advertencias:',

    // Preview
    hidePreview: 'Ocultar vista previa',
    showPreview: dt('Vista previa ({shown:number} de {total:number} filas)', {
      shown: {},
      total: {},
    }),
    moreColumns: dt('+{count:number} más', { count: {} }),

    // Result
    success: '¡Importación exitosa!',
    accountCreated: '¡Cuenta creada!',
    completedWithErrors: 'Importación completada con errores',
    broker: dt('Bróker: {name}', { name: {} }),
    transactionsCount: 'Transacciones',
    positionsCount: 'Posiciones',
    securitiesCount: 'Valores',
    warningsCount: dt('Advertencias ({count:number})', { count: {} }),
    andMore: dt('...y {count:number} más', { count: {} }),
  },

  // Keep 'import' for backwards compatibility
  import: {
    title: 'Importar datos',
    description: 'Suba el archivo CSV de su bróker para importar transacciones.',
    importType: 'Tipo de importación',
    investmentAccount: 'Cuenta de inversión',
    bankAccount: 'Cuenta bancaria',
    selectBroker: 'Seleccionar bróker/banco',
    howToExport: dt('Cómo exportar desde {broker}:', { broker: {} }),
    importMethod: 'Método de importación',
    uploadFile: 'Subir archivo',
    pasteCSV: 'Pegar CSV',
    clickToUpload: 'Haga clic para subir un archivo CSV',
    dragAndDrop: 'o arrastre y suelte',
    pasteHere: 'Pegue el contenido CSV aquí...',
    importing: 'Importando...',
    importData: 'Importar datos',

    // Validation
    validating: 'Validando...',
    validFormat: dt('Formato {broker} válido', { broker: {} }),
    validCSV: 'Formato CSV válido',
    formatWithWarnings: dt('Formato {broker} con advertencias', { broker: {} }),
    csvWithWarnings: 'Formato CSV con advertencias',
    invalidFile: 'Archivo inválido',
    rows: 'filas',
    errors: 'Errores:',
    warnings: 'Advertencias:',

    // Preview
    hidePreview: 'Ocultar vista previa',
    showPreview: dt('Vista previa ({shown:number} de {total:number} filas)', {
      shown: {},
      total: {},
    }),
    moreColumns: dt('+{count:number} más', { count: {} }),

    // Result
    success: '¡Importación exitosa!',
    completedWithErrors: 'Importación completada con errores',
    broker: dt('Bróker: {name}', { name: {} }),
    transactionsCount: 'Transacciones',
    positionsCount: 'Posiciones',
    securitiesCount: 'Valores',
    warningsCount: dt('Advertencias ({count:number})', { count: {} }),
    andMore: dt('...y {count:number} más', { count: {} }),
  },

  // =========================================================================
  // VALUATION MODAL
  // =========================================================================
  valuation: {
    title: 'Actualizar valoración',
    description: dt('Introduzca el valor actual de {name}', { name: {} }),
    currentValue: dt('Valor actual: {value}', { value: {} }),
    amount: dt('Valor actual ({currency})', { currency: {} }),
    date: 'Fecha de valoración',
    notes: 'Notas (opcional)',
    notesPlaceholder: 'Ej. Actualización mensual, revisión de rendimiento...',
    save: 'Guardar valoración',
    saving: 'Guardando...',
    valued: 'Valorado',
    ytd: 'YTD',
  },

  // =========================================================================
  // ERRORS
  // =========================================================================
  errors: {
    generic: 'Algo salió mal. Por favor, inténtelo de nuevo.',
    unexpected: 'Se produjo un error inesperado',
    notFound: 'Página no encontrada',
    unauthorized: 'Debe iniciar sesión para ver esta página.',
    network: 'Error de red. Por favor, compruebe su conexión.',
    failedToLoad: dt('Error al cargar {page}', { page: {} }),
  },

  // =========================================================================
  // TABLE PAGINATION
  // =========================================================================
  table: {
    pagination: {
      showing: dt('Mostrando {from:number}-{to:number} de {total:number}', {
        from: {},
        to: {},
        total: {},
      }),
      rowsPerPage: 'Filas por página',
      page: dt('Página {current:number} de {total:number}', { current: {}, total: {} }),
      goToFirst: 'Ir a la primera página',
      goToPrevious: 'Ir a la página anterior',
      goToNext: 'Ir a la página siguiente',
      goToLast: 'Ir a la última página',
    },
  },

  // =========================================================================
  // LANGUAGES
  // =========================================================================
  languages: {
    en: 'Inglés',
    es: 'Español',
    ca: 'Catalán',
  },
} as const;
