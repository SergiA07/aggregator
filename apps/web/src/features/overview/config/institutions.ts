/**
 * Shared institution configuration for consistent display across the overview page.
 * Used by both the allocation charts and accounts list.
 */

export interface InstitutionConfig {
  /** Clean display name */
  displayName: string;
  /** Hex color for charts and indicators */
  color: string;
}

/**
 * Institution configuration map.
 * Colors are chosen to be visually distinct and accessible.
 */
export const INSTITUTION_CONFIG: Record<string, InstitutionConfig> = {
  degiro: {
    displayName: 'DeGiro',
    color: '#3b82f6', // Blue
  },
  ibkr: {
    displayName: 'Interactive Brokers',
    color: '#22c55e', // Green
  },
  'trade-republic': {
    displayName: 'Trade Republic',
    color: '#f97316', // Orange
  },
  sabadell: {
    displayName: 'Banc Sabadell',
    color: '#ec4899', // Pink
  },
  caser: {
    displayName: 'Caser',
    color: '#06b6d4', // Cyan
  },
  indexa: {
    displayName: 'Indexa Capital',
    color: '#8b5cf6', // Purple
  },
};

/** Default colors for institutions not in the config (cycled through) */
export const DEFAULT_COLORS = [
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#f97316', // Orange
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Purple
  '#eab308', // Yellow
  '#ef4444', // Red
];

/**
 * Get the display name for an institution
 */
export function getInstitutionDisplayName(institution: string): string {
  const config = INSTITUTION_CONFIG[institution.toLowerCase()];
  if (config) {
    return config.displayName;
  }
  // Capitalize first letter as fallback
  return institution.charAt(0).toUpperCase() + institution.slice(1);
}

/**
 * Get the color for an institution
 * @param institution - The institution key
 * @param fallbackIndex - Index to use for default color if not configured
 */
export function getInstitutionColor(institution: string, fallbackIndex = 0): string {
  const config = INSTITUTION_CONFIG[institution.toLowerCase()];
  if (config) {
    return config.color;
  }
  return DEFAULT_COLORS[fallbackIndex % DEFAULT_COLORS.length];
}

/**
 * Build a color map for a list of institutions (for charts)
 */
export function buildInstitutionColorMap(institutions: string[]): Map<string, string> {
  const colorMap = new Map<string, string>();
  let fallbackIndex = 0;

  for (const institution of institutions) {
    const key = institution.toLowerCase();
    const config = INSTITUTION_CONFIG[key];

    if (config) {
      colorMap.set(institution, config.color);
    } else {
      // Use next available default color
      colorMap.set(institution, DEFAULT_COLORS[fallbackIndex % DEFAULT_COLORS.length]);
      fallbackIndex++;
    }
  }

  return colorMap;
}

/**
 * Account type sort order: banks first, then brokers, then the rest
 */
export const ACCOUNT_TYPE_ORDER: Record<string, number> = {
  bank: 0,
  broker: 1,
  pension: 2,
  crypto: 3,
  real_estate: 4,
  other: 5,
};

/**
 * Get the sort order for an account type (lower = first)
 */
export function getAccountTypeSortOrder(type: string): number {
  return ACCOUNT_TYPE_ORDER[type] ?? 99;
}
