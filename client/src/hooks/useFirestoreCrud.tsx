import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getOrgDocs, getDocById, createDoc, updateDocument, deleteDocument } from '@/lib/firestore';
import { QueryConstraint } from 'firebase/firestore';

interface FirestoreOperations<T> {
  getByOrg?: (orgId: string, constraints?: QueryConstraint[]) => Promise<(T & { id: string })[]>;
  get?: (id: string) => Promise<(T & { id: string }) | null>;
  getAll?: () => Promise<(T & { id: string })[]>; // New method
  create?: (data: Omit<T, 'createdAt' | 'updatedAt'>) => Promise<string>;
  update?: (id: string, data: Partial<T>) => Promise<void>;
  delete?: (id: string) => Promise<void>;
}

// Generic hook to fetch a collection of documents for the current organization
export function useFirestoreCollection<T>(
  collectionName: string,
  operations: FirestoreOperations<T>,
  queryKey: (string | null | undefined)[], // Allow flexible query keys
  queryFn?: (orgId: string | undefined) => Promise<(T & { id: string })[]>, // Optional custom query function, orgId can be undefined
  enabled: boolean = true, // Allow overriding enabled state
  fetchAll: boolean = false // New parameter
) {
  const { currentOrgId: orgId } = useAuth();

  return useQuery({
    queryKey: queryKey,
    queryFn: () => {
      // If fetchAll is true, use getAll
      if (fetchAll) {
        if (!operations.getAll) throw new Error(`getAll not implemented for ${collectionName}`);
        return operations.getAll();
      }

      // If a custom queryFn is provided, use it
      if (queryFn) return queryFn(orgId || undefined);

      // Default to fetching by orgId
      if (!orgId) throw new Error('No organization selected');
      if (!operations.getByOrg) throw new Error(`getByOrg not implemented for ${collectionName}`);
      return operations.getByOrg(orgId);
    },
    enabled: enabled && (fetchAll || !!orgId || !!queryFn),
  });
}

// Generic hook to fetch a single document
export function useFirestoreDocument<T>(
  collectionName: string,
  operations: FirestoreOperations<T>,
  id: string | null
) {
  return useQuery({
    queryKey: [collectionName, id],
    queryFn: () => {
      if (!id) throw new Error(`No ${collectionName} ID provided`);
      if (!operations.get) throw new Error(`get not implemented for ${collectionName}`);
      return operations.get(id);
    },
    enabled: !!id && !!operations.get,
  });
}

// Generic hook to create a document
export function useCreateFirestoreDocument<T>(
  collectionName: string,
  operations: FirestoreOperations<T>,
  queryKeysToInvalidate: (string | null | undefined)[] = [] // New parameter
) {
  const queryClient = useQueryClient();
  const { currentOrgId: orgId } = useAuth();

  return useMutation({
    mutationFn: async (data: Omit<T, 'createdAt' | 'updatedAt' | 'orgId'>) => {
      if (!orgId) throw new Error('No organization selected');
      if (!operations.create) throw new Error(`create not implemented for ${collectionName}`);
      // The data passed to operations.create should include orgId
      return operations.create({ ...data, orgId } as Omit<T, 'createdAt' | 'updatedAt'>);
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: [collectionName, orgId] });
        queryKeysToInvalidate.forEach(key => {
          if (key) queryClient.invalidateQueries({ queryKey: [key] });
        });
      }
    },
  });
}

// Generic hook to update a document
export function useUpdateFirestoreDocument<T>(
  collectionName: string,
  operations: FirestoreOperations<T>,
  queryKeysToInvalidate: (string | null | undefined)[] = [] // New parameter
) {
  const queryClient = useQueryClient();
  const { currentOrgId: orgId } = useAuth();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<T> }) => {
      if (!operations.update) throw new Error(`update not implemented for ${collectionName}`);
      return operations.update(id, data);
    },
    onSuccess: (data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: [collectionName, orgId] });
        queryClient.invalidateQueries({ queryKey: [collectionName, variables.id] });
        queryKeysToInvalidate.forEach(key => {
          if (key) queryClient.invalidateQueries({ queryKey: [key] });
        });
      }
    },
  });
}

// Generic hook to delete a document
export function useDeleteFirestoreDocument<T>( // Add <T> here
  collectionName: string,
  operations: FirestoreOperations<T>, // Change from any to T
  queryKeysToInvalidate: (string | null | undefined)[] = [] // New parameter
) {
  const queryClient = useQueryClient();
  const { currentOrgId: orgId } = useAuth();

  return useMutation({
    mutationFn: (id: string) => {
      if (!operations.delete) throw new Error(`delete not implemented for ${collectionName}`);
      return operations.delete(id);
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: [collectionName, orgId] });
        queryKeysToInvalidate.forEach(key => {
          if (key) queryClient.invalidateQueries({ queryKey: [key] });
        });
      }
    },
  });
}
