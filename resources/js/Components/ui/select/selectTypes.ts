import React from 'react';
import { LucideIcon } from 'lucide-react';
import { FormLayoutMode } from '@/Components/ui/FormLayout';

export interface SelectOption {
    id?: string | number;
    value?: string | number;
    name?: string | React.ReactNode;
    label?: string | React.ReactNode;
    selectedLabel?: string;
    subtitle?: string | React.ReactNode;
    badge?: string;
    badgeColor?:
        | 'fleet'
        | 'subcontractor'
        | 'neutral'
        | 'success'
        | 'info'
        | 'warning'
        | 'danger';
    searchText?: string;
    image?: string;
    icon?: LucideIcon | React.ElementType | React.ReactNode;
    disabled?: boolean;
    [key: string]: unknown;
}

export interface SelectChangeEvent {
    target: { name: string; value: string | number | (string | number)[] };
    id: string | number | (string | number)[];
    value: string | number | (string | number)[];
    name?: string | React.ReactNode;
    label?: string | React.ReactNode;
}

export interface SelectProps {
    value?: unknown;
    onChange?: (e: SelectChangeEvent) => void;
    options?: SelectOption[];
    placeholder?: string;
    label?: string;
    required?: boolean;
    id?: string;
    ariaLabel?: string;
    className?: string;
    triggerClassName?: string;
    size?: 'sm' | 'md' | 'lg';
    name?: string;
    multiple?: boolean;
    disabled?: boolean;
    showSearch?: boolean;
    direction?: 'up' | 'down';
    onCreate?: (name: string) => void;
    icon?: LucideIcon | React.ElementType;
    children?: React.ReactNode;
    error?: string | boolean;
    layout?: FormLayoutMode;
    labelWidth?: string;
}

