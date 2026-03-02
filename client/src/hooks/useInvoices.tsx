import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { type Invoice, invoiceOperations } from '@/lib/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export function useInvoices() {
    const { currentOrgId } = useAuth();

    return useQuery({
        queryKey: ['invoices', currentOrgId],
        queryFn: async () => {
            if (!currentOrgId) return [];

            try {
                const invoicesQuery = query(
                    collection(db, 'invoices'),
                    where('orgId', '==', currentOrgId)
                );

                const snapshot = await getDocs(invoicesQuery);
                const invoices = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as (Invoice & { id: string })[];

                // Sort by createdAt desc in memory
                return invoices.sort((a, b) => {
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeB - timeA;
                });
            } catch (error) {
                console.error("Error fetching invoices:", error);
                throw error;
            }
        },
        enabled: !!currentOrgId
    });
}

export function useProjectInvoices(projectId: string | undefined) {
    return useQuery({
        queryKey: ['invoices', 'project', projectId],
        queryFn: async () => {
            if (!projectId) return [];
            return invoiceOperations.getByProject(projectId);
        },
        enabled: !!projectId
    });
}

export function useClientInvoices(clientId: string | undefined) {
    return useQuery({
        queryKey: ['invoices', 'client', clientId],
        queryFn: async () => {
            if (!clientId) return [];
            return invoiceOperations.getByClient(clientId);
        },
        enabled: !!clientId
    });
}

export function useCreateInvoice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => {
            return invoiceOperations.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
    });
}

export function useUpdateInvoice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Invoice> }) => {
            return invoiceOperations.update(id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
    });
}
