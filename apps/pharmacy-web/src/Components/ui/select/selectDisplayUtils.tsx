import React from 'react';
import { LucideIcon } from 'lucide-react';
import { SelectOption } from './selectTypes';

export const getRawValue = (val: unknown): unknown => {
    if (Array.isArray(val)) {
        return val.map((v) =>
            typeof v === 'object' && v !== null
                ? ((v as SelectOption).id ?? (v as SelectOption).value)
                : v
        );
    }
    if (typeof val === 'object' && val !== null) {
        return (val as SelectOption).id ?? (val as SelectOption).value ?? '';
    }
    return val ?? '';
};

export const renderSelectedDisplay = (
    multiple: boolean,
    normalizedValue: unknown,
    finalOptions: SelectOption[],
    placeholder: string,
    size: 'sm' | 'md' | 'lg',
    Icon?: LucideIcon | React.ElementType
) => {
    if (multiple) {
        const valArr = Array.isArray(normalizedValue) ? normalizedValue : [];
        const selectedItems = finalOptions.filter((opt) =>
            valArr
                .map((v) => String(v).toLowerCase().trim())
                .includes(String(opt.id).toLowerCase().trim())
        );
        if (selectedItems.length === 0) {
            if (valArr.length > 0) {
                return (
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">
                        {valArr.length} selected
                    </span>
                );
            }
            return <span className="text-slate-400 font-normal">{placeholder}</span>;
        }
        return (
            <span className="text-slate-800 dark:text-slate-200 font-semibold">
                {selectedItems.length} selected
            </span>
        );
    }

    if (normalizedValue === null || normalizedValue === undefined || normalizedValue === '') {
        const emptyOpt = finalOptions.find(
            (opt) => opt.id === '' || opt.value === ''
        );
        if (emptyOpt) {
            return (
                <span className="truncate font-medium text-slate-600 dark:text-slate-300">
                    {emptyOpt.name || emptyOpt.label}
                </span>
            );
        }
        return <span className="text-slate-400 font-normal">{placeholder}</span>;
    }

    const normStr = String(normalizedValue).trim();
    if (!normStr) return <span className="text-slate-400 font-normal">{placeholder}</span>;
    const normLower = normStr.toLowerCase();

    let selected = finalOptions.find(
        (opt) =>
            String(opt.id) === normStr ||
            String(opt.value) === normStr ||
            (opt.rawId && String(opt.rawId) === normStr)
    );

    if (!selected) {
        selected = finalOptions.find(
            (opt) =>
                String(opt.id).toLowerCase().trim() === normLower ||
                String(opt.value).toLowerCase().trim() === normLower ||
                (opt.key && String(opt.key).toLowerCase().trim() === normLower) ||
                (typeof opt.name === 'string' && opt.name.toLowerCase().trim() === normLower) ||
                (typeof opt.label === 'string' && opt.label.toLowerCase().trim() === normLower)
        );
    }

    if (!selected) {
        return (
            <div className="flex items-center gap-1.5 truncate">
                <span className="truncate text-slate-800 dark:text-slate-200 font-medium">
                    {normStr}
                </span>
            </div>
        );
    }

    const IconComp = typeof selected.icon === 'function' ? selected.icon : null;

    return (
        <div className="flex items-center gap-1.5 truncate">
            {selected.image && (
                <img
                    src={
                        selected.image.startsWith('http')
                            ? selected.image
                            : `/storage/${selected.image}`
                    }
                    className="w-3.5 h-3.5 object-contain shrink-0"
                    alt=""
                />
            )}
            {selected.icon && !Icon && (
                IconComp ? (
                    <IconComp
                        size={size === 'sm' ? 13 : 14}
                        className="shrink-0 text-slate-500 dark:text-slate-400"
                    />
                ) : React.isValidElement(selected.icon) ? (
                    <span className="shrink-0 text-slate-500 dark:text-slate-400">
                        {selected.icon}
                    </span>
                ) : null
            )}
            <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                {selected.selectedLabel || selected.name || selected.label}
            </span>
            {selected.badge && (
                <span
                    className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-[2px] shrink-0 ${
                        selected.badgeColor === 'subcontractor'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50'
                    }`}
                >
                    {selected.badge}
                </span>
            )}
        </div>
    );
};

