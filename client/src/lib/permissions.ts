export type GlobalRole = 'platform_owner' | 'platform_support' | 'platform_user' | 'org_owner' | 'org_admin';

export type OrgRole = string; // Now dynamic IDs or Names

// Comprehensive Permissions List
export type Permission =
    // 1. Administrative
    | 'manage_org'          // Manage general settings (branding, units)
    | 'manage_users'        // Invite, edit, or remove users
    | 'manage_roles'        // Create and edit custom roles
    | 'view_activity_logs'  // View audit trails

    // 2. Financials & Payroll
    | 'view_financials'     // View dashboards, revenue, profit margins
    | 'view_payroll'        // View employee timesheets and pay
    | 'manage_payroll'      // Approve timesheets, export payroll
    | 'view_labor_rates'    // See specific hourly cost of employees

    // 3. Projects
    | 'view_projects'       // Basic read access
    | 'create_projects'     // Create new projects
    | 'edit_project_details'// Edit address, notes, specs
    | 'delete_projects'     // Permanently remove projects
    | 'archive_projects'    // Move to only viewable in archive
    | 'view_full_work_order' // View all restricted fields

    // 4. Estimating & Quotes
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
    | 'log_crew_time';      // Clock in/out for others

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
                'manage_org', 'manage_users', 'manage_roles', 'view_activity_logs',
                'view_financials', 'view_payroll', 'manage_payroll', 'view_labor_rates',
                'view_projects', 'create_projects', 'edit_project_details', 'delete_projects', 'archive_projects', 'view_full_work_order',
                'create_quotes', 'view_quote_margins', 'approve_quotes', 'send_quotes',
                'view_catalog', 'manage_catalog', 'view_item_costs',
                'view_clients', 'manage_clients', 'delete_clients', 'view_client_contact',
                'view_schedule', 'manage_schedule', 'log_own_time', 'log_crew_time'
            ];
        case 'manager':
            return [
                'manage_users', 'view_payroll', 'manage_payroll',
                'view_projects', 'create_projects', 'edit_project_details', 'archive_projects', 'view_full_work_order',
                'create_quotes', 'view_quote_margins', 'approve_quotes', 'send_quotes',
                'view_catalog', 'manage_catalog', 'view_item_costs',
                'view_clients', 'manage_clients', 'view_client_contact',
                'view_schedule', 'manage_schedule', 'log_own_time', 'log_crew_time'
            ];
        case 'estimator':
            return [
                'view_projects', 'create_projects', 'edit_project_details', 'view_full_work_order',
                'create_quotes', 'view_quote_margins', 'send_quotes',
                'view_catalog', 'view_item_costs',
                'view_clients', 'manage_clients', 'view_client_contact',
                'view_schedule', 'log_own_time'
            ];
        case 'foreman':
            return [
                'view_projects', 'view_full_work_order',
                'view_catalog',
                'view_clients', 'view_client_contact',
                'view_schedule', 'manage_schedule',
                'log_own_time', 'log_crew_time'
            ];
        case 'painter':
        case 'subcontractor':
            return [
                'view_projects',
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
    if (role === 'owner') return 'org_owner';
    if (role === 'admin') return 'org_admin';
    if (role === 'member') return 'painter'; // Default fallback for old 'member'
    return role;
}

// UI Metadata for Permissions
export const PERMISSION_GROUPS = [
    {
        id: 'admin',
        label: 'Administrative',
        permissions: [
            { id: 'manage_org' as Permission, label: 'Manage Organization', description: 'Edit org settings, branding, and billing.' },
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
            { id: 'view_payroll' as Permission, label: 'View Payroll', description: 'View employee timesheets and calculated pay.' },
            { id: 'manage_payroll' as Permission, label: 'Manage Payroll', description: 'Approve timesheets and export payroll data.' },
            { id: 'view_labor_rates' as Permission, label: 'View Labor Rates', description: 'See sensitive hourly cost of employees.' },
        ]
    },
    {
        id: 'projects',
        label: 'Projects',
        permissions: [
            { id: 'view_projects' as Permission, label: 'View Projects', description: 'Read access to project list and details.' },
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
    }
];
