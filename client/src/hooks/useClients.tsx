import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientOperations, type Client } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';

export function useClients() {
  const { claims } = useAuth();
  const orgId = claims?.orgIds?.[0];

  return useQuery({
    queryKey: ['clients', orgId],
    queryFn: () => {
      if (!orgId) throw new Error('No organization selected');
      return clientOperations.getByOrg(orgId);
    },
    enabled: !!orgId,
  });
}

export function useClient(id: string | null) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => {
      if (!id) throw new Error('No client ID provided');
      return clientOperations.get(id);
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  const { claims } = useAuth();
  const orgId = claims?.orgIds?.[0];

  return useMutation({
    mutationFn: async (data: Omit<Client, 'orgId' | 'createdAt' | 'updatedAt'>) => {
      if (!orgId) throw new Error('No organization selected');
      return clientOperations.create({ ...data, orgId });
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ['clients', orgId] });
      }
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  const { claims } = useAuth();
  const orgId = claims?.orgIds?.[0];

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Client> }) => {
      return clientOperations.update(id, data);
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ['clients', orgId] });
      }
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  const { claims } = useAuth();
  const orgId = claims?.orgIds?.[0];

  return useMutation({
    mutationFn: (id: string) => {
      return clientOperations.delete(id);
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ['clients', orgId] });
      }
    },
  });
}
