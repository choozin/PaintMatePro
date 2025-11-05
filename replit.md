# PaintPro - Painting Business Management Platform

## Overview

PaintPro is a production-grade SaaS application designed for painting companies to manage quotes, projects, clients, and scheduling. The platform combines modern web technologies with Firebase backend services to deliver a responsive, offline-capable business management solution. The application features an entitlements-based system with tiered pricing (Free, Pro, Enterprise) that controls access to advanced features like AR capture, AI recolor previews, and advanced analytics.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Updates

**2025-11-05: AR Room Scanning Implementation (WebXR)**
- **Completed WebXR AR Scanner** for Android devices using Chrome browser with camera-based room measurement
- Extended Room data schema to support multiple measurement methods (manual, camera-assisted AR, LiDAR)
- **AR Workflow**: User selects rounding preferences (Precise/2"/6"/1' and Round Up/Down) → enters ceiling height → launches AR session → taps 4 floor corners → auto-fills manual fields with rounded measurements
- **AR Components**: ARRoomScanner.tsx with Three.js WebGL renderer, hit-testing for surface detection, visual reticle feedback, and corner markers
- **Measurement Logic**: Calculates opposite-side averages, converts meters to feet, applies user-selected rounding, and computes confidence scores based on measurement consistency
- **Platform Support**: WebXR enabled on Android Chrome; iOS displays "Android only, iOS support coming soon" message (LiDAR upgrade planned)
- **State Management**: Fixed critical bugs using functional setState to avoid stale closure issues in AR event handlers
- **Cleanup**: Proper XR session teardown on unmount to prevent memory leaks
- Data structure supports complex room shapes with wall-by-wall measurements and 3D point data for future enhancements
- All new fields are optional for backward compatibility with existing room data

**2025-11-04: Quote Management System Implemented**
- Created ProjectDetail page with tabs for project overview, room measurements, and quotes
- Integrated RoomMeasurement component with Firebase Firestore for persistent storage
- Integrated QuoteBuilder component with Firebase including auto-generation from rooms
- Material calculation: 400 sq ft/gallon coverage, 2-coat estimation
- Labor estimation: 150 sq ft/hour for wall painting
- Room measurement features: floor area, wall area, total paintable area, paint quantity estimates
- Quote features: line item management, configurable tax rate, validity period, Firebase persistence

## System Architecture

### Frontend Architecture

**Framework**: React 18+ with TypeScript, using Vite as the build tool and development server.

**Routing**: Wouter for client-side routing with a clear separation between authenticated routes (dashboard, projects, clients, quotes, schedule, settings) and public routes (login, client portal).

**UI Component System**: Radix UI primitives wrapped with shadcn/ui design system, following a hybrid design approach inspired by Linear, Material Design, and Notion. The design emphasizes clarity, information density, and progressive disclosure with a custom color system supporting both light and dark themes.

**State Management**: 
- TanStack Query (React Query) for server state management with Firebase Firestore
- React Context for authentication state and user entitlements
- Local component state for UI interactions

**Styling**: Tailwind CSS with custom design tokens defined in CSS variables, featuring a sophisticated elevation system (hover-elevate, active-elevate-2) and carefully calibrated spacing/typography scales.

**Authentication Flow**: Firebase Authentication integrated with React Context (AuthProvider) that manages user sessions, custom claims (orgIds, role), and entitlements. Protected routes automatically redirect unauthenticated users to login.

**Offline Support**: Designed for offline-first operation (indicated by architecture notes) with PWA capabilities, though IndexedDB/Dexie implementation is stubbed for future development.

### Backend Architecture

**Express Server**: Minimal Node.js/Express backend serving the Vite-built frontend in production and proxying requests during development. The server uses ESM modules and includes basic logging middleware.

**Storage Layer**: Abstracted storage interface (IStorage) with in-memory implementation (MemStorage) for development. Production uses Firebase Firestore directly from the client.

**Database Schema**: Drizzle ORM configured for PostgreSQL with schema definition in `shared/schema.ts`. Current schema includes a basic users table. The application is designed to optionally use Drizzle with Postgres, though the primary data layer uses Firebase Firestore.

### Data Architecture

**Firebase Firestore Collections**:
- `orgs`: Organization records with plan type, default units, and region
- `entitlements`: Feature flags per organization controlling access to AR capture, recolor previews, analytics, PDF watermarks, e-signatures, etc.
- `projects`: Project records with status tracking (pending, in-progress, completed, on-hold), client references, location, and dates
- `clients`: Client contact information scoped to organizations
- `rooms`: Room measurements (length, width, height) linked to projects, with automatic area calculations
- `quotes`: Project quotes with line items, subtotal, tax, total, and validity period
- Additional collections planned: measurements (AR/manual), materials (paint inventory)

**Data Access Pattern**: Direct client-side Firestore queries using collection operations (getByOrg, get, create, update, delete) with React Query caching. All queries are scoped by organization ID from user claims to enforce multi-tenancy.

**Security Model**: Firebase Security Rules enforce organization-level access control. Users belong to exactly one organization (stored in custom claims), and all data operations are validated against orgId ownership.

### External Dependencies

**Firebase Services**:
- Firebase Authentication: User authentication with email/password, custom claims for role-based access
- Cloud Firestore: Primary NoSQL database for all application data
- Cloud Storage: File storage for images, PDFs, and documents
- Cloud Functions: Serverless functions for backend operations (e.g., PDF generation, data processing)

**UI Libraries**:
- Radix UI: Accessible component primitives for all interactive elements
- shadcn/ui: Pre-built component library following the "new-york" style variant
- Lucide React: Icon system
- Framer Motion: Animation library (referenced in design docs)

**Development Tools**:
- Drizzle ORM with Drizzle Kit for database migrations
- Neon Database: PostgreSQL provider (configured but optional)
- TypeScript: Full type safety across client and server
- Vite: Build tool with HMR and optimized production builds

**Third-Party Integrations** (Planned/Stubbed):
- AR/CV capabilities for wall capture and measurements
- AI-powered recolor preview system
- PDF rendering pipeline for quotes and job packs
- Paint brand APIs (Benjamin Moore, Sherwin-Williams) for color matching
- Payment processing (referenced in entitlements)
- E-signature services (referenced in entitlements)

**Design System**:
- Google Fonts: Inter (UI/body text) and JetBrains Mono (technical data)
- Tailwind CSS with custom configuration for spacing, colors, and border radius
- CSS custom properties for theming with automatic dark mode support

**Regional Support**: Application includes region detection and metric/imperial unit system toggle with user override capabilities.

**Deployment Target**: Designed for Replit deployment with support for standard Node.js hosting environments. Build outputs to `dist/public` for static assets and `dist` for server bundle.