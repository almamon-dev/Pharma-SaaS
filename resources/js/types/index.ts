export interface User {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    is_super_admin: boolean;
    is_subscriber_admin: boolean;
    account_type: 'super_admin' | 'admin' | 'staff';
    has_usable_subscription: boolean;
    current_tenant_id: number | null;
    current_branch_id: number | null;
}

export interface PlanModuleSummary {
    id: number;
    key: string;
    name: string;
    description?: string | null;
    category?: string;
    is_core?: boolean;
    is_active?: boolean;
}

export interface TenantFeatureItem {
    id?: number;
    key: string;
    name: string;
    description?: string | null;
    category?: string;
    is_core: boolean;
    is_active?: boolean;
    is_enabled?: boolean;
}

export interface PlanSummary {
    id?: number;
    name: string;
    name_bn?: string | null;
    key: string;
    description?: string | null;
    description_bn?: string | null;
    monthly_price?: string | number;
    annual_price?: string | number;
    currency_code?: string;
    trial_days?: number;
    max_pharmacies: number;
    max_branches: number;
    max_users: number;
    max_medicines: number;
    features?: string[];
    features_bn?: string[];
    modules?: PlanModuleSummary[];
    is_popular?: boolean;
    is_active?: boolean;
    is_public?: boolean;
    subscription_status?: string;
}

export interface SubscriptionUsage {
    tenants: number;
    max_tenants: number;
    branches: number;
    max_branches: number;
    employees: number;
    max_users: number;
}

export interface SubscriptionSharedData {
    has_subscription: boolean;
    is_usable: boolean;
    status: string;
    billing_cycle: string;
    amount: number;
    payment_method?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    days_left: number;
    plan?: PlanSummary | null;
    usage: SubscriptionUsage;
}

export interface BranchItem {
    id: number;
    tenant_id?: number;
    tenant_name?: string;
    name: string;
    code: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    is_head_office: boolean;
    is_active?: boolean;
    batches_count?: number;
    sales_count?: number;
}

export interface TenantMembership {
    id: number;
    name: string;
    slug: string;
    domain?: string;
    domain_url?: string;
    status: string;
    city?: string | null;
    role: string;
    roles?: string[];
    role_label: string;
}

export interface CurrentTenant {
    id: number;
    uuid: string;
    name: string;
    slug: string;
    domain?: string | null;
    domain_url?: string | null;
    license_number?: string | null;
    tax_id?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    country: string;
    currency_code: string;
    timezone: string;
    status: string;
    trial_ends_at?: string | null;
    trial_days_left: number;
    settings?: Record<string, unknown>;
    plan?: PlanSummary | null;
}

export interface TenantSharedData {
    currentTenant: CurrentTenant | null;
    currentBranch: BranchItem | null;
    role: string | null;
    roles: string[];
    permissions: string[];
    roleLabel: string | null;
    canManageOrganization: boolean;
    canManageInventory: boolean;
    canEditInventory?: boolean;
    canAdjustInventory?: boolean;
    canManageCrm: boolean;
    canManageBilling: boolean;
    enabledFeatures?: string[];
    features?: TenantFeatureItem[];
    branches: BranchItem[];
    tenants: TenantMembership[];
}

export interface DomainTenantBanner {
    id: number;
    name: string;
    slug: string;
    domain: string;
    city?: string | null;
}

export interface SharedPageProps {
    appName: string;
    tenancy?: {
        baseDomain: string;
        adminDomain?: string;
        adminLoginUrl?: string;
        demoLoginUrl?: string;
        scheme?: string;
        portSuffix?: string;
        domainHost?: string;
        isAdminDomain?: boolean;
        isTenantDomain: boolean;
    };
    domainTenant?: DomainTenantBanner | null;
    auth: {
        user: User | null;
    };
    subscription: SubscriptionSharedData | null;
    tenant: TenantSharedData | null;
    flash: {
        success?: string | null;
        error?: string | null;
    };
    errors: Record<string, string>;
    [key: string]: unknown;
}
