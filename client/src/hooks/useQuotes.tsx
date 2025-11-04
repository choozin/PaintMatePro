import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quoteOperations, type Quote } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';

export function useQuotes(projectId: string | null) {
  return useQuery({
    queryKey: ['quotes', projectId],
    queryFn: () => {
      if (!projectId) throw new Error('No project ID provided');
      return quoteOperations.getByProject(projectId);
    },
    enabled: !!projectId,
  });
}

export function useQuote(id: string | null) {
  return useQuery({
    queryKey: ['quotes', id],
    queryFn: () => {
      if (!id) throw new Error('No quote ID provided');
      return quoteOperations.get(id);
    },
    enabled: !!id,
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  const { claims } = useAuth();
  const orgId = claims?.orgIds?.[0];

  return useMutation({
    mutationFn: async (data: Omit<Quote, 'orgId' | 'createdAt'>) => {
      if (!orgId) throw new Error('No organization selected');
      return quoteOperations.create({ ...data, orgId });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes', variables.projectId] });
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data, projectId }: { id: string; data: Partial<Quote>; projectId: string }) => {
      return quoteOperations.update(id, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes', variables.projectId] });
    },
  });
}
