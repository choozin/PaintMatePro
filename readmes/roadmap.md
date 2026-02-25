# PaintMatePro: Detailed Project Roadmap & Functional Specifications

This document serves as the central reference point for the long-term vision, architectural goals, and functional specifications of PaintMatePro. Future agents and developers should refer to this document to understand the project's trajectory.

## Architectural Goals

1. **Core Tech Stack & Foundation**
   - **Frontend:** React (Vite) + TypeScript.
   - **Backend:** Firebase (Auth, Firestore, Storage, Cloud Functions).
   - **Styling & UI:** Tailwind CSS, shadcn/ui, Framer Motion, Lucide icons.
   - **Mobile Native:** Capacitor (iOS/Android shell).

2. **Offline-First Architecture**
   - **PWA Setup:** Service Worker (Workbox) for caching app shell, assets, and APIs (stale-while-revalidate).
   - **Local Database:** IndexedDB (Dexie) for local storage of projects, rooms, captures, and quotes.
   - **Background Sync:** Mutation queue (`pendingJobs`) for offline actions synced to Firebase when online.

3. **Multi-Tiered Entitlement System (SaaS Gating)**
   - **Architecture:** Org-level entitlements (Free vs. Pro) with user-level overrides.
   - **Usage Limits:** Cloud functions track quotas (e.g., 1 capture/week for Free).
   - **UI Integration:** `<EntitlementGuard>` and `<FeatureLock>` components handle premium feature access.

4. **Advanced Capture & Visualization**
   - **Measurements:** AR plane detection (WebXR/Capacitor) or reference-object photogrammetry for computing dimensions.
   - **Recoloring Engine:** HTML Canvas or server-side OpenCV pipeline with edge-aware masks.
   - **PDF Pipeline:** Headless Playwright/Puppeteer via Firebase Functions for generating exportable quotes.

5. **Client Portal / Auth-Free Access**
   - Tokenized routing (`/portal/[token]`) for clients to view estimates, color selections, scheduling, and approve/pay without logging in. Full offline playback support.

6. **Stunning & Dynamic UI**
   - Custom global textures (`textures.css`), soft shadows, clean transitions, and dark mode support. Auto-detection of regional units (Metric/Imperial).

---

## Functional Specifications Roadmap

### 1. Quote Configuration Wizard
- **User Workflow:** Contractors start a new project via a step-by-step interview. Input involves Type (interior/exterior), Substrate (drywall/stucco), and Service Level (Standard/Premium).
- **The Feature:** Generates multiple quote formats dynamically (e.g., Itemized, Room-by-Room, Lump Sum, Labor-only, Material-inclusive).
- **The Edge:** Moves beyond "one-size-fits-all" quoting. Enables contractors to select the format most likely to close the specific client type.

### 2. Room-Centric Enhanced Templates
- **User Workflow:** Contractors create "Room Profiles" during walkthroughs, snapping photos of damage/specific request areas and adding contextual notes.
- **The Feature:** Automatically generates a professional PDF with dedicated pages per room. Each room page details the scope of work, measurements, and visual evidence (photos).
- **The Edge:** Maximizes transparency. Attaching inline photos to the room's quote page eliminates post-project scope disputes (e.g., "I thought the ceiling was included").

### 3. Integrated Estimating & CRM
- **User Workflow:** Leads enter via web/phone, tracking progression from "New" > "Estimate Scheduled" > "Job Won".
- **The Feature:** Built-in job costing and margin calculation based on square footage, prep-time, and material costs.
- **The Edge:** A "paint-aware" CRM. It pre-fills common prep tasks (sanding, caulking, masking) so contractors don't omit labor-intensive prep from their estimates.

### 4. Visual Documentation & Color Visualization
- **User Workflow:** Contractors use the app live during sales calls to visually overlay colors on the client's actual walls.
- **The Feature:** AR or photo-overlay color mapping combined with a "Before and After" portfolio gallery.
- **The Edge:** Keeps the sales process fully embedded within PaintMate, eliminating the need to send clients to third-party vendor sites, and accelerating the close.

### 5. Automated Booking & Production Tracking
- **User Workflow:** Once electronically signed, jobs move to the production calendar. Crew leaders have restricted logins to view assignments and log progress (e.g., "Prep 100%", "Coat One 50%").
- **The Feature:** A real-time executive dashboard summarizing the active status and throughput of all work sites.
- **The Edge:** Full lifecycle management (Quote -> Execution). Business owners track remote production without site visits.

### 6. Labor Cost & Financial Management
- **User Workflow:** Weekly syncs connecting PaintMate's operational data with accounting platforms (e.g., QuickBooks).
- **The Feature:** Direct integration pushing invoices, material receipts, and logged labor hours. Generates an "Estimated vs. Actual" variance report.
- **The Edge:** Provides clarity on profitability at the job level. Contractors instantly see where they bled margin on labor, adjusting future bids accordingly.
