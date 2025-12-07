import { useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface CreateUserData {
    email: string;
    displayName: string;
    orgId: string;
    role: string;
}

async function createUser(userData: CreateUserData) {
    const usersRef = collection(db, 'users');
    const docRef = await addDoc(usersRef, {
        ...userData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
    return docRef.id;
}

export function useCreateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createUser,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['users', variables.orgId] });
        },
    });
}
