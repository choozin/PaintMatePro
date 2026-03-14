import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from './src/lib/firebase';

async function findOrg() {
    const q = query(collection(db, 'orgs'), where('name', '==', 'Test Compliance Org'));
    const snap = await getDocs(q);
    if (snap.empty) {
        console.log('Org not found');
    } else {
        console.log('Org ID:', snap.docs[0].id);
    }
}

findOrg().catch(console.error);
