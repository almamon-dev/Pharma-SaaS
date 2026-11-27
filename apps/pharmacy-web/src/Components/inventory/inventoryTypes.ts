export interface MedicineRow {
    id: number;
    category_id?: string;
    name: string;
    generic_name?: string | null;
    manufacturer?: string | null;
    sku: string;
    barcode?: string | null;
    dosage_form: string;
    strength?: string | null;
    description?: string | null;
    unit: string;
    units_per_strip: number;
    units_per_box: number;
    category_name: string;
    reorder_level: number;
    requires_prescription: boolean;
    default_purchase_price: number;
    box_purchase_price?: number | null;
    default_selling_price: number;
    box_selling_price?: number | null;
    is_active: boolean;
    available_stock: number;
    expired_stock?: number;
    is_low_stock: boolean;
    nearest_expiry?: string | null;
    days_to_expiry?: number | null;
    batch_count: number;
    total_batch_count?: number;
    stock_purchase_value?: number;
    stock_retail_value?: number;
    expired_stock_value?: number;
}

export interface BatchRow {
    id: number;
    medicine_id?: number;
    medicine_name?: string;
    medicine_sku?: string;
    unit?: string;
    branch_id: number;
    branch_name: string;
    branch_code: string;
    supplier_id?: number | null;
    supplier_name?: string | null;
    batch_number: string;
    manufacturing_date?: string | null;
    expiry_date?: string | null;
    days_remaining?: number | null;
    is_expired: boolean;
    effective_status: string;
    status: string;
    quantity_received: number;
    quantity_available: number;
    purchase_price: number;
    selling_price: number;
    stock_cost_value?: number;
    rack_location?: string | null;
    disposal_reason?: string | null;
    disposed_at?: string | null;
    disposed_by_name?: string | null;
    notes?: string | null;
}

export interface StockMovementRow {
    id: number;
    occurred_at?: string | null;
    medicine_id?: number;
    medicine_name?: string;
    medicine_sku?: string;
    unit?: string;
    batch_number?: string;
    branch_name?: string;
    branch_code?: string;
    movement_type: string;
    movement_label: string;
    direction?: 'in' | 'out';
    quantity_change: number;
    balance_before: number;
    balance_after: number;
    unit_cost: number;
    total_cost: number;
    reason?: string | null;
    notes?: string | null;
    user_name: string;
}

export interface BranchFilterOption {
    id: number;
    name: string;
    code: string;
    is_head_office?: boolean;
}

export interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
}

export function generateEan13Preview(): string {
    const randomTen = Math.floor(Math.random() * 10_000_000_000)
        .toString()
        .padStart(10, '0');
    const base = `20${randomTen}`;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return `${base}${checkDigit}`;
}

export interface MedicineSearchOption {
    id: number;
    name: string;
    generic_name?: string | null;
    sku: string;
    unit: string;
    units_per_box: number;
    default_purchase_price: number;
    default_selling_price: number;
}

/**
 * Triggers a browser CSV download for inventory tables without duplicating escaping logic.
 */
export function downloadCsv(
    filename: string,
    headers: string[],
    rows: Array<Array<string | number | null | undefined>>
): void {
    const escape = (val: string | number | null | undefined) => {
        const str = val === null || val === undefined ? '' : String(val);
        return `"${str.replace(/"/g, '""')}"`;
    };
    const csv = [
        headers.map(escape).join(','),
        ...rows.map((row) => row.map(escape).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

