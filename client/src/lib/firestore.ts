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
// Comprehensive Paint Data Structure based on Supplier TDS
export interface PaintDetails {
  // Identity
  productCode?: string; // e.g. N524
  manufacturer?: string; // e.g. Benjamin Moore
  line?: string; // e.g. Aura, Regal Select
  colorFamily?: string; // e.g. Neutral, Warm, Cool

  // Packaging
  containerSize?: string; // e.g. Gallon, 5-Gallon
  availabilityStatus?: string; // e.g. In Stock
  maxTintLoad?: string; // e.g. 124 fl oz / 6 fl oz

  // Technical Specs
  baseType?: string; // e.g. Latex, Oil, Alkyd, White Base
  resinType?: string; // e.g. 100% Acrylic
  glossLevel?: string; // Numeric or descriptive e.g. "35-45 @ 60°"
  voc?: string; // g/L e.g. "<50 g/L"
  solidsVol?: string; // % Solids by Volume e.g. "35 ± 2%"
  weightPerGallon?: string; // e.g. "10.2 lb/gal"
  flashPoint?: string;
  pH?: string;

  // Performance
  coverageRate?: string; // e.g. "350-400 sq ft/gal" - distinct from the numeric `coverage` used for calcs
  dryToTouch?: string;
  dryToRecoat?: string;
  cureTime?: string;
  performanceRatings?: string; // e.g. Scrub Resistance, Hiding Power
  recommendedUses?: string[]; // e.g. Interior, Walls, Trim

  // Application
  applicationMethods?: string[]; // e.g. Brush, Roll, Spray
  thinning?: string;
  primerRequirements?: string; // Compatible primers
  substrates?: string[]; // e.g. Drywall, Plaster, Wood
  cleanup?: string; // e.g. Soap & Water

  // Compliance & Safety
  certifications?: string[]; // e.g. GREENGUARD, LEED
  hazards?: string; // SDS summary
  compositionNotes?: string; // Pigments/binders
}

export interface CatalogItem {
  id?: string;
  name: string;
  category: 'material' | 'labor' | 'paint' | 'primer' | 'other';
  unit: string;
  unitPrice: number;
  unitCost?: number; // Contractor cost for margin calc
  description?: string; // General description

  // Core Specs (kept top-level for easy access/filtering)
  coverage?: number; // numeric sq ft per gallon for calculations
  sheen?: string;

  // Full TDS Data
  paintDetails?: PaintDetails;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Org {
  name: string;
  defaultUnits: 'metric' | 'imperial';
  plan: 'free' | 'pro' | 'enterprise';
  region: string;

  // Global Feature Flags
  enableTeamFeatures?: boolean; // Default true. detailed crew assignment, payroll, etc.
  defaultQuoteStyle?: 'detailed' | 'split' | 'bundled'; // Default 'detailed'

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

  quoteTemplates?: QuoteTemplate[]; // New: List of saved configurations
  defaultQuoteTemplateId?: string; // New: Default to use
}

export interface QuoteDisplayConfig {
  // 1. Organization (The Container)
  organization: 'room' | 'surface' | 'floor' | 'phase';

  // 2. Composition (The Split)
  itemComposition: 'bundled' | 'separated' | 'granular' | 'fixed_material';

  // 3. Labor Pricing Model (The Unit)
  laborPricingModel: 'fixed' | 'hourly' | 'unit_sqft' | 'day_rate' | 'item_count';

  // 4. Material Strategy (The Material Bill)
  materialStrategy: 'inclusive' | 'allowance' | 'itemized_volume' | 'specific_product';

  // New: Material Grouping
  materialGrouping?: 'itemized_per_task' | 'combined_section' | 'combined_setup' | 'hidden';

  // 5. Details (Toggles)
  showCoatCounts: boolean;
  showColors: boolean;
  showDimensions: boolean;
  showQuantities: boolean; // New
  showRates: boolean;      // New
  showPrepTasks: boolean;
  showDisclaimers: boolean;

  // Financial
  showTaxLine: boolean;
  showSubtotals: boolean;

  // Custom
  customFooterText?: string;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  description?: string;
  config: QuoteDisplayConfig;
  isDefault?: boolean;
}

import { OrgRole } from '@/lib/permissions';

export interface Employee {
  id: string;
  orgId: string;
  name: string;
  role: OrgRole | string; // Relaxed for legacy compatibility but prefers OrgRole
  email?: string;
  phone?: string;
  hourlyRate?: number; // For Payroll
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
  type: 'lead_created' | 'quote_created' | 'quote_provided' | 'quote_sent' | 'quote_accepted' | 'scheduled' | 'started' | 'paused' | 'resumed' | 'finished' | 'invoice_issued' | 'payment_received' | 'on_hold' | 'custom';
  label: string;
  date: Timestamp;
  notes?: string;
  createdBy?: string;
}

export type ProjectStatus = 'new' | 'quote_created' | 'quote_sent' | 'pending' | 'booked' | 'in-progress' | 'paused' | 'completed' | 'invoiced' | 'paid' | 'on-hold' | 'lead' | 'quoted' | 'resumed'; // lead/quoted legacy

// Snapshot of a paint product used in a project
export interface PaintProduct {
  id?: string; // Optional (if custom)
  name: string;
  pricePerGallon: number;
  coverage: number; // sq ft per gallon
  sheen?: string;
  dryingTime?: string; // e.g., "1hr touch, 4hr recoat"
  cleanup?: string; // e.g., "Soap & Water"
  notes?: string;
}

export interface Project {
  orgId: string;
  name: string;
  clientId: string;
  assignedCrewId?: string; // Link to Crew
  status: ProjectStatus;
  quoteTemplateId?: string; // New: Override default template
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
    coveragePerGallon: number; // Keep as fallback/default
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
    pricePerGallon?: number; // Keep as fallback/default
    costPerGallon?: number; // New: Cost per gallon for margin analysis

    // Product Selections (Snapshots)
    wallProduct?: PaintProduct;
    ceilingProduct?: PaintProduct;
    trimProduct?: PaintProduct;
    primerProduct?: PaintProduct; // New: Primer selection

    // Prep & Misc
    includeWallpaperRemoval?: boolean; // New
    wallpaperRemovalRate?: number; // New: Labor rate per sq ft for removal
  };

  // Quoting System Phase 1: Labor Config
  laborConfig?: {
    hourlyRate: number; // Keep for internal cost calculation? Or deprecated?
    productionRate: number; // sq ft/hr
    difficultyFactor: number; // 1.0 - 2.0 multiplier
    ceilingProductionRate?: number; // New: Specific rate for ceilings
    totalHours?: number;
    totalCost?: number;
    laborPricePerSqFt?: number; // New: Fixed price per sq ft for quoting
  };

  internalCostConfig?: {
    method: 'standard' | 'custom';
    estimatedHours?: number;
    crewCount?: number;
    averageWage?: number; // $/hr internal cost
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
  type?: 'interior' | 'exterior'; // New: Distinguish surfaces

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

export interface TimeEntry {
  id: string;
  orgId: string;
  projectId: string;
  crewId?: string;
  employeeId: string;
  date: Timestamp; // Noon-normalized date for grouping

  // Time & Pay Details
  startTime?: Timestamp;
  endTime?: Timestamp;
  breakDurationMinutes?: number;
  totalHours: number;

  workType: 'regular' | 'overtime' | 'double_time' | 'travel';
  notes?: string;

  // Approval Workflow
  status: 'draft' | 'submitted' | 'approved' | 'processed';
  approvedBy?: string;
  approvedAt?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
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
 * Create a new document with a specific ID
 */
export async function createDocWithId<T>(
  collectionName: string,
  id: string,
  data: Partial<T>
): Promise<string> {
  try {
    const docRef = doc(db, collectionName, id);
    await setDoc(docRef, {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return id;
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
  getByEmail: (email: string) => getDocs<Employee>('employees', [where('email', '==', email)]),
  get: (id: string) => getDocById<Employee>('employees', id),
  create: (data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    if (data.id) {
      // If ID provided (e.g. for Owner linked to Auth ID), use setDoc
      return createDocWithId('employees', data.id, { ...data, id: undefined });
    }
    return createDoc('employees', data);
  },
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

export interface User {
  email: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  orgIds?: string[];
  globalRole?: string; // e.g. 'platform_admin'
  roles?: Record<string, string>; // orgId -> role mapping
  // Other profile info
}

export const userOperations = {
  getAll: () => getDocs<User>('users'),
  get: (uid: string) => getDocById<User>('users', uid),
  update: (uid: string, data: Partial<User>) => updateDocument('users', uid, data),
  set: (uid: string, data: User) => createDocWithId('users', uid, data),
};

export const timeEntryOperations = {
  getByOrg: (orgId: string) => getOrgDocs<TimeEntry>('time_entries', orgId, [orderBy('date', 'desc')]),
  getByEmployee: (employeeId: string, startDate: Date, endDate: Date) =>
    getDocs<TimeEntry>('time_entries', [
      where('employeeId', '==', employeeId),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate))
    ]),
  getByProject: (projectId: string) => getDocs<TimeEntry>('time_entries', [where('projectId', '==', projectId)]),
  create: (data: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>) => createDoc('time_entries', data),
  update: (id: string, data: Partial<TimeEntry>) => updateDocument('time_entries', id, data),
  delete: (id: string) => deleteDocument('time_entries', id),
};
