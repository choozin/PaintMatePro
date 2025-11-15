import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '@/contexts/AuthContext';

const functions = getFunctions();
const updateUserRoleCallable = httpsCallable(functions, 'updateUserRole');

interface UpdateUserRolePayload {
  userId: string;
  orgId: string;
  role: 'org_owner' | 'org_admin' | 'member';
}

async function updateUserRole(payload: UpdateUserRolePayload) {
  const result = await updateUserRoleCallable(payload);
  return result.data;
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  const { currentOrgId } = useAuth();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'org_owner' | 'org_admin' | 'member' }) => {
      if (!currentOrgId) {
        throw new Error('Current organization ID not found.');
      }
      return updateUserRole({ userId, orgId: currentOrgId, role });
    },
    onSuccess: () => {
      // Invalidate and refetch the users query to update the list
      queryClient.invalidateQueries({ queryKey: ['users', currentOrgId] });
    },
  });
}
