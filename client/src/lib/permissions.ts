export type GlobalRole = 'platform_owner' | 'platform_support' | 'platform_user' | 'org_owner' | 'org_admin';

export type OrgRole = string; // Now dynamic IDs or Names

// Comprehensive Permissions List
export type Permission =
    // 1. Administrative
    | 'view_organization'   // View organization page
    | 'manage_org'          // Master permission (Legacy)
    | 'manage_org_general'  // Tab: General
    | 'manage_org_branding' // Tab: Branding
    | 'manage_org_estimating'// Tab: Estimating Defaults
    | 'manage_org_quoting'   // Tab: Quoting
    | 'manage_org_employees' // Tab: Employees
    | 'manage_org_crews'     // Tab: Crews
    | 'manage_org_supply_rules' // Tab: Supply Rules
    | 'manage_users'        // Invite, edit, or remove users
    | 'manage_roles'        // Create and edit custom roles
    | 'view_activity_logs'  // View audit trails

    // 2. Financials & Payroll
    | 'view_financials'     // View dashboards, revenue, profit margins
    | 'view_timesheets'     // View Timesheets nav item
    | 'view_payroll'        // View employee timesheets and pay
    | 'manage_payroll'      // Export payroll, configure pay periods
    | 'approve_timesheets'  // Approve/reject submitted timesheets
    | 'view_labor_rates'    // See specific hourly cost of employees

    // 3. Projects
    | 'view_projects'       // Basic read access (full details)
    | 'view_project_snapshot'// Read-only glance view for field workers
    | 'create_projects'     // Create new projects
    | 'edit_project_details'// Edit address, notes, specs
    | 'delete_projects'     // Permanently remove projects
    | 'archive_projects'    // Move to only viewable in archive
    | 'view_full_work_order' // View all restricted fields

    // 4. Estimating & Quotes
    | 'view_quotes'         // View Quotes nav item
    | 'create_quotes'       // Build and save quotes
    | 'view_quote_margins'  // See internal margins/markups
    | 'approve_quotes'      // Mark quotes as approved
    | 'send_quotes'         // Email quotes to clients

    // 5. Catalog & Pricing
    | 'view_catalog'        // View items and standard prices
    | 'manage_catalog'      // Add/Edit/Delete items and change costs
    | 'view_item_costs'     // See internal unit costs

    // 6. Clients
    | 'view_clients'        // View client list
    | 'manage_clients'      // Create/Edit clients
    | 'delete_clients'      // Delete clients
    | 'view_client_contact' // See phone/email

    // 7. Scheduling & Operations
    | 'view_schedule'       // View calendar
    | 'manage_schedule'     // Drag/drop events, assign crews
    | 'log_own_time'        // Clock in/out for self
    | 'log_crew_time'       // Clock in/out for others

    // 8. Invoicing & Payments
    | 'view_invoices'       // View invoice list and details
    | 'create_invoices'     // Create and edit draft invoices
    | 'manage_invoices'     // Send, void, and manage invoice lifecycle
    | 'record_payments';    // Record manual payments (cash/check/transfer)

// REMOVED: HARDCODED ROLE_PERMISSIONS
// We now rely on the database 'roles' collection.

/**
 * Checks if the user's permission set includes the required permission.
 * Now generic and decoupled from hardcoded roles.
 */
export function hasPermission(userPermissions: Permission[], requiredPermission: Permission): boolean {
    if (!userPermissions) return false;
    return userPermissions.includes(requiredPermission);
}

// Temporary / Legacy Helper: Used during migration to map old string roles to a default set
// This allows the app to function if the DB hasn't been seeded yet (fallback).
export function getLegacyFallbackPermissions(role: string): Permission[] {
    const normalized = normalizeRole(role);
    switch (normalized) {
        case 'org_owner':
        case 'org_admin':
            return [
                'view_organization', 'manage_org', 'manage_org_general', 'manage_org_branding', 'manage_org_estimating',
                'manage_org_quoting', 'manage_org_employees', 'manage_org_crews', 'manage_org_supply_rules',
                'manage_users', 'manage_roles', 'view_activity_logs',
                'view_financials', 'view_timesheets', 'view_payroll', 'manage_payroll', 'view_labor_rates',
                'view_projects', 'view_project_snapshot', 'create_projects', 'edit_project_details', 'delete_projects', 'archive_projects', 'view_full_work_order',
                'view_quotes', 'create_quotes', 'view_quote_margins', 'approve_quotes', 'send_quotes',
                'view_catalog', 'manage_catalog', 'view_item_costs',
                'view_clients', 'manage_clients', 'delete_clients', 'view_client_contact',
                'view_schedule', 'manage_schedule', 'log_own_time', 'log_crew_time',
                'view_invoices', 'create_invoices', 'manage_invoices', 'record_payments'
            ];
        case 'manager':
            return [
                'manage_users', 'view_timesheets', 'view_payroll', 'manage_payroll',
                'view_projects', 'view_project_snapshot', 'create_projects', 'edit_project_details', 'archive_projects', 'view_full_work_order',
                'view_quotes', 'create_quotes', 'view_quote_margins', 'approve_quotes', 'send_quotes',
                'view_catalog', 'manage_catalog', 'view_item_costs',
                'view_clients', 'manage_clients', 'view_client_contact',
                'view_schedule', 'manage_schedule', 'log_own_time', 'log_crew_time',
                'view_invoices', 'create_invoices'
            ];
        case 'estimator':
            return [
                'view_projects', 'view_project_snapshot', 'create_projects', 'edit_project_details', 'view_full_work_order',
                'view_quotes', 'create_quotes', 'view_quote_margins', 'send_quotes',
                'view_catalog', 'view_item_costs',
                'view_clients', 'manage_clients', 'view_client_contact',
                'view_schedule', 'log_own_time'
            ];
        case 'foreman':
            return [
                'view_projects', 'view_project_snapshot', 'view_full_work_order',
                'view_catalog',
                'view_clients', 'view_client_contact',
                'view_schedule', 'manage_schedule',
                'log_own_time', 'log_crew_time'
            ];
        case 'painter':
        case 'subcontractor':
            return [
                'view_project_snapshot',
                'view_schedule',
                'log_own_time'
            ];
        default:
            return [];
    }
}

export function canHaveRole(currentUserRole: OrgRole, targetRole: OrgRole): boolean {
    // Logic needs to be updated to check permissions (e.g. 'manage_roles') instead of hardcoded role names.
    // For now, we return true to unblock the Admin UI, relying on 'manage_roles' permission guard instead.
    return true;
}

// Helper to map legacy roles to new roles if needed
export function normalizeRole(role: string): OrgRole | string {
    if (!role) return 'painter';
    const lowRole = role.toLowerCase();
    if (lowRole === 'owner') return 'org_owner';
    if (lowRole === 'admin') return 'org_admin';
    if (lowRole === 'member') return 'painter'; // Default fallback for old 'member'
    return lowRole;
}

// UI Metadata for Permissions
export const PERMISSION_GROUPS = [
    {
        id: 'admin',
        label: 'Administrative',
        permissions: [
            { id: 'view_organization' as Permission, label: 'Access Organization Page', description: 'Allows viewing the Organization settings page.' },
            { id: 'manage_org' as Permission, label: 'Manage Organization (Legacy Master)', description: 'Historical permission. Grants wide access.' },
            { id: 'manage_org_general' as Permission, label: 'Org Tab: General', description: 'Access the General settings tab in Organization.' },
            { id: 'manage_org_branding' as Permission, label: 'Org Tab: Branding', description: 'Access the Branding tab in Organization.' },
            { id: 'manage_org_estimating' as Permission, label: 'Org Tab: Estimating', description: 'Access the Estimating Defaults tab in Organization.' },
            { id: 'manage_org_quoting' as Permission, label: 'Org Tab: Quoting', description: 'Access the Quoting customization tab in Organization.' },
            { id: 'manage_org_employees' as Permission, label: 'Org Tab: Employees', description: 'Access the Employees tab in Organization.' },
            { id: 'manage_org_crews' as Permission, label: 'Org Tab: Crews', description: 'Access the Crews tab in Organization.' },
            { id: 'manage_org_supply_rules' as Permission, label: 'Org Tab: Supply Rules', description: 'Access the Supply Rules tab in Organization.' },
            { id: 'manage_users' as Permission, label: 'Manage Users', description: 'Invite, edit, or remove users.' },
            { id: 'manage_roles' as Permission, label: 'Manage Roles', description: 'Create and edit custom roles and permissions.' },
            { id: 'view_activity_logs' as Permission, label: 'View Activity Logs', description: 'View audit trails of user actions.' },
        ]
    },
    {
        id: 'financials',
        label: 'Financials & Payroll',
        permissions: [
            { id: 'view_financials' as Permission, label: 'View Financials', description: 'View revenue dashboards and profit margins.' },
            { id: 'view_timesheets' as Permission, label: 'View Timesheets', description: 'Access to timesheets nav item.' },
            { id: 'view_payroll' as Permission, label: 'View Payroll', description: 'View employee timesheets and calculated pay.' },
            { id: 'manage_payroll' as Permission, label: 'Manage Payroll', description: 'Export payroll data and configure pay periods.' },
            { id: 'approve_timesheets' as Permission, label: 'Approve Timesheets', description: 'Approve or reject submitted employee timesheets.' },
            { id: 'view_labor_rates' as Permission, label: 'View Labor Rates', description: 'See sensitive hourly cost of employees.' },
        ]
    },
    {
        id: 'projects',
        label: 'Projects',
        permissions: [
            { id: 'view_projects' as Permission, label: 'View Projects', description: 'Read access to project list and full details.' },
            { id: 'view_project_snapshot' as Permission, label: 'View Project Snapshot', description: 'Read-only access to basic project info from schedule.' },
            { id: 'create_projects' as Permission, label: 'Create Projects', description: 'Ability to create new projects.' },
            { id: 'edit_project_details' as Permission, label: 'Edit Project Details', description: 'Edit project address, notes, and specs.' },
            { id: 'delete_projects' as Permission, label: 'Delete Projects', description: 'Permanently remove projects.' },
            { id: 'archive_projects' as Permission, label: 'Archive Projects', description: 'Move projects to archive.' },
            { id: 'view_full_work_order' as Permission, label: 'View Full Work Order', description: 'See all restricted fields on work orders.' },
        ]
    },
    {
        id: 'quotes',
        label: 'Estimating & Quotes',
        permissions: [
            { id: 'view_quotes' as Permission, label: 'View Quotes', description: 'Access to quotes nav item.' },
            { id: 'create_quotes' as Permission, label: 'Create Quotes', description: 'Build and save quotes.' },
            { id: 'view_quote_margins' as Permission, label: 'View Quote Margins', description: 'See internal profit margins and markups.' },
            { id: 'approve_quotes' as Permission, label: 'Approve Quotes', description: 'Mark quotes as manually approved.' },
            { id: 'send_quotes' as Permission, label: 'Send Quotes', description: 'Email quotes directly to clients.' },
        ]
    },
    {
        id: 'catalog',
        label: 'Catalog & Pricing',
        permissions: [
            { id: 'view_catalog' as Permission, label: 'View Catalog', description: 'View items and standard prices.' },
            { id: 'manage_catalog' as Permission, label: 'Manage Catalog', description: 'Add/Edit/Delete items and change base costs.' },
            { id: 'view_item_costs' as Permission, label: 'View Item Costs', description: 'See internal unit costs vs prices.' },
        ]
    },
    {
        id: 'clients',
        label: 'Clients',
        permissions: [
            { id: 'view_clients' as Permission, label: 'View Clients', description: 'View client list.' },
            { id: 'manage_clients' as Permission, label: 'Manage Clients', description: 'Create and edit client details.' },
            { id: 'delete_clients' as Permission, label: 'Delete Clients', description: 'Delete client records.' },
            { id: 'view_client_contact' as Permission, label: 'View Client Contact Info', description: 'See phone numbers and emails.' },
        ]
    },
    {
        id: 'schedule',
        label: 'Scheduling & Operations',
        permissions: [
            { id: 'view_schedule' as Permission, label: 'View Schedule', description: 'View the calendar.' },
            { id: 'manage_schedule' as Permission, label: 'Manage Schedule', description: 'Drag/drop events and assign crews.' },
            { id: 'log_own_time' as Permission, label: 'Log Own Time', description: 'Clock in/out for self.' },
            { id: 'log_crew_time' as Permission, label: 'Log Crew Time', description: 'Clock in/out for others.' },
        ]
    },
    {
        id: 'invoicing',
        label: 'Invoicing & Payments',
        permissions: [
            { id: 'view_invoices' as Permission, label: 'View Invoices', description: 'View invoice list and details.' },
            { id: 'create_invoices' as Permission, label: 'Create Invoices', description: 'Create and edit draft invoices.' },
            { id: 'manage_invoices' as Permission, label: 'Manage Invoices', description: 'Send, void, and manage invoice lifecycle.' },
            { id: 'record_payments' as Permission, label: 'Record Payments', description: 'Record manual payments (cash, check, transfer).' },
        ]
    }
];
