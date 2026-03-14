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

## Lessons Learned & Best Practices (from App-Wide Audit)
To ensure code quality and avoid regressions, adhere to these guidelines:

1. **React Hooks & Side Effects**:
   *   **Never** call mutations (e.g., `updateInvoice.mutate()`) or side-effects inside `useMemo`. `useMemo` is strictly for derived data computation.
   *   If an aggregation or scan requires a side-effect (like auto-marking invoices as overdue on load), use a `useEffect` guarded by a `useRef` to guarantee it only runs once per mount cycle and prevents infinite re-render loops.
   *   **Never** declare a `useMemo` block inline directly within the `return` JSX (e.g., inside a sub-component's prop assignment). This can violate the Rules of Hooks by running conditionally. Compute the memoized value *above* the return statement.

2. **Dialog State Bleed**:
   *   When building Dialog components (like `RecordPaymentDialog` or modals used for creating/editing), always include a `useEffect` keyed on the `open` prop to explicitly reset all state variables to their defaults when the dialog opens. Otherwise, stale state from the previous interaction will carry over.

3. **Data Integrity & Initialization**:
   *   Do not hardcode business logic variables (like tax rates) in local `useState`. Always initialize them by reading from the backend organization/estimating settings (`org.estimatingSettings`).
   *   If a value (like `taxRate`) is required for future calculations (e.g., when reloading a saved quote), explicitly persist it to the database at save time rather than trying to back-calculate it from the grand total later, which causes rounding errors.
   *   When creating core objects (like new Projects), make sure to immediately inherit relevant templates/settings (e.g., `defaultQuoteTemplateId` from org settings) so downstream features work correctly without requiring manual configuration.

4. **UI Consistent Patterns**:
   *   Use Radix UI `toast` and standard dialogs (e.g., `AlertDialog`) for destructive warnings or error handling, rather than native browser `window.confirm()` or `alert()`.
   *   For sum aggregations (e.g., "Collected This Month"), ensure you loop through all detailed transaction arrays (like partial `payments[]` on an invoice) rather than relying solely on high-level status timestamps (like `paidAt`), which might only capture fully-paid events.
