import React, { useMemo } from 'react';
import { Camera } from 'lucide-react';
import { BarcodeSvg } from '@/Components/BarcodeSvg';
import { HorizontalFormRow } from '@/Components/ui/FormLayout';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { Textarea } from '@/Components/ui/Textarea';

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <Input
                label="Medicine Name"
                required
                placeholder="Napa Extend"
                value={data.name}
                onChange={(e) => onChangeField('name', e.target.value)}
                error={errors.name}
            />
            <Input
                label="SKU Code"
                required
                placeholder="Auto from Name + Strength"
                value={data.sku}
                onChange={(e) => onChangeField('sku', e.target.value)}
                className="font-mono text-[12px]"
                error={errors.sku}
            />
            <Input
                label="Generic Name"
                placeholder="Paracetamol"
                value={data.generic_name}
                onChange={(e) => onChangeField('generic_name', e.target.value)}
                error={errors.generic_name}
            />
            <Input
                label="Manufacturer"
                placeholder="Beximco Pharma"
                value={data.manufacturer}
                onChange={(e) => onChangeField('manufacturer', e.target.value)}
                error={errors.manufacturer}
            />
            <Input
                label="Barcode (EAN)"
                placeholder="Scan box barcode or auto EAN-13"
                value={data.barcode}
                onChange={(e) => onChangeField('barcode', e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                    }
                }}
                className="pr-10 font-mono text-[12px]"
                rightIcon={
                    <button
                        type="button"
                        onClick={onOpenCamera}
                        title="Scan barcode with camera"
                        aria-label="Scan barcode with camera"
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#FF4A1F] cursor-pointer"
                    >
                        <Camera className="h-3.5 w-3.5" />
                    </button>
                }
                error={errors.barcode}
            />
            <Select
                label="Category"
                value={data.category_id}
                options={categoryOptions}
                onChange={(e) =>
                    onChangeField('category_id', String(e.target.value))
                }
                error={errors.category_id}
            />

            {data.barcode.trim() && (
                <div className="md:col-span-2">
                    <HorizontalFormRow label="Barcode Preview">
                        <div className="flex items-center justify-between gap-3 rounded-[2px] border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#151921] px-3 py-2">
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                Live Box Barcode
                            </span>
                            <BarcodeSvg
                                value={data.barcode}
                                height={28}
                                barWidth={1.3}
                                fontSize={10}
                            />
                        </div>
                    </HorizontalFormRow>
                </div>
            )}

            <Select
                label="Dosage Form"
                required
                value={data.dosage_form}
                options={dosageFormOptions}
                onChange={(e) =>
                    onChangeField('dosage_form', String(e.target.value))
                }
                error={errors.dosage_form}
            />
            <Input
                label="Strength"
                placeholder="500mg"
                value={data.strength}
                onChange={(e) => onChangeField('strength', e.target.value)}
                error={errors.strength}
            />
            <Select
                label="Base Unit"
                required
                value={data.unit}
                options={unitOptions}
                onChange={(e) =>
                    onChangeField('unit', String(e.target.value))
                }
                error={errors.unit}
            />
            <Input
                label="Reorder Level"
                type="number"
                required
                value={data.reorder_level}
                onChange={(e) =>
                    onChangeField('reorder_level', e.target.value)
                }
                error={errors.reorder_level}
            />
            <Input
                label="Pcs / Strip"
                type="number"
                min="1"
                placeholder="10"
                value={data.units_per_strip}
                onChange={(e) =>
                    onChangeField('units_per_strip', e.target.value)
                }
                error={errors.units_per_strip}
            />
            <Input
                label="Pcs / Box"
                type="number"
                min="1"
                placeholder="100"
                value={data.units_per_box}
                onChange={(e) =>
                    onChangeField('units_per_box', e.target.value)
                }
                error={errors.units_per_box}
            />
            <Input
                label="Purchase / Pc"
                type="number"
                step="0.01"
                required={!data.box_purchase_price}
                placeholder="1.50"
                value={data.purchase_price}
                onChange={(e) =>
                    onPiecePriceChange('purchase', e.target.value)
                }
                error={errors.purchase_price}
            />
            <Input
                label="Box Purchase"
                type="number"
                step="0.01"
                placeholder="150.00"
                value={data.box_purchase_price}
                onChange={(e) =>
                    onBoxPriceChange('purchase', e.target.value)
                }
                error={errors.box_purchase_price}
            />
            <Input
                label="Selling / Pc"
                type="number"
                step="0.01"
                required={!data.box_selling_price}
                placeholder="2.00"
                value={data.selling_price}
                onChange={(e) =>
                    onPiecePriceChange('selling', e.target.value)
                }
                error={errors.selling_price}
            />
            <Input
                label="Box Selling"
                type="number"
                step="0.01"
                placeholder="195.00"
                value={data.box_selling_price}
                onChange={(e) =>
                    onBoxPriceChange('selling', e.target.value)
                }
                error={errors.box_selling_price}
            />

            <div className="md:col-span-2">
                <Textarea
                    label="Clinical Notes"
                    rows={2}
                    placeholder="Optional cold-chain instruction, shelf note, or clinical storage guidance..."
                    value={data.description}
                    onChange={(e) => onChangeField('description', e.target.value)}
                    error={errors.description}
                />
            </div>

            <div className="md:col-span-2">
                <HorizontalFormRow label="Prescription">
                    <label className="flex items-center gap-2 h-[30px] text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={data.requires_prescription}
                            onChange={(e) =>
                                onChangeField('requires_prescription', e.target.checked)
                            }
                            className="table-checkbox"
                        />
                        Requires valid medical prescription (Rx)
                    </label>
                </HorizontalFormRow>
            </div>
        </div>
    );
};

