export interface PharmacistBranchContext {
    tenant_id: number;
    tenant_name: string;
    branch_id: number;
    branch_name: string;
    branch_code: string;
    today_display: string;
    pharmacist_name: string;
}

export interface PharmacistKpis {
    prescriptions_waiting: number;
    urgent_waiting: number;
    dispensed_today: number;
    low_stock_count: number;
    expiring_60_days: number;
}

export interface PrescriptionMedicineItem {
    id: string;
    name: string;
    generic: string;
    dose: string;
    duration: string;
    batch_number: string;
    expiry_date: string;
    stock_status: 'in_stock' | 'low' | 'out_of_stock';
    check_status: 'ok' | 'allergy' | 'interaction';
    check_label: string;
    is_controlled: boolean;
    is_expired_blocked: boolean;
}

export interface PrescriptionRecord {
    id: string;
    rx_number: string;
    status: 'waiting' | 'dispensed' | 'rejected';
    urgent: boolean;
    waiting_minutes: number;
    waiting_label: string;
    received_at: string;
    doctor_name: string;
    department: string;
    patient: {
        name: string;
        age: number;
        sex: string;
        phone: string;
        allergies: string[];
    };
    allergy_alert: {
        allergen: string;
        offending_medicine: string;
        message: string;
    } | null;
    interaction_alert: {
        pair: string;
        severity: string;
        message: string;
    } | null;
    expired_skipped_note: string | null;
    doctor_notified: boolean;
    doctor_notified_at: string | null;
    doctor_notified_note: string | null;
    dispensed_by: string | null;
    dispensed_at: string | null;
    allergy_override_note?: string | null;
    controlled_register_ref?: string | null;
    rejected_reason: string | null;
    rejected_by?: string | null;
    rejected_at?: string | null;
    medicines: PrescriptionMedicineItem[];
}

export interface PharmacistAlertItem {
    id: string;
    tone: 'red' | 'amber' | 'green';
    title: string;
    detail: string;
    meta: string;
}

export interface LowStockItem {
    key: string;
    medicine_name: string;
    generic_name: string;
    reorder_level: number;
    current_qty: number;
    unit: string;
    stock_status: 'low' | 'out_of_stock';
    requested: boolean;
}

export interface ExpiringBatchItem {
    id: string;
    medicine_name: string;
    generic_name: string;
    batch_number: string;
    expiry_date: string;
    days_left: number;
    status: 'expired_blocked' | 'critical' | 'expiring_soon';
}

export interface MedicineDirectoryItem {
    id: number;
    name: string;
    generic_name: string;
    dosage_form: string;
    manufacturer: string;
    requires_prescription: boolean;
    stock_status: 'in_stock' | 'low' | 'out_of_stock';
}

export interface PharmacistAuditItem {
    id: number;
    action: string;
    description: string;
    user_name: string;
    metadata?: Record<string, unknown>;
    created_at: string | null;
}

