/**
 * Import Mutation Hooks
 *
 * Mutations are different from queries - they CHANGE data instead of fetching it.
 * We use custom hooks here because mutations need access to queryClient for invalidation.
 *
 * USAGE:
 *   import { useUploadFile, useImportCSV } from '@/lib/api/queries/import';
 *
 *   const uploadMutation = useUploadFile();
 *   uploadMutation.mutate({ file, broker, type });
 *
 *   const importMutation = useImportCSV();
 *   importMutation.mutate({ content, broker, type });
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { accountKeys } from './accounts';
import { positionKeys } from './positions';
import { transactionKeys } from './transactions';

/**
 * Hook for uploading a file and importing its contents
 *
 * After successful import, invalidates all account, position, and transaction queries.
 */
export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      broker,
      type,
    }: {
      file: File;
      broker?: string;
      type?: 'investment' | 'bank';
    }) => api.uploadFile(file, broker, type),

    meta: {
      errorMessage: 'Failed to upload file',
      successMessage: 'File uploaded successfully',
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      queryClient.invalidateQueries({ queryKey: positionKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

/**
 * Hook for importing CSV content (pasted text)
 */
export function useImportCSV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { content: string; broker?: string; type?: 'investment' | 'bank' }) =>
      api.importCSV(params),

    meta: {
      errorMessage: 'Failed to import CSV',
      successMessage: 'CSV imported successfully',
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      queryClient.invalidateQueries({ queryKey: positionKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}
