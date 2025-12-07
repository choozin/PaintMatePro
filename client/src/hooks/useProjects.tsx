import { projectOperations, type Project } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';
import {
  useFirestoreCollection,
  useFirestoreDocument,
  useCreateFirestoreDocument,
  useUpdateFirestoreDocument,
  useDeleteFirestoreDocument,
} from './useFirestoreCrud';

export function useProjects() {
  const { currentOrgId } = useAuth();
  return useFirestoreCollection<Project>('projects', projectOperations, ['projects', currentOrgId]);
}

export function useProject(id: string | null) {
  return useFirestoreDocument<Project>('projects', projectOperations, id);
}

export function useCreateProject() {
  return useCreateFirestoreDocument<Project>('projects', projectOperations);
}

export function useUpdateProject() {
  return useUpdateFirestoreDocument<Project>('projects', projectOperations);
}

export function useDeleteProject() {
  return useDeleteFirestoreDocument('projects', projectOperations);
}
