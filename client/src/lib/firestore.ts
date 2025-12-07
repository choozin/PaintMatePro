import {
  collection,
  doc,
  getDoc,
  getDocs as getDocsFromFirestore,
  addDoc,
  setDoc,
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
export { Timestamp };
import { db } from './firebase';

// Type definitions matching your Firestore schema
export interface CatalogItem {
  id?: string;
  name: string;
  category: 'material' | 'labor' | 'other';
  unit: string;
  unitPrice: number;
  unitCost?: number; // Contractor cost for margin calc
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Org {
  name: string;
  defaultUnits: 'metric' | 'imperial';
  plan: 'free' | 'pro' | 'enterprise';
  region: string;

  // Quoting System Phase 1: Global Defaults
  estimatingSettings?: {
    defaultLaborRate: number; // $/hr
    defaultProductionRate: number; // sq ft/hr
    defaultCoverage: number; // sq ft/gal
    defaultWallCoats: number;
    defaultTrimCoats: number;
    defaultCeilingCoats: number;
    defaultTaxRate?: number; // % (e.g., 8.25)
    defaultPricePerGallon?: number; // New: Default price
    defaultCostPerGallon?: number; // New: Default cost
  };

  // Quoting System Phase 2: Customizable Supply Rules
  supplyRules?: SupplyRule[];

  // Quoting System Phase 2: Branding & Settings
  branding?: {
    logoUrl?: string;
    primaryColor?: string; // Hex code
    secondaryColor?: string; // Hex code
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    website?: string;
    logoBase64?: string; // Base64 string for PDF generation (bypasses CORS)
  };

  quoteSettings?: {
    defaultTerms?: string;
    defaultExpirationDays?: number;
    defaultTaxRate?: number; // Moved/Synced from estimatingSettings?
    templateLayout?: 'standard' | 'modern' | 'minimal';
  };
}

export interface Employee {
  id: string;
  orgId: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Crew {
  id: string;
  orgId: string;
  name: string;
  color: string; // Hex code for visualization
  memberIds: string[]; // List of Employee IDs
  paletteId?: string; // Visual palette ID
  specs?: Record<string, string>; // Custom attributes (e.g. "Size": "4-man", "Skill": "Exact Finish")
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SupplyRule {
  id: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  unitCost?: number; // New: Cost for margin analysis
  catalogItemId?: string; // Optional link to catalog
  condition: 'always' | 'if_ceiling' | 'if_trim' | 'if_primer' | 'if_floor_area';
  quantityType: 'fixed' | 'per_sqft_wall' | 'per_sqft_floor' | 'per_gallon_total' | 'per_linear_ft_perimeter' | 'per_gallon_primer';
  quantityBase: number; // The "X" in "1 item per X units" (or the fixed quantity)
}

export interface OrgWithId extends Org {
  id: string;
}

export interface EntitlementFeatures {
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

  // Quoting System Phase 2
  'quote.tiers': boolean;
  'quote.profitMargin': boolean;
  'quote.visualScope': boolean;
  'client.importCSV': boolean;
}

export interface Entitlement {
  plan: string;
  features: EntitlementFeatures;
}

export const ALL_BOOLEAN_FEATURES: (keyof EntitlementFeatures)[] = [
  'capture.ar',
  'capture.reference',
  'visual.recolor',
  'visual.sheenSimulator',
  'portal.fullView',
  'portal.advancedActionsLocked',
  'analytics.lite',
  'analytics.drilldowns',
  'pdf.watermark',
  'eSign',
  'payments',
  'scheduler',
  'quote.tiers',
  'quote.profitMargin',
  'quote.visualScope',
  'client.importCSV',
];

export interface ProjectEvent {
  id: string;
  type: 'lead_created' | 'quote_provided' | 'quote_accepted' | 'scheduled' | 'started' | 'paused' | 'resumed' | 'finished' | 'invoice_issued' | 'payment_received' | 'custom';
  label: string;
  date: Timestamp;
  notes?: string;
  createdBy?: string;
}

export type ProjectStatus = 'lead' | 'quoted' | 'booked' | 'in-progress' | 'paused' | 'completed' | 'invoiced' | 'paid' | 'on-hold' | 'pending'; // keeping pending/on-hold for migration safety

export interface Project {
  orgId: string;
  name: string;
  clientId: string;
  assignedCrewId?: string; // Link to Crew
  status: ProjectStatus;
  location: string;
  startDate: Timestamp; // This can now represent "Scheduled Start" or "Actual Start" depending on interpreted logic, or we can add specific fields if strict separation is needed. For now, let's keep it as primary "Start" but rely on timeline for specifics.
  estimatedCompletion?: Timestamp;
  // Advanced Scheduling
  dailyAssignments?: Record<string, string>; // Map of YYYY-MM-DD to CrewID
  pauses?: Array<{
    startDate: Timestamp;
    endDate?: Timestamp;
    originalDuration?: number; // Duration of project before pause
  }>;
  autoShifted?: boolean;

  timeline?: ProjectEvent[]; // New Timeline Array
  createdAt?: Timestamp;
  updatedAt?: Timestamp;

  // Supply Hub v2 Configuration
  supplyConfig?: {
    coveragePerGallon: number;
    wallCoats: number;
    ceilingCoats: number;
    trimCoats: number;
    includePrimer: boolean;
    includeCeiling: boolean;
    includeTrim: boolean;
    deductionFactor: number; // 0-1 range (e.g., 0.15 for 15%)
    ceilingSamePaint?: boolean; // New: Use wall paint for ceiling
    deductionMethod?: 'percent' | 'exact'; // New: Deduction mode
    deductionExactSqFt?: number; // New: Exact deduction amount
    pricePerGallon?: number; // New: Price per gallon for estimates
    costPerGallon?: number; // New: Cost per gallon for margin analysis
  };

  // Quoting System Phase 1: Labor Config
  laborConfig?: {
    hourlyRate: number;
    productionRate: number; // sq ft/hr
    difficultyFactor: number; // 1.0 - 2.0 multiplier
    ceilingProductionRate?: number; // New: Specific rate for ceilings
    totalHours?: number;
    totalCost?: number;
  };

  customSupplies?: Array<{
    id: string;
    name: string;
    qty: number;
    category: string;
    unitPrice?: number;
    unitCost?: number;
    unit?: string;
  }>;
}

export interface Client {
  orgId: string;
  name: string;
  email: string;
  phone: string;
  mobilePhone?: string; // For texting
  address: string;
  tags?: string[]; // Flexible labeling
  leadStatus?: 'new' | 'interested' | 'cold' | 'archived'; // Manual status override

  // Extended Details
  clientType?: 'residential' | 'commercial' | 'property_manager';
  source?: string;
  notes?: string;
  preferences?: string;
  secondaryContact?: {
    name: string;
    phone?: string;
    email?: string;
    role?: string;
  };

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// 3D point for AR measurements
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

// Individual wall measurement for complex room shapes
export interface Wall {
  id: string;
  startPoint: Point3D;
  endPoint: Point3D;
  height: number;
  length: number;
  area: number;
}

// Measurement metadata
export interface MeasurementMetadata {
  confidence?: number; // 0-1 scale for accuracy confidence
  roundingPreference?: 'precise' | '2inch' | '6inch' | '1foot';
  roundingDirection?: 'up' | 'down';
  capturedAt?: Timestamp;
  deviceInfo?: string;
}

// Extended room interface supporting multiple measurement methods
export interface Room {
  orgId: string;
  projectId: string;
  name: string;

  // Basic dimensions (backward compatible with existing data)
  length: number;
  width: number;
  height: number;

  // Measurement method tracking
  measurementMethod?: 'manual' | 'camera' | 'lidar';
  measurementMetadata?: MeasurementMetadata;

  // Complex room shape support (future)
  walls?: Wall[];
  shape?: 'rectangular' | 'complex';

  // Optional photo storage references (Firebase Storage URLs)
  photoUrls?: string[];

  // Pre-calculated areas (cached for performance)
  calculatedAreas?: {
    floor: number;
    wall: number;
    total: number;
  };

  createdAt?: Timestamp;
}

export interface QuoteOption {
  id: string;
  name: string;
  description?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    unitCost?: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
}

export interface Quote {
  orgId: string;
  projectId: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    unitCost?: number; // Contractor cost for margin calc
  }>;
  subtotal: number;
  tax: number;
  total: number;
  validUntil: Timestamp;

  createdAt?: Timestamp;
  createdBy?: string; // User UID
  createdByName?: string; // Display Name
  updatedAt?: Timestamp;
  updatedBy?: string;
  updatedByName?: string;

  // Status & Metadata (Phase 1.5)
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  notes?: string; // Client visible notes
  discount?: number;
  discountType?: 'percent' | 'fixed';
  options?: QuoteOption[] | null;
  selectedOptionId?: string | null;

  // Digital Signature (Phase 3)
  signature?: string | null; // Base64 signature image
  signedAt?: Timestamp | null;
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
  } catch (error: any) {
    console.error(`Error getting documents from ${collectionName}:`, error);
    if (error?.message) {
      console.error('Full error message:', error.message);
    }
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
  data: Partial<T> | { [key: string]: any }
): Promise<void> {
  try {
    console.log(`Updating document in ${collectionName}/${id} with data:`, data); // Added for debugging
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
    console.log('Update successful!'); // Added for debugging
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
  getAll: () => getDocs<Org>('orgs'),
  create: (data: Org) => createDoc('orgs', data),
  update: (id: string, data: Partial<Org>) => updateDocument('orgs', id, data),
};

export const crewOperations = {
  getByOrg: (orgId: string) => getOrgDocs<Crew>('crews', orgId),
  get: (id: string) => getDocById<Crew>('crews', id),
  create: (data: Omit<Crew, 'id' | 'createdAt' | 'updatedAt'>) => createDoc('crews', data),
  update: (id: string, data: Partial<Crew>) => updateDocument('crews', id, data),
  delete: (id: string) => deleteDocument('crews', id),
};

export const employeeOperations = {
  getByOrg: (orgId: string) => getOrgDocs<Employee>('employees', orgId),
  get: (id: string) => getDocById<Employee>('employees', id),
  create: (data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => createDoc('employees', data),
  update: (id: string, data: Partial<Employee>) => updateDocument('employees', id, data),
  delete: (id: string) => deleteDocument('employees', id),
};

export const entitlementOperations = {
  get: (orgId: string) => getDocById<Entitlement>('entitlements', orgId),
  update: (orgId: string, featureKey: string, value: boolean) => {
    const fieldPath = `features.${featureKey}`;
    return updateDocument('entitlements', orgId, { [fieldPath]: value });
  },
  create: (orgId: string, data: Entitlement) => {
    return setDoc(doc(db, 'entitlements', orgId), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
};

export const projectOperations = {
  getByOrg: (orgId: string) => getOrgDocs<Project>('projects', orgId, [orderBy('createdAt', 'desc')]),
  get: (id: string) => getDocById<Project>('projects', id),
  create: (data: Omit<Project, 'createdAt' | 'updatedAt' | 'orgId'>) => createDoc('projects', data),
  update: (id: string, data: Partial<Project>) => updateDocument('projects', id, data),
  delete: (id: string) => deleteDocument('projects', id),
};

export const clientOperations = {
  getByOrg: (orgId: string) => getOrgDocs<Client>('clients', orgId, [orderBy('createdAt', 'desc')]),
  get: (id: string) => getDocById<Client>('clients', id),
  create: (data: Omit<Client, 'createdAt' | 'updatedAt' | 'orgId'>) => createDoc('clients', data),
  update: (id: string, data: Partial<Client>) => updateDocument('clients', id, data),
  delete: (id: string) => deleteDocument('clients', id),
};

export const roomOperations = {
  getByProject: (projectId: string) =>
    getDocs<Room>('rooms', [where('projectId', '==', projectId)]),
  create: (data: Omit<Room, 'createdAt' | 'orgId' | 'updatedAt'>) => createDoc('rooms', data),
  update: (id: string, data: Partial<Room>) => updateDocument('rooms', id, data),
  delete: (id: string) => deleteDocument('rooms', id),
};

export const quoteOperations = {
  getByProject: (projectId: string, orgId?: string) => {
    const constraints: any[] = [where('projectId', '==', projectId)];
    if (orgId) {
      constraints.push(where('orgId', '==', orgId));
    }
    // Note: re-add orderBy once composite index is created
    return getDocs<Quote>('quotes', constraints);
  },
  get: (id: string) => getDocById<Quote>('quotes', id),
  create: (data: Omit<Quote, 'createdAt' | 'updatedAt'>) => createDoc('quotes', data),
  update: (id: string, data: Partial<Quote>) => updateDocument('quotes', id, data),
};

export const portalTokenOperations = {
  getByToken: async (token: string) => {
    const tokens = await getDocs<PortalToken>('portalTokens', [where('token', '==', token)]);
    return tokens[0] || null;
  },
  create: (data: Omit<PortalToken, 'createdAt'>) => createDoc('portalTokens', data),
};
