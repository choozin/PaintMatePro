export type GlobalRole = 'platform_owner' | 'platform_support' | 'platform_user';

export type OrgRole =
    | 'org_owner'
    | 'org_admin'
    | 'manager'
    | 'estimator'
    | 'foreman'
    | 'painter'
    | 'subcontractor';

// Permissions
export type Permission =
    | 'manage_org'          // Edit org settings, billing
    | 'manage_users'        // Invite/edit/remove users
    | 'view_payroll'        // View payroll dashboard and rates
    | 'manage_payroll'      // Approve timesheets, export payroll
    | 'create_quotes'       // Create and edit quotes
    | 'view_contract_value' // See $ amounts on projects/quotes
    | 'manage_schedule'     // Assign crews, move items
    | 'view_full_work_order'// See all project details including restricted fields if any
    | 'log_crew_time'       // Log time for others
    | 'log_own_time';       // Log time for self

const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
    org_owner: [
        'manage_org', 'manage_users', 'view_payroll', 'manage_payroll',
        'create_quotes', 'view_contract_value', 'manage_schedule',
        'view_full_work_order', 'log_crew_time', 'log_own_time'
    ],
    org_admin: [
        'manage_org', 'manage_users', 'view_payroll', 'manage_payroll',
        'create_quotes', 'view_contract_value', 'manage_schedule',
        'view_full_work_order', 'log_crew_time', 'log_own_time'
    ],
    manager: [
        'manage_users', 'view_payroll', 'manage_payroll',
        'create_quotes', 'view_contract_value', 'manage_schedule',
        'view_full_work_order', 'log_crew_time', 'log_own_time'
    ],
    estimator: [
        'create_quotes', 'view_contract_value',
        'view_full_work_order', 'log_own_time'
    ],
    foreman: [
        'view_full_work_order', 'log_crew_time', 'log_own_time'
    ],
    painter: [
        'log_own_time'
    ],
    subcontractor: [
        'log_own_time'
    ]
};

export function hasPermission(role: OrgRole | null, permission: Permission): boolean {
    if (!role) return false;
    // Legacy mapping fallbacks if needed, but perfer normalization
    const normalizedRole = normalizeRole(role as string) as OrgRole;
    return ROLE_PERMISSIONS[normalizedRole]?.includes(permission) ?? false;
}

export function canHaveRole(currentUserRole: OrgRole, targetRole: OrgRole): boolean {
    const normalizedCurrent = normalizeRole(currentUserRole as string) as OrgRole;

    // Owner: Assign anyone to any role other than owner
    if (normalizedCurrent === 'org_owner') {
        return targetRole !== 'org_owner';
    }

    // Admin: Assign anyone to any role other than owner or admin
    if (normalizedCurrent === 'org_admin') {
        return targetRole !== 'org_owner' && targetRole !== 'org_admin';
    }

    // Manager: Assign anyone to any role other than owner, admin, or manager
    if (normalizedCurrent === 'manager') {
        return !['org_owner', 'org_admin', 'manager'].includes(targetRole);
    }

    // Others: Cannot assign roles
    return false;
}

// Helper to map legacy roles to new roles if needed
export function normalizeRole(role: string): OrgRole | string {
    if (role === 'owner') return 'org_owner';
    if (role === 'admin') return 'org_admin';
    if (role === 'member') return 'painter'; // Default fallback for old 'member'
    return role;
}
