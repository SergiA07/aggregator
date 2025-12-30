/**
 * Spanish Translations
 *
 * This file should mirror the structure of en.ts.
 * Missing keys will fall back to English.
 */

import { dt } from '../define';
import type { I18nMessages } from '../types';

// Spanish translations - structure mirrors en.ts but values are translated
export const es: I18nMessages = {
  // =========================================================================
  // COMMON UI ELEMENTS
  // =========================================================================
  common: {
    appName: 'Agregador de Portafolio',
    loading: 'Cargando...',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    close: 'Cerrar',
    confirm: 'Confirmar',
    search: 'Buscar',
    filter: 'Filtrar',
    all: 'Todos',
    currency: 'Moneda',
  },

  // =========================================================================
  // NAVIGATION
  // =========================================================================
  nav: {
    overview: 'Resumen',
    positions: 'Posiciones',
    transactions: 'Transacciones',
  },

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================
  auth: {
    signIn: 'Iniciar Sesion',
    signOut: 'Cerrar Sesion',
    signingOut: 'Cerrando sesion...',
    email: 'Correo electronico',
    password: 'Contrasena',
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
    title: 'Panel',
    totalValue: 'Valor Total',
    totalCost: 'Costo Total',
    totalPnl: 'G/P Total',
    return: 'Retorno',
    accounts: {
      title: 'Cuentas de Inversion',
      empty: {
        title: 'Sin cuentas aun',
        description:
          'Usa el boton Importar en el encabezado para agregar tu primera cuenta de corretaje.',
      },
      error: 'Error al cargar las cuentas. Por favor, actualiza la pagina.',
      mainAccount: 'Cuenta Principal',
    },
    recentTransactions: 'Transacciones Recientes',
  },

  // =========================================================================
  // POSITIONS
  // =========================================================================
  positions: {
    title: 'Posiciones',
    table: {
      symbol: 'Simbolo',
      name: 'Nombre',
      quantity: 'Cant.',
      avgCost: 'Costo Prom.',
      price: 'Precio',
      value: 'Valor',
      pnl: 'G/P',
      pnlPercent: 'G/P %',
      account: 'Cuenta',
      total: 'Total',
    },
    empty: {
      title: 'Sin posiciones aun',
      description:
        'Importa los datos CSV de tu broker para ver tus tenencias y rendimiento del portafolio.',
    },
    error: 'Error al cargar posiciones',
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
      fee: 'Comision',
      split: 'Split',
      other: 'Otro',
    },
    table: {
      date: 'Fecha',
      type: 'Tipo',
      symbol: 'Simbolo',
      name: 'Nombre',
      quantity: 'Cant.',
      price: 'Precio',
      amount: 'Monto',
      fees: 'Comisiones',
      account: 'Cuenta',
    },
    empty: {
      title: 'Sin transacciones aun',
      description:
        'Importa los datos CSV de tu broker para comenzar a rastrear tus transacciones de inversion.',
    },
    error: 'Error al cargar transacciones',
    count: dt('{count:plural}', {
      count: {
        one: '{?} transaccion',
        other: '{?} transacciones',
      },
    }),
    showing: dt('mostrando {shown:number} de {total:number}', {
      shown: {},
      total: {},
    }),
  },

  // =========================================================================
  // IMPORT
  // =========================================================================
  import: {
    title: 'Importar Datos',
    description: 'Sube tu archivo CSV del broker para importar transacciones.',
    selectBroker: 'Seleccionar broker',
    selectFile: 'Seleccionar archivo',
    dropzone: 'Arrastra tu archivo CSV aqui o haz clic para buscar',
    importing: 'Importando...',
    success: 'Importacion exitosa!',
    error: 'Importacion fallida. Por favor, verifica el formato del archivo.',
  },

  // =========================================================================
  // ERRORS
  // =========================================================================
  errors: {
    generic: 'Algo salio mal. Por favor, intenta de nuevo.',
    notFound: 'Pagina no encontrada',
    unauthorized: 'Debes iniciar sesion para ver esta pagina.',
    network: 'Error de red. Por favor, verifica tu conexion.',
  },
} as const;
