import React, { useMemo } from 'react';
import { SelectOption } from './selectTypes';

function extractText(node: React.ReactNode): string {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join('');
    return '';
}

export function useSelectOptions(
    options: SelectOption[] = [],
    children?: React.ReactNode,
    searchQuery: string = '',
    selectedValue?: unknown
) {
    const childOptions: SelectOption[] = useMemo(() => {
        return React.Children.toArray(children)
            .filter((child): child is React.ReactElement<Record<string, unknown>> =>
                React.isValidElement(child)
            )
            .map((child) => {
                const val =
                    child.props.value !== undefined ? child.props.value : (child.key ?? '');
                const label = child.props.children as React.ReactNode;
                return {
                    id: val as string | number,
                    value: val as string | number,
                    name: label,
                    label,
                    searchText: extractText(label),
                    image: (child.props['data-image'] || child.props.image) as string | undefined,
                    icon: (child.props['data-icon'] || child.props.icon) as SelectOption['icon'],
                    disabled: Boolean(child.props.disabled),
                };
            })
            .filter((opt) => opt.id !== undefined);
    }, [children]);

    const finalOptions: SelectOption[] = useMemo(() => {
        const rawList = options && options.length > 0 ? options : childOptions;
        const mapped: SelectOption[] = rawList.map((opt) => {
            if (typeof opt === 'string' || typeof opt === 'number') {
                return {
                    id: opt,
                    value: opt,
                    name: String(opt),
                    label: String(opt),
                };
            }
            const id =
                opt.value !== undefined
                    ? opt.value
                    : opt.id !== undefined
                      ? opt.id
                      : (opt.key as string | number | undefined);
            const name =
                opt.label !== undefined
                    ? opt.label
                    : opt.name !== undefined
                      ? opt.name
                      : ((opt.title as React.ReactNode) ?? (id !== undefined ? String(id) : ''));
            return {
                ...opt,
                id,
                value: id,
                name,
                label: name,
                image: opt.image || (opt['data-image'] as string | undefined),
                icon: opt.icon || (opt['data-icon'] as SelectOption['icon']),
            };
        });

        if (
            selectedValue !== null &&
            selectedValue !== undefined &&
            selectedValue !== '' &&
            !Array.isArray(selectedValue)
        ) {
            const valStr = String(selectedValue).trim();
            const valLower = valStr.toLowerCase();
            const exists = mapped.some(
                (opt) =>
                    String(opt.id).toLowerCase().trim() === valLower ||
                    String(opt.value).toLowerCase().trim() === valLower ||
                    (opt.key && String(opt.key).toLowerCase().trim() === valLower) ||
                    (opt.name && extractText(opt.name).toLowerCase().trim() === valLower) ||
                    (opt.label && extractText(opt.label).toLowerCase().trim() === valLower)
            );
            if (!exists) {
                mapped.unshift({
                    id: valStr,
                    value: valStr,
                    name: valStr,
                    label: valStr,
                });
            }
        }

        return mapped;
    }, [options, childOptions, selectedValue]);

    const filteredOptions = useMemo(() => {
        if (!searchQuery.trim()) return finalOptions;
        const q = searchQuery.toLowerCase();
        return finalOptions.filter((opt) => {
            const nameStr = extractText(opt.name);
            const labelStr = extractText(opt.label);
            const searchStr = typeof opt.searchText === 'string' ? opt.searchText : '';
            const subtitleStr = typeof opt.subtitle === 'string' ? opt.subtitle : '';
            const badgeStr = typeof opt.badge === 'string' ? opt.badge : '';
            const valStr = opt.value !== undefined ? String(opt.value) : '';
            const idStr = opt.id !== undefined ? String(opt.id) : '';
            return (
                nameStr.toLowerCase().includes(q) ||
                labelStr.toLowerCase().includes(q) ||
                searchStr.toLowerCase().includes(q) ||
                subtitleStr.toLowerCase().includes(q) ||
                badgeStr.toLowerCase().includes(q) ||
                valStr.toLowerCase().includes(q) ||
                idStr.toLowerCase().includes(q)
            );
        });
    }, [finalOptions, searchQuery]);

    return {
        finalOptions,
        filteredOptions,
    };
}

