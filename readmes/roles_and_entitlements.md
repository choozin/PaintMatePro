# Architecture: Roles vs. Entitlements

When building PaintMatePro, we enforce two completely distinct layers of access control. It is critical to understand the difference between **User Role Permissions** (Internal Access) and **Organization Entitlements** (Billing & Paid Features).

## 1. User Role Permissions (Internal Access)
**Purpose:** Restricts what specific employees can do within an organization to prevent accidents or unauthorized internal actions.
**Scope:** Defined per user, per organization (a user might be an `Admin` in Org A, but a `Painter` in Org B).
**Source of Truth:** Defines as 30 distinct strings in `client/src/lib/permissions.ts` (e.g., `manage_catalog`, `view_financials`, `delete_projects`).
**UI Behavior:** If a user completely lacks a permission, the corresponding UI element (button, link, page) should simply be **hidden or disabled**. 
*Crucially: We DO NOT use the FeatureLock (blur) effect here. If a user can't click "Delete Project" because they are a Painter, we don't tease them to upgrade. The organization already has the feature; the admin just hasn't given this user the key.*

## 2. Organization Entitlements (Billing / Paid Features)
**Purpose:** Restricts what the entire Organization can do based on their subscription tier (Free vs. Pro vs. Enterprise) or purchased add-ons.
**Scope:** Defined per Organization. Applies equally to the Owner and all their employees.
**Source of Truth:** Defined in `client/src/lib/firestore.ts` inside the `ALL_BOOLEAN_FEATURES` array (16 distinct features like `eSign`, `quote.tiers`, `capture.ar`). Stored in the `entitlements` Firestore collection.
**UI Behavior:** 
- **Internal Users (Contractors):** If the org does not have an entitlement, we DO NOT hide it. We wrap it in a `<FeatureLock>`, putting a frosted-glass blur over the element and a Tooltip that says "Upgrade to Unlock". This is a core growth mechanic to tease premium features to Free users.
- **External Users (Clients in Portal):** If the org lacks an entitlement, the feature is simply **hidden**. We never show the frosted-glass upsell to the contractor's end-client.

## 3. Advanced Entitlements: Trials and Usage Limits
The `entitlements.features` object in Firestore is a flexible `Record<string, any>`. While most features are booleans (`true`/`false`), the system is designed to handle complex limits:
- **Usage Limits:** e.g., `capture.weeklyLimit: 5`
- **Time-bound Trials:** To offer a feature for a limited time, an entitlement can be stored as an object: `eSign: { enabled: true, expiresAt: 1735689600 }`. The `useEntitlements` hook contains logic to parse these objects, verify the expiration date against the current time, and dynamically lock the feature if the trial has expired.
