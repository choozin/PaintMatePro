import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  orgId: string;
}

async function fetchUsers(orgId: string): Promise<AppUser[]> {
  if (!orgId) {
    return [];
  }

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('orgId', '==', orgId));
  const querySnapshot = await getDocs(q);

  const users: AppUser[] = [];
  querySnapshot.forEach((doc) => {
    users.push({ uid: doc.id, ...doc.data() } as AppUser);
  });

  return users;
}

export function useUsers() {
  const { claims } = useAuth();
  const orgId = claims?.orgIds[0];

  return useQuery<AppUser[], Error>({
    queryKey: ['users', orgId],
    queryFn: () => fetchUsers(orgId!),
    enabled: !!orgId,
  });
}
