import { useAuth, type UserClaims } from '@/contexts/AuthContext';
import { orgOperations, type Org } from '@/lib/firestore';
import { useFirestoreCollection } from './useFirestoreCrud';

export interface OrgWithId extends Org {
  id: string;
}

export function useAllOrgs() {
  const { claims } = useAuth();
  const isOwner = claims?.role === 'owner';

  return useFirestoreCollection<Org>(
    'orgs',
    orgOperations,
    ['allOrgs'],
    undefined, // No custom queryFn needed, use operations.getAll
    isOwner, // Only fetch if the user is an owner
    true // fetchAll
  );
}
