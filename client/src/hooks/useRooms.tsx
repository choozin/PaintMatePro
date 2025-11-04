import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomOperations, type Room } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';

export function useRooms(projectId: string | null) {
  return useQuery({
    queryKey: ['rooms', projectId],
    queryFn: () => {
      if (!projectId) throw new Error('No project ID provided');
      return roomOperations.getByProject(projectId);
    },
    enabled: !!projectId,
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  const { claims } = useAuth();
  const orgId = claims?.orgIds?.[0];

  return useMutation({
    mutationFn: async (data: Omit<Room, 'orgId' | 'createdAt'>) => {
      if (!orgId) throw new Error('No organization selected');
      return roomOperations.create({ ...data, orgId });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rooms', variables.projectId] });
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data, projectId }: { id: string; data: Partial<Room>; projectId: string }) => {
      return roomOperations.update(id, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rooms', variables.projectId] });
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId: string }) => {
      return roomOperations.delete(id);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rooms', variables.projectId] });
    },
  });
}
