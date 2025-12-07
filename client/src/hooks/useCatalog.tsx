import { useState, useEffect } from 'react';
import {
    collection,
    addDoc,
    updateDoc,
    setDoc,
    deleteDoc,
    doc,
    query,
    onSnapshot,
    serverTimestamp,
    orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { CatalogItem } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';

import { DEFAULT_CATALOG_ITEMS } from '@/lib/defaultCatalog';

export function useCatalog() {
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { currentOrgId } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        if (!currentOrgId) {
            setItems(DEFAULT_CATALOG_ITEMS);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'orgs', currentOrgId, 'catalogItems')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const firestoreItems = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as CatalogItem[];

            // Merge defaults with firestore items
            // Filter out defaults that have been overridden (exist in firestore)
            const firestoreIds = new Set(firestoreItems.map(item => item.id));
            const activeDefaults = DEFAULT_CATALOG_ITEMS.filter(item => !firestoreIds.has(item.id));

            setItems([...activeDefaults, ...firestoreItems]);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching catalog items:", error);
            console.error("Error code:", error.code);
            console.error("Error message:", error.message);
            toast({
                title: "Error",
                description: `Failed to load catalog items: ${error.message}`,
                variant: "destructive"
            });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentOrgId, toast]);

    const addItem = async (item: Omit<CatalogItem, 'id' | 'createdAt' | 'updatedAt'>) => {
        if (!currentOrgId) return;
        try {
            await addDoc(collection(db, 'orgs', currentOrgId, 'catalogItems'), {
                ...item,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            toast({ title: "Success", description: "Item added to catalog." });
        } catch (error) {
            console.error("Error adding item:", error);
            toast({ title: "Error", description: "Failed to add item.", variant: "destructive" });
            throw error;
        }
    };

    const updateItem = async (id: string, updates: Partial<CatalogItem>) => {
        if (!currentOrgId) return;
        try {
            const docRef = doc(db, 'orgs', currentOrgId, 'catalogItems', id);
            // Use setDoc with merge to handle both existing items and default items that haven't been saved yet
            await setDoc(docRef, {
                ...updates,
                updatedAt: serverTimestamp()
            }, { merge: true });
            toast({ title: "Success", description: "Item updated." });
        } catch (error) {
            console.error("Error updating item:", error);
            toast({ title: "Error", description: "Failed to update item.", variant: "destructive" });
            throw error;
        }
    };

    const deleteItem = async (id: string) => {
        if (!currentOrgId) return;
        try {
            await deleteDoc(doc(db, 'orgs', currentOrgId, 'catalogItems', id));
            toast({ title: "Success", description: "Item deleted." });
        } catch (error) {
            console.error("Error deleting item:", error);
            toast({ title: "Error", description: "Failed to delete item.", variant: "destructive" });
            throw error;
        }
    };

    return { items, loading, addItem, updateItem, deleteItem };
}
