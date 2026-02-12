# Development Workflow & Standards

This document outlines the core development philosophies and standards for PaintMatePro to ensure consistency as the project scales.

## Core Philosophy

1.  **Mobile-First Design**:
    *   The application is primarily designed for mobile usage (iOS and Android via Capacitor).
    *   UI components should be touch-friendly and responsive.
    *   **Navigation**: The sidebar/navigation drawer should default to **CLOSED** on public pages (Login, Portal) and on mobile views to maximize screen real estate.

2.  **Offline-First Architecture**:
    *   Critical features (Estimating, Time Tracking, Notes) must function without an active internet connection.
    *   Data is synchronized locally using Dexie (planned) or Firestore offline persistence.

## Application Structure

### Authentication & Routing
*   **Public Routes**: Login and Client Portal pages are accessible without auth.
    *   *Standard*: Navigation is hidden or closed by default.
*   **Private Routes**: Dashboard and management pages require `ProtectedRoute`.
*   **Global Admin**: Users with `platform_owner` or `platform_admin` roles have a global view.
    *   If logging in without a specific organization context, they are routed to `OrgSelection` to choose an organization to manage.

### Data Access Layer
*   **Firestore operations**: All database interactions are centralized in `client/src/lib/firestore.ts`.
    *   **Pattern**: Export `[entity]Operations` objects (e.g., `orgOperations`, `projectOperations`) containing CRUD methods.
    *   **Hook Usage**: Use `client/src/hooks/` for React component data fetching (e.g., `useFirestoreCollection`).

## Git & Version Control
*   **Branching**: Feature branches should be used for new development.
*   **Commits**: Use descriptive commit messages.

## Environment Setup
*   Ensure `.env` contains all necessary Firebase configuration keys.
*   Run `npm run dev` for local development.
