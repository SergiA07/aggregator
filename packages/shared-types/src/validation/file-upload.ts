/**
 * Shared file upload validation constants
 * Used by both frontend (csv-validator.ts) and backend (import.controller.ts)
 */

export const FILE_UPLOAD = {
  /** Maximum file size in bytes (10 MB) */
  MAX_SIZE: 10 * 1024 * 1024,

  /** Allowed file extensions */
  ALLOWED_EXTENSIONS: ['.csv', '.txt'] as const,

  /** Allowed MIME types for CSV/text files */
  ALLOWED_MIME_TYPES: [
    'text/csv',
    'text/plain',
    'application/csv',
    'application/vnd.ms-excel',
    'text/comma-separated-values',
  ] as const,
} as const;

export type AllowedExtension = (typeof FILE_UPLOAD.ALLOWED_EXTENSIONS)[number];
export type AllowedMimeType = (typeof FILE_UPLOAD.ALLOWED_MIME_TYPES)[number];

/** Format file size for display (e.g., "10 MB") */
export function formatMaxFileSize(): string {
  return `${FILE_UPLOAD.MAX_SIZE / (1024 * 1024)} MB`;
}

/** Check if extension is allowed */
export function isAllowedExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return FILE_UPLOAD.ALLOWED_EXTENSIONS.includes(ext as AllowedExtension);
}

/** Check if MIME type is allowed */
export function isAllowedMimeType(mimeType: string | undefined): boolean {
  if (!mimeType) return true; // Allow missing mime type (fallback to extension check)
  return FILE_UPLOAD.ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase() as AllowedMimeType);
}
