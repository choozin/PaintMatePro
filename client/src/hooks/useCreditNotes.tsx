import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { creditNoteOperations, type CreditNote } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";

export function useCreditNotes() {
    const { currentOrgId } = useAuth();
    return useQuery({
        queryKey: ['credit_notes', currentOrgId],
        queryFn: async () => {
            if (!currentOrgId) return [];
            const notes = await creditNoteOperations.getByOrg(currentOrgId);
            return notes.sort((a, b) => {
                const da = a.createdAt?.toDate?.() || new Date(0);
                const db = b.createdAt?.toDate?.() || new Date(0);
                return db.getTime() - da.getTime();
            });
        },
        enabled: !!currentOrgId,
    });
}

export function useCreditNotesByInvoice(invoiceId?: string) {
    return useQuery({
        queryKey: ['credit_notes', 'invoice', invoiceId],
        queryFn: async () => {
            if (!invoiceId) return [];
            return creditNoteOperations.getByInvoice(invoiceId);
        },
        enabled: !!invoiceId,
    });
}

export function useCreateCreditNote() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Omit<CreditNote, 'id' | 'createdAt' | 'updatedAt'>) =>
            creditNoteOperations.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['credit_notes'] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
    });
}

export function useUpdateCreditNote() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<CreditNote> }) =>
            creditNoteOperations.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['credit_notes'] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
    });
}
