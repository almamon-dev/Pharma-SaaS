import React, { useMemo } from 'react';
import { Camera } from 'lucide-react';
import { BarcodeSvg } from '@/Components/BarcodeSvg';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { Textarea } from '@/Components/ui/Textarea';
import { BrtaField, BrtaFormGrid, BrtaOptionItem, BrtaOptionStrip, brtaInputClass, brtaTextareaClass } from '@/Components/ui/BrtaForm';
import { generateEan13Preview } from './inventoryTypes';

export interface MedicineFormValues {
    name: string;
    generic_name: string;
    manufacturer: string;
    sku: string;
    barcode: string;
    category_id: string;
    dosage_form: string;
    strength: string;
    description: string;
    unit: string;
    units_per_strip: string;
    units_per_box: string;
    reorder_level: string;
    requires_prescription: boolean;
    purchase_price: string;
    box_purchase_price: string;
    selling_price: string;
    box_selling_price: string;
}

interface MedicineFormFieldsProps {
    data: MedicineFormValues;
    errors: Partial<Record<keyof MedicineFormValues | string, string>>;
    categories: Array<{ id: number; name: string }>;
    onChangeField: <K extends keyof MedicineFormValues>(
        field: K,
        value: MedicineFormValues[K]
    ) => void;
    onPiecePriceChange: (kind: 'purchase' | 'selling', value: string) => void;
    onBoxPriceChange: (kind: 'purchase' | 'selling', value: string) => void;
    onOpenCamera: () => void;
}

const BASE_DOSAGE_FORMS = [
    'tablet',
    'chewable tablet',
    'capsule',
    'syrup',
    'dry syrup',
    'injection',
    'cream',
    'drops',
    'inhaler',
    'other',
];

const BASE_UNITS = ['pcs', 'tablet', 'capsule', 'bottle', 'strip', 'box', 'tube', 'vial'];

export const MedicineFormFields: React.FC<MedicineFormFieldsProps> = ({
    data,
    errors,
    categories,
    onChangeField,
    onPiecePriceChange,
    onBoxPriceChange,
    onOpenCamera,
}) => {
    const categoryOptions = useMemo(
        () => [
            { id: '', value: '', name: 'Uncategorized' },
            ...categories.map((cat) => ({
                id: cat.id,
                value: String(cat.id),
                name: cat.name,
            })),
        ],
        [categories]
    );

    const dosageFormOptions = useMemo(() => {
        const list = [...BASE_DOSAGE_FORMS];
        if (
            data.dosage_form &&
            !list.some((item) => item.toLowerCase() === data.dosage_form.toLowerCase())
        ) {
            list.unshift(data.dosage_form);
        }
        return list.map((form) => ({
            id: form,
            value:
                form.toLowerCase() === data.dosage_form.toLowerCase()
                    ? data.dosage_form
                    : form.charAt(0).toUpperCase() + form.slice(1),
            name: form.charAt(0).toUpperCase() + form.slice(1),
        }));
    }, [data.dosage_form]);

    const unitOptions = useMemo(() => {
        const list = [...BASE_UNITS];
        if (
            data.unit &&
            !list.some((item) => item.toLowerCase() === data.unit.toLowerCase())
        ) {
            list.unshift(data.unit);
        }
        return list.map((unit) => ({
            id: unit,
            value:
                unit.toLowerCase() === data.unit.toLowerCase()
                    ? data.unit
                    : unit.charAt(0).toUpperCase() + unit.slice(1),
            name: unit.charAt(0).toUpperCase() + unit.slice(1),
        }));
    }, [data.unit]);

    return (
        <div className="space-y-4">
            <BrtaFormGrid>
                <BrtaField label="Medicine Name" required error={errors.name}>
                    <input
                        required
                        placeholder="Napa Extend"
                        value={data.name}
                        onChange={(e) => onChangeField('name', e.target.value)}
                        className={brtaInputClass}
                    />
                </BrtaField>
                <BrtaField label="SKU Code" required error={errors.sku}>
                    <input
                        required
                        placeholder="MED-NAPA-665"
                        value={data.sku}
                        onChange={(e) => onChangeField('sku', e.target.value)}
                        className={`${brtaInputClass} font-mono`}
                    />
                </BrtaField>
                <BrtaField label="Barcode (EAN)" error={errors.barcode}>
                    <div className="flex items-center gap-1.5">
                        <input
                            placeholder="Scan or Auto EAN-13"
                            value={data.barcode}
                            onChange={(e) => onChangeField('barcode', e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') e.preventDefault();
                            }}
                            className={`${brtaInputClass} font-mono`}
                        />
                        <button
                            type="button"
                            onClick={() => onChangeField('barcode', generateEan13Preview())}
                            title="Auto-generate valid EAN-13 barcode"
                            className="h-[36px] px-2.5 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-[#F5F7F4] dark:bg-slate-800 text-[11.5px] font-bold text-[#333333] dark:text-slate-200 hover:border-[#0E5F3F] hover:text-[#0E5F3F] cursor-pointer shrink-0"
                        >
                            Auto
                        </button>
                        <button
                            type="button"
                            onClick={onOpenCamera}
                            title="Scan barcode with camera"
                            className="h-[36px] px-2 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-[#F5F7F4] dark:bg-slate-800 text-[#444444] hover:border-[#0E5F3F] hover:text-[#0E5F3F] cursor-pointer shrink-0"
                        >
                            <Camera className="h-4 w-4" />
                        </button>
                    </div>
                </BrtaField>
                <BrtaField label="Generic Name" error={errors.generic_name}>
                    <input
                        placeholder="Paracetamol"
                        value={data.generic_name}
                        onChange={(e) => onChangeField('generic_name', e.target.value)}
                        className={brtaInputClass}
                    />
                </BrtaField>
                <BrtaField label="Manufacturer" error={errors.manufacturer}>
                    <input
                        placeholder="Beximco Pharma"
                        value={data.manufacturer}
                        onChange={(e) => onChangeField('manufacturer', e.target.value)}
                        className={brtaInputClass}
                    />
                </BrtaField>
                <BrtaField label="Category" error={errors.category_id}>
                    <Select
                        value={data.category_id}
                        options={categoryOptions}
                        onChange={(e) => onChangeField('category_id', String(e.target.value))}
                    />
                </BrtaField>
                <BrtaField label="Dosage Form" required error={errors.dosage_form}>
                    <Select
                        required
                        value={data.dosage_form}
                        options={dosageFormOptions}
                        onChange={(e) => onChangeField('dosage_form', String(e.target.value))}
                    />
                </BrtaField>
                <BrtaField label="Strength" error={errors.strength}>
                    <input
                        placeholder="500mg"
                        value={data.strength}
                        onChange={(e) => onChangeField('strength', e.target.value)}
                        className={brtaInputClass}
                    />
                </BrtaField>
                <BrtaField label="Base Unit" required error={errors.unit}>
                    <Select
                        required
                        value={data.unit}
                        options={unitOptions}
                        onChange={(e) => onChangeField('unit', String(e.target.value))}
                    />
                </BrtaField>
                <BrtaField label="Pcs / Strip" error={errors.units_per_strip}>
                    <input
                        type="number"
                        min="1"
                        placeholder="10"
                        value={data.units_per_strip}
                        onChange={(e) => onChangeField('units_per_strip', e.target.value)}
                        className={`${brtaInputClass} font-mono`}
                    />
                </BrtaField>
                <BrtaField label="Pcs / Box" error={errors.units_per_box}>
                    <input
                        type="number"
                        min="1"
                        placeholder="100"
                        value={data.units_per_box}
                        onChange={(e) => onChangeField('units_per_box', e.target.value)}
                        className={`${brtaInputClass} font-mono`}
                    />
                </BrtaField>
                <BrtaField label="Reorder Level" required error={errors.reorder_level}>
                    <input
                        type="number"
                        required
                        value={data.reorder_level}
                        onChange={(e) => onChangeField('reorder_level', e.target.value)}
                        className={`${brtaInputClass} font-mono`}
                    />
                </BrtaField>
                <BrtaField label="Purchase / Pc" required={!data.box_purchase_price} error={errors.purchase_price}>
                    <input
                        type="number"
                        step="0.01"
                        required={!data.box_purchase_price}
                        placeholder="1.50"
                        value={data.purchase_price}
                        onChange={(e) => onPiecePriceChange('purchase', e.target.value)}
                        className={`${brtaInputClass} font-mono`}
                    />
                </BrtaField>
                <BrtaField label="Box Purchase" error={errors.box_purchase_price}>
                    <input
                        type="number"
                        step="0.01"
                        placeholder="150.00"
                        value={data.box_purchase_price}
                        onChange={(e) => onBoxPriceChange('purchase', e.target.value)}
                        className={`${brtaInputClass} font-mono`}
                    />
                </BrtaField>
                <BrtaField label="Selling / Pc" required={!data.box_selling_price} error={errors.selling_price}>
                    <input
                        type="number"
                        step="0.01"
                        required={!data.box_selling_price}
                        placeholder="2.00"
                        value={data.selling_price}
                        onChange={(e) => onPiecePriceChange('selling', e.target.value)}
                        className={`${brtaInputClass} font-mono`}
                    />
                </BrtaField>
                <BrtaField label="Box Selling" error={errors.box_selling_price}>
                    <input
                        type="number"
                        step="0.01"
                        placeholder="195.00"
                        value={data.box_selling_price}
                        onChange={(e) => onBoxPriceChange('selling', e.target.value)}
                        className={`${brtaInputClass} font-mono`}
                    />
                </BrtaField>
            </BrtaFormGrid>

            {data.barcode.trim() && (
                <BrtaField label="Barcode Preview">
                    <div className="flex items-center justify-between gap-3 rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-[#F8FAF8] dark:bg-[#151921] px-3 py-1.5">
                        <span className="text-[11.5px] font-medium text-[#555555] dark:text-slate-400">Live EAN-13</span>
                        <BarcodeSvg value={data.barcode} height={26} barWidth={1.3} fontSize={10} />
                    </div>
                </BrtaField>
            )}

            <BrtaField label="Clinical Notes" alignTop error={errors.description}>
                <textarea
                    rows={2}
                    placeholder="Optional cold-chain instruction, shelf note, or clinical storage guidance..."
                    value={data.description}
                    onChange={(e) => onChangeField('description', e.target.value)}
                    className={brtaTextareaClass}
                />
            </BrtaField>

            <BrtaField label="Compliance Flag">
                <BrtaOptionStrip>
                    <BrtaOptionItem>
                        <input
                            type="checkbox"
                            checked={data.requires_prescription}
                            onChange={(e) => onChangeField('requires_prescription', e.target.checked)}
                            className="accent-[#337AB7]"
                        />
                        <span>Requires valid medical prescription (Rx)</span>
                    </BrtaOptionItem>
                </BrtaOptionStrip>
            </BrtaField>
        </div>
    );
};

