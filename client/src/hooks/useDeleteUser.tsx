import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '@/contexts/AuthContext';

const functions = getFunctions();
const deleteUserCallable = httpsCallable(functions, 'deleteUser');

async function deleteUser(data: { userId: string; orgId: string }) {
  const result = await deleteUserCallable(data);
  return result.data;
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const { claims } = useAuth();
  const orgId = claims?.orgIds[0];

  return useMutation({
    mutationFn: (userId: string) => deleteUser({ userId, orgId: orgId! }),
    onSuccess: () => {
      // Invalidate and refetch the users query to update the list
      queryClient.invalidateQueries({ queryKey: ['users', orgId] });
    },
  });
}
