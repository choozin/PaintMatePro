import { roomOperations, type Room } from '@/lib/firestore';
import {
  useFirestoreCollection,
  useCreateFirestoreDocument,
  useUpdateFirestoreDocument,
  useDeleteFirestoreDocument,
} from './useFirestoreCrud';

export function useRooms(projectId: string | null) {
  return useFirestoreCollection<Room>(
    'rooms',
    roomOperations,
    ['rooms', projectId],
    (orgId) => {
      if (!projectId) throw new Error('No project ID provided');
      return roomOperations.getByProject(projectId);
    },
    !!projectId // enabled state
  );
}

export function useCreateRoom() {
  return useCreateFirestoreDocument<Room>(
    'rooms',
    roomOperations,
    // Invalidate rooms for the specific project after creation
    ['rooms', undefined] // projectId will be in variables.projectId
  );
}

export function useUpdateRoom() {
  return useUpdateFirestoreDocument<Room>(
    'rooms',
    roomOperations,
    // Invalidate rooms for the specific project after update
    ['rooms', undefined] // projectId will be in variables.projectId
  );
}

export function useDeleteRoom() {
  return useDeleteFirestoreDocument(
    'rooms',
    roomOperations,
    // Invalidate rooms for the specific project after deletion
    ['rooms', undefined] // projectId will be in variables.projectId
  );
}
