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
  },

  // =========================================================================
  // NAVIGATION
  // =========================================================================
  nav: {
    overview: 'Resumen',
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
  // IMPORT MODAL
  // =========================================================================
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
  // LANGUAGES
  // =========================================================================
  languages: {
    en: 'Inglés',
    es: 'Español',
    ca: 'Catalán',
  },
} as const;
