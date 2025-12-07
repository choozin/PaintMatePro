import { orgOperations, type Org } from '@/lib/firestore';
import { useFirestoreDocument } from './useFirestoreCrud';

export function useOrg(id: string | null) {
    return useFirestoreDocument<Org>('orgs', orgOperations, id);
}
