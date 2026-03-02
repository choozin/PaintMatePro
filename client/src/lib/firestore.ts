
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
import { QuoteConfiguration } from '@/types/quote-config';

// Type definitions matching your Firestore schema
// Comprehensive Paint Data Structure based on Supplier TDS
export interface ProjectEvent {
  id: string;
  type: string;
  label: string;
  date: Timestamp;
  notes?: string;
}

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

export type PaintProduct = CatalogItem;

export interface Org {
  name: string;
  defaultUnits: 'metric' | 'imperial';
  plan: 'free' | 'pro' | 'enterprise';
  region: string;

  // Global Feature Flags
  enableTeamFeatures?: boolean; // Default true. detailed crew assignment, payroll, etc.
  defaultQuoteStyle?: 'detailed' | 'split' | 'bundled'; // Default 'detailed'
  defaultMarkupType?: 'percent' | 'fixed'; // New: Pricing strategy
  defaultMarkupValue?: number; // New: Markup amount (e.g. 25 for 25%, or 10 for $10)

  // Quoting System Phase 1: Global Defaults
  estimatingSettings?: {
    defaultLaborRate: number; // $/hr
    defaultProductionRate: number; // sq ft/hr
    defaultCoverage: number; // sq ft/gal
    defaultWallCoats: number;
    defaultTrimCoats: number;
    defaultCeilingCoats: number;
    defaultTrimRate?: number; // $/linear_ft
    defaultTaxRate?: number; // % (e.g., 8.25)
    defaultPricePerGallon?: number; // New: Default price
    defaultCostPerGallon?: number; // New: Default cost
    defaultBillablePaint?: boolean; // New: Default billing behavior
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

  // Team & Crew Settings
  teamSettings?: {
    crewTerm?: string; // e.g. "Crew", "Team", "Squad"
    crewLeadTerm?: string; // e.g. "Crew Lead", "Foreman"
    crewLeadVisibility?: {
      payroll?: boolean; // Can crew leads see payroll details of members?
      personalBio?: boolean; // Can crew leads see personal bio details?
    }
  };

  quoteSettings?: {
    defaultTerms?: string;
    defaultExpirationDays?: number;
    defaultTaxRate?: number; // Moved/Synced from estimatingSettings?
    templateLayout?: 'standard' | 'modern' | 'minimal';
  };

  quoteTemplates?: QuoteTemplate[]; // New: List of saved configurations
  defaultQuoteTemplateId?: string; // New: Default to use

  // Payroll & Time Settings
  payrollSettings?: {
    payPeriodType?: 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly';
    payPeriodStartDay?: number; // 0=Sunday, 1=Monday, etc. (for weekly/bi-weekly)
    overtimeRules?: {
      dailyOvertimeThreshold?: number;      // Hours per day before OT (e.g., 8)
      weeklyOvertimeThreshold?: number;     // Hours per week before OT (e.g., 40)
      dailyDoubleTimeThreshold?: number;    // Hours per day before double time (e.g., 12)
      overtimeMultiplier?: number;          // e.g., 1.5
      doubleTimeMultiplier?: number;        // e.g., 2.0
    };
    breakCompliance?: {
      enabled?: boolean;
      requiredBreakMinutes?: number;        // e.g., 30
      afterHours?: number;                  // e.g., 6 (break required after 6 hrs)
    };
    requireGpsClockIn?: boolean;            // Require GPS coordinates on clock-in
    allowMileageTracking?: boolean;         // Enable mileage field on time entries
  };

  // Calendar & Display Settings
  calendarSettings?: {
    scheduleWeekStartsOn?: 0 | 1; // 0 = Sunday (Default), 1 = Monday
    payrollWeekStartsOn?: 0 | 1;
    timesheetWeekStartsOn?: 0 | 1;
  };
}

export type OrgWithId = Org & { id: string };



export interface QuoteTemplate {
  id: string;
  name: string;
  description?: string;
  config: QuoteConfiguration;
  isDefault?: boolean;
}

export interface SupplyRule {
  id?: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  condition: 'always' | 'if_ceiling' | 'if_trim' | 'if_primer' | 'if_floor_area';
  quantityType: 'fixed' | 'per_sqft_wall' | 'per_sqft_floor' | 'per_gallon_total' | 'per_gallon_primer' | 'per_linear_ft_perimeter';
  quantityBase: number;
}

export interface ProjectSupplyConfig {
  // Wall Paint
  wallProduct?: CatalogItem | null; // Selected Paint Product Object
  wallMethod?: 'brush_roll' | 'spray';
  wallCoats?: number; // Override default

  wallCoverage?: number; // Override product/default coverage
  billablePaint?: boolean; // Override Org default
  wallExcludeFromSharedPaint?: boolean;

  // Trim Paint
  trimProduct?: CatalogItem | null;
  trimMethod?: 'brush' | 'spray';
  trimCoats?: number;
  trimRate?: number; // $/linear_ft override
  trimWidth?: number; // inches override
  trimCoverage?: number;
  trimExcludeFromSharedPaint?: boolean;
  includeTrim?: boolean;

  // Ceiling Paint
  ceilingProduct?: CatalogItem | null;
  ceilingMethod?: 'roll' | 'spray';
  ceilingCoats?: number;
  ceilingCoverage?: number;
  ceilingExcludeFromSharedPaint?: boolean;
  includeCeiling?: boolean; // Toggle for "Paint Ceiling too?"

  // Primer
  primerProduct?: CatalogItem | null; // If null, use standard
  requirePrimer?: boolean; // Toggle

  // Prep (Legacy - kept for migration if needed, but UI will likely move away)
  includeWallpaperRemoval?: boolean;
  wallpaperRemovalRate?: number; // $/sqft

  // Supply Rules Overrides?
  // Maybe just a list of "Extra Supplies" added manually
  extraSupplies?: CustomSupplyItem[];
  deductionExactSqFt?: number;
}


export interface PaintConfig {
  coveragePerGallon: number;
  wallCoats: number;
  ceilingCoats: number;
  trimCoats: number;
  trimCoverage?: number;
  ceilingCoverage?: number;
  defaultTrimRate?: number; // $/linear_ft
  defaultTrimWidth?: number; // inches
  includePrimer: boolean;
  includeCeiling: boolean;
  includeTrim: boolean;
  deductionFactor: number;
  ceilingSamePaint?: boolean;
  deductionMethod?: 'percent' | 'exact';
  deductionExactSqFt?: number | string;
  pricePerGallon?: number;

  wallProduct?: PaintProduct | null;
  ceilingProduct?: PaintProduct | null;
  trimProduct?: PaintProduct | null;
  primerProduct?: PaintProduct | null;

  // Primer Specifics
  primerCoats?: number;
  primerCoverage?: number;
  primerAppRate?: number;

  // Legacy / Migrated to PrepTasks
  includeWallpaperRemoval?: boolean;
  wallpaperRemovalRate?: number;
  billablePaint?: boolean;
}

export interface CustomSupplyItem {
  id: string;
  name: string;
  qty: number;
  category: string;
  unitPrice?: number;
  unit?: string;
  roomId?: string; // Optional linkage
  actionItemId?: string; // If linked to catalog
  billingType?: 'billable' | 'expense' | 'checklist';
}

export interface ProjectLaborConfig {
  hourlyRate: number; // e.g. 60
  productionRate: number; // e.g. 150 sqft/hr
  difficultyFactor: number; // 0.8 to 1.5
  laborPricePerSqFt: number; // Derived or Manual? (e.g. 1.50)
  totalCost?: number; // Added to fix type error
}

// --- MEASUREMENTS & PREP ---
// --- MEASUREMENTS & PREP ---
export interface PrepTask {
  id: string;
  name: string; // e.g. "Wallpaper Removal", "Sanding"
  unit: 'sqft' | 'linear_ft' | 'units' | 'fixed' | 'hours'; // 'fixed' = user defined price
  quantity: number; // Hours (if unit=units?), SqFt, or LinearFt
  width?: number; // For linear_ft -> sqft conversion
  rate: number; // Unit Price or Flat Fee
  roomId: string; // 'global' or specific roomId
  count?: number;
  globalId?: string; // If this is an override of a global task
  excluded?: boolean; // If true, this potentially global task is excluded from this room
  linkedWorkItemId?: string; // ID of a work item this prep task is linked to
}

export interface MiscMeasurement {
  id: string;
  name: string; // "Window Frames", "Baseboards"
  unit: 'sqft' | 'linear_ft' | 'units' | 'fixed' | 'hours';
  quantity: number;
  width?: number; // For linear_ft -> sqft conversion (e.g. 0.5 ft width)
  rate: number;
  count?: number; // Multiplier (e.g. 12 window frames)
  chargeOverride?: number; // Optional flat fee override (Deprecated? Use unit='fixed'?)
  roomId: string; // 'global' or specific roomId
  coverage?: number; // sqft/gallon (for Paint calculation)
  paintProductId?: string; // ID of required paint product
  coats?: number; // Number of coats
  excludeFromSharedPaint?: boolean;
  customPaintArea?: number; // User-defined area for paint calc (sqft) when unit is not sqft/linear_ft
}


export interface Room {
  id: string; // uuid
  name: string; // e.g. "Living Room"
  type?: 'interior' | 'exterior';
  length: number;
  width: number;
  height: number;
  color?: string;
  notes?: string;

  // Measurements
  prepTasks?: PrepTask[];
  miscItems?: MiscMeasurement[];

  // Overrides
  supplyConfig?: ProjectSupplyConfig;
}


export interface Client {
  id: string;
  orgId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  mobilePhone?: string; // Added field
  createdAt: Timestamp;
  // Extended fields
  clientType?: string;
  leadStatus?: string;
  source?: string;
  preferences?: string;
  notes?: string;
  secondaryContact?: {
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
  };
}

export interface Project {
  id: string;
  orgId: string;
  clientId: string;
  name: string;
  address: string;
  status: 'lead' | 'new' | 'active' | 'completed' | 'cancelled' | 'quoted' | 'quote_created' | 'quote_sent' | 'pending' | 'booked' | 'in-progress' | 'paused' | 'on-hold' | 'invoiced' | 'paid' | 'overdue';

  // Unified Schedule Fields
  type?: 'project' | 'task' | 'appointment' | 'event';
  eventCategory?: 'task' | 'appointment' | 'training' | 'meeting' | 'other';
  visibilityRoles?: string[];
  linkedProjectId?: string;

  startDate?: Timestamp | string; // ISO String or Firestore Timestamp
  estimatedCompletion?: Timestamp | string;
  completedAt?: Timestamp | string; // Actual completion date
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Data
  assignedCrewId?: string;
  assignments?: Record<string, string[]>; // Map of Date (YYYY-MM-DD) -> Array of Employee IDs
  rooms: Room[]; // Now sources of truth for room items

  // Global Configs
  laborConfig?: ProjectLaborConfig;
  supplyConfig?: ProjectSupplyConfig; // Global defaults
  paintConfig?: PaintConfig;

  // Global Lists
  globalPrepTasks?: PrepTask[];
  globalMiscItems?: MiscMeasurement[];

  notes?: string;
  description?: string;
  timeline?: ProjectEvent[];
  quoteTemplateId?: string;

  // Pauses
  pauses?: Array<{
    startDate: Timestamp | string;
    endDate?: Timestamp | string;
    reason?: string;
  }>;

  // Legacy / Deprecated fields kept for safety
  customSupplies?: CustomSupplyItem[];
}

export const deleteProject = (id: string) => deleteDocument('projects', id);

export interface QuoteOption {
  id: string;
  name: string; // "Option 1", "Deluxe Package"
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
  id: string;
  orgId: string;
  projectId: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    unitCost?: number; // Contractor cost for margin calc
    isHeader?: boolean;
    amount?: number; // Header total
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
  clientEmail?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ClientSubmission {
  id: string; // uuid
  projectId: string;
  roomId?: string; // Optional context
  type: 'note' | 'photo' | 'selection' | 'question';
  content: string; // Text content or File URL
  fileMetadata?: {
    name: string;
    size: number;
    type: string;
  };
  submittedBy: 'client' // For now always client
  createdAt: Timestamp;
  isRead: boolean;
}

export const portalOperations = {
  // 1. Get Token Info (Publicly accessible if we have security rules right, or via Function)
  // For now we assume we can read this collection if we have the ID, or we make it public read?
  // Actually, Firestore Rules should likely allow reading 'portal_tokens' where token == resource.data.token?
  // Easier: Use a Cloud Function for "verify". 
  // MVP: Allow read of portal_tokens by anyone (low risk if token is high entropy UUID).
  getToken: async (token: string) => {
    const q = query(getCollection<PortalToken>('portal_tokens'), where('token', '==', token));
    const snap = await getDocsFromFirestore(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as PortalToken & { id: string };
  },

  getActiveToken: async (projectId: string) => {
    // Find a token for this project that hasn't expired
    // OPTIMIZATION: Query by projectId only (supported by default index) and filter date in JS
    // This avoids needing a custom composite index deployment.
    const q = query(
      getCollection<PortalToken>('portal_tokens'),
      where('projectId', '==', projectId)
    );
    const snap = await getDocsFromFirestore(q);

    if (snap.empty) return null;

    const now = new Date();
    const activeToken = snap.docs
      .map(doc => doc.data())
      .find(data => data.expiresAt.toDate() > now);

    return activeToken ? activeToken.token : null;
  },

  createToken: async (projectId: string, clientEmail?: string, invalidateOld = false) => {
    // 0. Invalidate old tokens if requested
    if (invalidateOld) {
      // Query all tokens for project and filter in code to find active ones
      const q = query(
        getCollection<PortalToken>('portal_tokens'),
        where('projectId', '==', projectId)
      );
      const snap = await getDocsFromFirestore(q);

      const now = new Date();
      const activeDocs = snap.docs.filter(doc => doc.data().expiresAt.toDate() > now);

      await Promise.all(activeDocs.map(doc =>
        updateDocument('portal_tokens', doc.id, { expiresAt: Timestamp.now() })
      ));
    }

    // 1. Generate Token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days valid

    // 2. Save
    await addDocument<PortalToken>('portal_tokens', {
      projectId,
      clientEmail: clientEmail || '',
      token,
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: Timestamp.now()
    });

    return token;
  },

  // 2. Validate Email NO LONGER NEEDED (Done in PortalAuth via Token Data)
  validateClient: async (projectId: string, email: string) => {
    // Deprecated in favor of PortalAuth check against tokenDoc.clientEmail
    return true;
  },

  // 3. Activity Feed / Submissions
  submitActivity: async (projectId: string, data: Omit<ClientSubmission, 'id' | 'projectId' | 'createdAt' | 'isRead'>) => {
    // We add this to a specific subcollection or root collection
    // Let's use a root collection 'client_submissions' for easier querying by Admins later?
    // Or subcollection to keep Project tidy. 
    // User requirement: "Update project doc ... or clientSubmissions sub-collection"
    // Let's go with Root collection with projectId field for easier Indexing.
    return addDocument('client_submissions', {
      ...data,
      projectId,
      submittedBy: 'client',
      isRead: false,
      createdAt: Timestamp.now()
    });
  },

  getProjectSubmissions: (projectId: string) =>
    getDocs<ClientSubmission>('client_submissions', [where('projectId', '==', projectId), orderBy('createdAt', 'desc')])
};

export interface TimeEntry {
  id: string;
  orgId: string;
  projectId: string;
  crewId?: string;
  employeeId: string;
  date: Timestamp; // Noon-normalized date for grouping

  // Timesheet Details
  startTime?: Timestamp;
  endTime?: Timestamp;
  breakDurationMinutes?: number;
  totalHours: number;

  workType: 'regular' | 'overtime' | 'double_time' | 'travel';
  notes?: string;

  // GPS & Location
  clockInLocation?: { lat: number; lng: number; accuracy?: number };
  clockOutLocation?: { lat: number; lng: number; accuracy?: number };

  // Mileage / Travel
  mileage?: number;
  mileageNotes?: string;

  // Approval Workflow
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'processed';
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectedBy?: string;
  rejectionNotes?: string;

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
  } catch (error) {
    console.error(`Error getting documents from ${collectionName}:`, error);
    throw error;
  }
}


/**
 * Add a new document to a collection
 * Returns the new document ID
 */
export async function addDocument<T extends DocumentData>(collectionName: string, data: T): Promise<string> {
  try {
    const docRef = await addDoc(getCollection<T>(collectionName), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error(`Error adding document to ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Update an existing document
 */
export async function updateDocument<T>(collectionName: string, id: string, data: Partial<T>): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error(`Error updating document ${id} in ${collectionName}:`, error);
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
    console.error(`Error deleting document ${id} from ${collectionName}:`, error);
    throw error;
  }
}

// --- Specific Operations ---
export const orgOperations = {
  create: (data: Omit<Org, 'id'>) => addDocument<Org>('orgs', data),
  get: (id: string) => getDocById<Org>('orgs', id),
  getAll: () => getDocs<Org>('orgs', [orderBy('name')]),
  update: (id: string, data: Partial<Org>) => updateDocument<Org>('orgs', id, data),
};

export type ProjectStatus = Project['status'];

export const projectOperations = {
  create: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => addDocument<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>('projects', data),
  get: (id: string) => getDocById<Project>('projects', id),
  getByOrg: (orgId: string) => getDocs<Project>('projects', [where('orgId', '==', orgId)]), // Removed orderBy to fix potential index issue
  getByClient: (clientId: string) => getDocs<Project>('projects', [where('clientId', '==', clientId)]),
  getByLinkedProject: (projectId: string) => getDocs<Project>('projects', [where('linkedProjectId', '==', projectId)]),
  update: (id: string, data: Partial<Project>) => updateDocument<Project>('projects', id, data),
  delete: (id: string) => deleteDocument('projects', id),
};

export const clientOperations = {
  create: (data: Omit<Client, 'id' | 'createdAt'>) => addDocument<Omit<Client, 'id' | 'createdAt'>>('clients', data),
  get: (id: string) => getDocById<Client>('clients', id),
  getByOrg: (orgId: string) => getDocs<Client>('clients', [where('orgId', '==', orgId)]), // Removed orderBy to rely on client-side sorting & avoid index issues
  update: (id: string, data: Partial<Client>) => updateDocument<Client>('clients', id, data),
  delete: (id: string) => deleteDocument('clients', id),
};

export const quoteOperations = {
  create: (data: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>) => addDocument<Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>>('quotes', data),
  get: (id: string) => getDocById<Quote>('quotes', id),
  getByProject: (projectId: string) => getDocs<Quote>('quotes', [where('projectId', '==', projectId), orderBy('createdAt', 'desc')]),
  update: (id: string, data: Partial<Quote>) => updateDocument<Quote>('quotes', id, data),
  delete: (id: string) => deleteDocument('quotes', id),
};

export const catalogOperations = {
  create: (data: Omit<CatalogItem, 'id' | 'createdAt' | 'updatedAt'>) => addDocument<Omit<CatalogItem, 'id' | 'createdAt' | 'updatedAt'>>('catalog', data),
  getAll: (orgId: string | undefined) => { // Currently not filtering by org, global catalog? Or should add orgId to catalog items?
    // Assuming global for now or filter later
    return getDocs<CatalogItem>('catalog', [orderBy('name')]);
  },
  update: (id: string, data: Partial<CatalogItem>) => updateDocument<CatalogItem>('catalog', id, data),
  delete: (id: string) => deleteDocument('catalog', id),
};

export interface Employee {
  id: string;
  orgId: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;

  // Compensation
  payType?: 'hourly' | 'salary';
  payRate?: number; // Hourly rate or annual salary

  createdAt: Timestamp;
}

export interface Crew {
  id: string;
  orgId: string;
  name: string;
  color?: string;
  paletteId?: string;
  memberIds?: string[];
  leaderIds?: string[]; // IDs of employees who are Crew Leads
  specs?: Record<string, string>; // Optional specs for the crew
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const crewOperations = {
  create: (data: Omit<Crew, 'id' | 'createdAt' | 'updatedAt'>) => addDocument<Omit<Crew, 'id' | 'createdAt' | 'updatedAt'>>('crews', data),
  get: (id: string) => getDocById<Crew>('crews', id),
  getByOrg: (orgId: string) => getDocs<Crew>('crews', [where('orgId', '==', orgId)]),
  update: (id: string, data: Partial<Crew>) => updateDocument<Crew>('crews', id, data),
  delete: (id: string) => deleteDocument('crews', id),
};

export const employeeOperations = {
  create: (data: Omit<Employee, 'id' | 'createdAt'>) => addDocument<Omit<Employee, 'id' | 'createdAt'>>('employees', data),
  get: (id: string) => getDocById<Employee>('employees', id),
  getByOrg: (orgId: string) => getDocs<Employee>('employees', [where('orgId', '==', orgId)]),
  getByEmail: (email: string) => getDocs<Employee>('employees', [where('email', '==', email)]),
  update: (id: string, data: Partial<Employee>) => updateDocument<Employee>('employees', id, data),
  delete: (id: string) => deleteDocument('employees', id),
};

export const roomOperations = {
  create: (data: Omit<Room, 'id'>) => addDocument<Omit<Room, 'id'>>('rooms', data as any), // Type cast for now as Room structure is complex
  get: (id: string) => getDocById<Room>('rooms', id),
  getByProject: (projectId: string) => getDocs<Room>('rooms', [where('projectId', '==', projectId)]),
  update: (id: string, data: Partial<Room>) => updateDocument<Room>('rooms', id, data),
  delete: (id: string) => deleteDocument('rooms', id),
};

import { GlobalRole } from './permissions';

export interface OrgEntitlement {
  id?: string;
  orgId: string;
  plan: 'free' | 'pro' | 'enterprise';
  features: Record<string, any>; // Map of feature keys to values
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const entitlementOperations = {
  create: (orgId: string, data: { plan: 'free' | 'pro' | 'enterprise', features: Record<string, any> }) => {
    // Single document per Org, ID = orgId
    return setDoc(doc(db, 'entitlements', orgId), {
      orgId,
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  },
  get: (orgId: string) => getDocById<OrgEntitlement>('entitlements', orgId),
  // Update a specific feature toggle using dot notation
  update: (orgId: string, featureKey: string, value: boolean) => {
    return updateDoc(doc(db, 'entitlements', orgId), {
      [`features.${featureKey}`]: value,
      updatedAt: Timestamp.now()
    });
  }
};

export type Entitlement = OrgEntitlement;

export const ALL_BOOLEAN_FEATURES = [
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
  'timeTracking',
  'scheduler',
  'quote.tiers',
  'quote.profitMargin',
  'quote.visualScope',
  'client.importCSV',
];

export interface UserProfile {
  id: string; // matches auth.uid
  email: string;
  displayName?: string;
  photoURL?: string;
  username?: string;
  orgId?: string; // Current active org
  orgIds: string[]; // All orgs user belongs to
  roles?: Record<string, string>; // Map of orgId -> roleId/roleName
  globalRole?: GlobalRole;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export const userOperations = {
  create: (data: Omit<UserProfile, 'createdAt'>) => setDoc(doc(db, 'users', data.id), { ...data, createdAt: Timestamp.now() }),
  set: (id: string, data: UserProfile) => setDoc(doc(db, 'users', id), data),
  get: (id: string) => getDocById<UserProfile>('users', id),
  getAll: () => getDocs<UserProfile>('users', []),
  update: (id: string, data: Partial<UserProfile>) => updateDocument<UserProfile>('users', id, data),
};

export type User = UserProfile; // Alias for backward compatibility


export const timeEntryOperations = {
  create: (data: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>) => addDocument<Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>>('time_entries', data),
  get: (id: string) => getDocById<TimeEntry>('time_entries', id),
  getByOrg: (orgId: string) => getDocs<TimeEntry>('time_entries', [where('orgId', '==', orgId)]),
  getByProject: (projectId: string) => getDocs<TimeEntry>('time_entries', [where('projectId', '==', projectId), orderBy('date', 'desc')]),
  getByEmployee: (employeeId: string) => getDocs<TimeEntry>('time_entries', [where('employeeId', '==', employeeId), orderBy('date', 'desc')]),
  update: (id: string, data: Partial<TimeEntry>) => updateDocument<TimeEntry>('time_entries', id, data),
  delete: (id: string) => deleteDocument('time_entries', id),
};

import { Permission } from './permissions';

export interface DevNoteItem {
  id: string;
  text: string;
  url?: string;
}

export interface DevNote {
  id: string;
  orgId?: string; // Optional for personal notes
  userId?: string;
  title: string;
  content: string;
  type: 'short_term' | 'long_term' | 'competitor' | 'general';
  items?: DevNoteItem[];
  relatedUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const devNoteOperations = {
  create: (data: Omit<DevNote, 'id' | 'createdAt' | 'updatedAt'>) => addDocument<Omit<DevNote, 'id' | 'createdAt' | 'updatedAt'>>('dev_notes', data),
  get: (id: string) => getDocById<DevNote>('dev_notes', id),
  getByOrg: (orgId: string) => getDocs<DevNote>('dev_notes', [where('orgId', '==', orgId), orderBy('createdAt', 'desc')]),
  getByUser: (userId: string) => getDocs<DevNote>('dev_notes', [where('userId', '==', userId)]),
  update: (id: string, data: Partial<DevNote>) => updateDocument<DevNote>('dev_notes', id, data),
  delete: (id: string) => deleteDocument('dev_notes', id),
};

// --- Roles & Permissions (New) ---

// 1. Role Templates (Global Defaults managed by App Admin)
export interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  defaultPermissions: Permission[];
  isSystemDefault: boolean; // e.g. Owner/Admin templates cannot be deleted globally
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 2. Org Roles (Instances specific to an Org)
export interface OrgRoleDef {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isSystemProtected?: boolean; // If true, cannot delete (e.g. 'org_owner')
  sourceTemplateId?: string; // Link to original template
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const roleTemplateOperations = {
  create: (data: Omit<RoleTemplate, 'id' | 'createdAt' | 'updatedAt'>) => addDocument<Omit<RoleTemplate, 'id' | 'createdAt' | 'updatedAt'>>('role_templates', data),
  get: (id: string) => getDocById<RoleTemplate>('role_templates', id),
  getAll: () => getDocs<RoleTemplate>('role_templates', [orderBy('name')]),
  update: (id: string, data: Partial<RoleTemplate>) => updateDocument<RoleTemplate>('role_templates', id, data),
  delete: (id: string) => deleteDocument('role_templates', id),
};

export const orgRoleOperations = {
  create: (data: Omit<OrgRoleDef, 'id' | 'createdAt' | 'updatedAt'>) => addDocument<Omit<OrgRoleDef, 'id' | 'createdAt' | 'updatedAt'>>('roles', data),
  get: (id: string) => getDocById<OrgRoleDef>('roles', id),
  getByOrg: (orgId: string) => getDocs<OrgRoleDef>('roles', [where('orgId', '==', orgId)]),
  update: (id: string, data: Partial<OrgRoleDef>) => updateDocument<OrgRoleDef>('roles', id, data),
  delete: (id: string) => deleteDocument('roles', id),
};


