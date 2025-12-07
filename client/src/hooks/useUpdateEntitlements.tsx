import { useMutation, useQueryClient } from '@tanstack/react-query';
import { entitlementOperations } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';
import type { Entitlement } from '@/lib/firestore';

export function useUpdateEntitlements() {
  const queryClient = useQueryClient();
  const { refetchEntitlements, org } = useAuth(); // Keep refetch for the current user's entitlements

  return useMutation({
    mutationFn: ({ orgId, featureKey, value }: { orgId: string; featureKey: string; value: boolean }) => {
      return entitlementOperations.update(orgId, featureKey, value);
    },
    onSuccess: (data, variables) => {
      // Invalidate the specific entitlements query for the updated org
      queryClient.invalidateQueries({ queryKey: ['entitlements', variables.orgId] });
      // If the updated org is the current user's org, also refetch the AuthContext entitlements
      // This is important for the user's own view to update
      if (org?.id === variables.orgId) {
        refetchEntitlements();
      }
    },
  });
}
