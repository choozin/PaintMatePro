import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { type Quote } from '@/lib/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export function useAllQuotes() {
    const { currentOrgId } = useAuth();

    return useQuery({
        queryKey: ['all-quotes', currentOrgId],
        queryFn: async () => {
            if (!currentOrgId) return [];

            try {
                // Query the root 'quotes' collection directly
                const quotesQuery = query(
                    collection(db, 'quotes'),
                    where('orgId', '==', currentOrgId)
                );

                const snapshot = await getDocs(quotesQuery);
                const quotes = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as (Quote & { id: string })[];

                // Sort by createdAt desc in memory
                return quotes.sort((a, b) => {
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeB - timeA;
                });
            } catch (error) {
                console.error("Error fetching all quotes:", error);
                throw error;
            }
        },
        enabled: !!currentOrgId
    });
}
