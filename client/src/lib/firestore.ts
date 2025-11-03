import {
  collection,
  doc,
  getDoc,
  getDocs as getDocsFromFirestore,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  QueryConstraint,
  DocumentData,
  CollectionReference,
} from 'firebase/firestore';
import { db } from './firebase';

// Type definitions matching your Firestore schema
export interface Org {
  name: string;
  defaultUnits: 'metric' | 'imperial';
  plan: 'free' | 'pro' | 'enterprise';
  region: string;
}

export interface Entitlement {
  plan: string;
  features: {
    'capture.ar': boolean;
    'capture.reference': boolean;
    'capture.weeklyLimit': number;
    'visual.recolor': boolean;
    'visual.sheenSimulator': boolean;
    'portal.fullView': boolean;
    'portal.advancedActionsLocked': boolean;
    'analytics.lite': boolean;
    'analytics.drilldowns': boolean;
    'pdf.watermark': boolean;
    eSign: boolean;
    payments: boolean;
    scheduler: boolean;
  };
}

export interface Project {
  orgId: string;
  name: string;
  clientId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold';
  location: string;
  startDate: Timestamp;
  estimatedCompletion?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Client {
  orgId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Room {
  orgId: string;
  projectId: string;
  name: string;
  length: number;
  width: number;
  height: number;
  createdAt?: Timestamp;
}

export interface Quote {
  orgId: string;
  projectId: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unit: string;
    rate: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  validUntil: Timestamp;
  createdAt?: Timestamp;
}

export interface PortalToken {
  projectId: string;
  token: string;
  expiresAt: Timestamp;
  createdAt?: Timestamp;
}

// Generic collection helpers
function getCollection<T = DocumentData>(collectionName: string): CollectionReference<T> {
  return collection(db, collectionName) as CollectionReference<T>;
}

/**
 * Get a single document by ID
 * Returns the document data with id included
 */
export async function getDocById<T>(collectionName: string, id: string): Promise<(T & { id: string }) | null> {
  try {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as (T & { id: string });
    }
    return null;
  } catch (error) {
    console.error(`Error getting document from ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Get documents with optional filters
 * Returns array of documents with id included
 */
export async function getDocs<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<(T & { id: string })[]> {
  try {
    const q = query(getCollection<T>(collectionName), ...constraints);
    const querySnapshot = await getDocsFromFirestore(q);
    
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as (T & { id: string })[];
  } catch (error) {
    console.error(`Error getting documents from ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Get documents filtered by orgId
 * Returns array of documents with id included
 */
export async function getOrgDocs<T>(
  collectionName: string,
  orgId: string,
  additionalConstraints: QueryConstraint[] = []
): Promise<(T & { id: string })[]> {
  const constraints = [where('orgId', '==', orgId), ...additionalConstraints];
  return getDocs<T>(collectionName, constraints);
}

/**
 * Create a new document
 */
export async function createDoc<T>(
  collectionName: string,
  data: Partial<T>
): Promise<string> {
  try {
    const docRef = await addDoc(getCollection(collectionName), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Update an existing document
 */
export async function updateDocument<T>(
  collectionName: string,
  id: string,
  data: Partial<T>
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error(`Error updating document in ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Delete a document
 */
export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document from ${collectionName}:`, error);
    throw error;
  }
}

// Specific collection operations
export const orgOperations = {
  get: (id: string) => getDocById<Org>('orgs', id),
  update: (id: string, data: Partial<Org>) => updateDocument('orgs', id, data),
};

export const entitlementOperations = {
  get: (orgId: string) => getDocById<Entitlement>('entitlements', orgId),
};

export const projectOperations = {
  getByOrg: (orgId: string) => getOrgDocs<Project>('projects', orgId, [orderBy('createdAt', 'desc')]),
  get: (id: string) => getDocById<Project>('projects', id),
  create: (data: Omit<Project, 'createdAt' | 'updatedAt'>) => createDoc('projects', data),
  update: (id: string, data: Partial<Project>) => updateDocument('projects', id, data),
  delete: (id: string) => deleteDocument('projects', id),
};

export const clientOperations = {
  getByOrg: (orgId: string) => getOrgDocs<Client>('clients', orgId, [orderBy('createdAt', 'desc')]),
  get: (id: string) => getDocById<Client>('clients', id),
  create: (data: Omit<Client, 'createdAt' | 'updatedAt'>) => createDoc('clients', data),
  update: (id: string, data: Partial<Client>) => updateDocument('clients', id, data),
  delete: (id: string) => deleteDocument('clients', id),
};

export const roomOperations = {
  getByProject: (projectId: string) => 
    getDocs<Room>('rooms', [where('projectId', '==', projectId)]),
  create: (data: Omit<Room, 'createdAt'>) => createDoc('rooms', data),
  update: (id: string, data: Partial<Room>) => updateDocument('rooms', id, data),
  delete: (id: string) => deleteDocument('rooms', id),
};

export const quoteOperations = {
  getByProject: (projectId: string) =>
    getDocs<Quote>('quotes', [where('projectId', '==', projectId), orderBy('createdAt', 'desc')]),
  get: (id: string) => getDocById<Quote>('quotes', id),
  create: (data: Omit<Quote, 'createdAt'>) => createDoc('quotes', data),
  update: (id: string, data: Partial<Quote>) => updateDocument('quotes', id, data),
};

export const portalTokenOperations = {
  getByToken: async (token: string) => {
    const tokens = await getDocs<PortalToken>('portalTokens', [where('token', '==', token)]);
    return tokens[0] || null;
  },
  create: (data: Omit<PortalToken, 'createdAt'>) => createDoc('portalTokens', data),
};
