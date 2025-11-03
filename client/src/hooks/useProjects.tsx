import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectOperations, type Project } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';

export function useProjects() {
  const { claims } = useAuth();
  const orgId = claims?.orgIds?.[0];

  return useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => {
      if (!orgId) throw new Error('No organization selected');
      return projectOperations.getByOrg(orgId);
    },
    enabled: !!orgId,
  });
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => {
      if (!id) throw new Error('No project ID provided');
      return projectOperations.get(id);
    },
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { claims } = useAuth();
  const orgId = claims?.orgIds?.[0];

  return useMutation({
    mutationFn: async (data: Omit<Project, 'orgId' | 'createdAt' | 'updatedAt'>) => {
      if (!orgId) throw new Error('No organization selected');
      return projectOperations.create({ ...data, orgId });
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ['projects', orgId] });
      }
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const { claims } = useAuth();
  const orgId = claims?.orgIds?.[0];

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) => {
      return projectOperations.update(id, data);
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ['projects', orgId] });
      }
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { claims } = useAuth();
  const orgId = claims?.orgIds?.[0];

  return useMutation({
    mutationFn: (id: string) => {
      return projectOperations.delete(id);
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ['projects', orgId] });
      }
    },
  });
}
