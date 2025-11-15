import { clientOperations, type Client } from '@/lib/firestore';
import {
  useFirestoreCollection,
  useFirestoreDocument,
  useCreateFirestoreDocument,
  useUpdateFirestoreDocument,
  useDeleteFirestoreDocument,
} from './useFirestoreCrud';

export function useClients() {
  return useFirestoreCollection<Client>('clients', clientOperations, ['clients']);
}

export function useClient(id: string | null) {
  return useFirestoreDocument<Client>('clients', clientOperations, id);
}

export function useCreateClient() {
  return useCreateFirestoreDocument<Client>('clients', clientOperations);
}

export function useUpdateClient() {
  return useUpdateFirestoreDocument<Client>('clients', clientOperations);
}

export function useDeleteClient() {
  return useDeleteFirestoreDocument('clients', clientOperations);
}
