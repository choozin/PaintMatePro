import { quoteOperations, type Quote } from '@/lib/firestore';
import {
  useFirestoreCollection,
  useFirestoreDocument,
  useCreateFirestoreDocument,
  useUpdateFirestoreDocument,
} from './useFirestoreCrud';

export function useQuotes(projectId: string | null) {
  return useFirestoreCollection<Quote>(
    'quotes',
    quoteOperations,
    ['quotes', projectId],
    (orgId) => {
      if (!projectId) throw new Error('No project ID provided');
      return quoteOperations.getByProject(projectId, orgId);
    },
    !!projectId // enabled state
  );
}

export function useQuote(id: string | null) {
  return useFirestoreDocument<Quote>('quotes', quoteOperations, id);
}

export function useCreateQuote() {
  return useCreateFirestoreDocument<Quote>(
    'quotes',
    quoteOperations,
    // Invalidate quotes for the specific project after creation
    ['quotes', undefined] // projectId will be in variables.projectId
  );
}

export function useUpdateQuote() {
  return useUpdateFirestoreDocument<Quote>(
    'quotes',
    quoteOperations,
    // Invalidate quotes for the specific project after update
    ['quotes', undefined] // projectId will be in variables.projectId
  );
}
