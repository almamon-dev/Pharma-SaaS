import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SelectOption, SelectProps } from './selectTypes';
import { useSelectOptions } from './useSelectOptions';
import { SelectPortalMenu } from './SelectPortalMenu';
import { getRawValue, renderSelectedDisplay } from './selectDisplayUtils';

export type { SelectOption, SelectProps };

export default function Select({
    value,
    onChange,
    options = [],
    placeholder = 'Select...',
    label,
    required = false,
    id,
    ariaLabel,
    className = '',
    triggerClassName = '',
    size = 'md',
    name = '',
    multiple = false,
    disabled = false,
    showSearch,
    direction = 'down',
    onCreate: onCreateProp,
    icon: Icon,
    error,
    children,
}: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dropdownPos, setDropdownPos] = useState<{
        top?: number;
        bottom?: number;
        left: number;
        width: number;
        maxHeight?: number;
        placement: 'down' | 'up';
    }>({ left: 0, width: 200, placement: 'down' });

    const triggerRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

    const rawValue = getRawValue(value);
    const normalizedValue = multiple
        ? Array.isArray(rawValue)
            ? rawValue
            : rawValue
              ? [rawValue]
              : []
        : rawValue;

    const { finalOptions, filteredOptions } = useSelectOptions(
        options,
        children,
        searchQuery,
        normalizedValue
    );
    const shouldShowSearch = showSearch !== undefined ? showSearch : finalOptions.length > 6;

    const isSelected = (optId: unknown) => {
        if (multiple) {
            return (
                Array.isArray(normalizedValue) &&
                normalizedValue
                    .map((v) => String(v).toLowerCase().trim())
                    .includes(String(optId).toLowerCase().trim())
            );
        }
        const normLower = String(normalizedValue ?? '').toLowerCase().trim();
        const optLower = String(optId ?? '').toLowerCase().trim();
        if (normLower === '' || optLower === '') return false;
        if (normLower === optLower) return true;
        const matchedOpt = finalOptions.find(
            (o) => String(o.id ?? o.value).toLowerCase().trim() === optLower
        );
        if (matchedOpt && matchedOpt.rawId) {
            return String(matchedOpt.rawId).toLowerCase().trim() === normLower;
        }
        return false;
    };

    const handleSelectOption = (option: SelectOption) => {
        const optId = (option.id !== undefined ? option.id : option.value) as string | number;
        if (multiple) {
            const currentArr = Array.isArray(normalizedValue) ? [...normalizedValue] : [];
            const index = currentArr.findIndex((v) => String(v) === String(optId));
            const newArr = (
                index > -1
                    ? currentArr.filter((v) => String(v) !== String(optId))
                    : [...currentArr, optId]
            ) as (string | number)[];

            if (onChange) {
                onChange({
                    target: { name, value: newArr },
                    id: newArr,
                    value: newArr,
                });
            }
        } else {
            if (onChange) {
                onChange({
                    target: { name, value: optId ?? '' },
                    id: optId ?? '',
                    value: optId ?? '',
                    name: option.name || option.label,
                    label: option.name || option.label,
                });
            }
            setIsOpen(false);
        }
    };

    const handleToggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;

        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;

            const count = finalOptions.length || 1;
            const hasSubtitles = finalOptions.some((o) => Boolean(o.subtitle));
            const itemHeight = hasSubtitles ? 46 : size === 'sm' ? 32 : 36;
            const searchHeight = shouldShowSearch ? 45 : 0;
            const estimatedHeight = Math.min(300, count * itemHeight + searchHeight + 10);

            let placement: 'down' | 'up' = 'down';
            if (direction === 'up') {
                placement = 'up';
            } else if (direction === 'down') {
                if (spaceBelow < 120 && spaceAbove > spaceBelow) {
                    placement = 'up';
                } else {
                    placement = 'down';
                }
            } else if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
                placement = 'up';
            }

            let top: number | undefined;
            let bottom: number | undefined;
            let maxHeight: number;

            if (placement === 'up') {
                bottom = Math.max(8, window.innerHeight - rect.top + 4);
                maxHeight = Math.min(300, Math.max(100, spaceAbove - 16));
            } else {
                top = rect.bottom + 4;
                maxHeight = Math.min(300, Math.max(100, spaceBelow - 16));
            }

            const width = size === 'sm' ? Math.max(rect.width, 160) : Math.max(140, rect.width);
            let left = rect.left;
            if (left + width > window.innerWidth - 12) {
                left = Math.max(10, rect.right - width);
            }

            setDropdownPos({ top, bottom, left, width, maxHeight, placement });
            setSearchQuery('');
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        if (isOpen && shouldShowSearch) {
            setTimeout(() => {
                searchInputRef.current?.focus({ preventScroll: true });
            }, 90);
        }
    }, [isOpen, shouldShowSearch]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        const handleScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target?.closest?.('.custom-select-portal-menu')) return;
            setIsOpen(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    const renderLabel = (labelStr: string) => {
        if (labelStr.endsWith('*')) {
            const baseText = labelStr.slice(0, -1).trim();
            return (
                <>
                    {baseText} <span className="text-[#C9302C] font-bold ml-0.5">*</span>
                </>
            );
        }
        return (
            <>
                {labelStr}
                {required && <span className="text-[#C9302C] font-bold ml-0.5">*</span>}
            </>
        );
    };

    return (
        <div
            className={cn(
                'w-full relative flex flex-col gap-1 font-sans',
                className,
                disabled && 'cursor-not-allowed pointer-events-none'
            )}
        >
            {label && (
                <label
                    htmlFor={selectId}
                    className="text-[13px] font-semibold text-[#333333] dark:text-slate-200 font-sans"
                >
                    {renderLabel(label)}
                </label>
            )}
            <button
                ref={triggerRef}
                id={selectId}
                type="button"
                aria-label={ariaLabel || label}
                onClick={handleToggle}
                disabled={disabled}
                className={cn(
                    'relative w-full cursor-pointer rounded-[2px] border bg-white dark:bg-[#1e2329] text-left font-normal text-[#333333] dark:text-white outline-none focus:outline-none focus:ring-0 transition-colors flex items-center shadow-none disabled:cursor-not-allowed disabled:bg-[#EDEDED] disabled:text-[#4A4A4A] disabled:border-[#CCCCCC] dark:disabled:bg-slate-800/80 dark:disabled:text-slate-300',
                    size === 'sm'
                        ? 'h-[30px] text-xs py-0.5 pr-7'
                        : size === 'lg'
                          ? 'h-[42px] text-sm py-2 pr-9'
                          : 'h-[36px] text-[13px] py-1 pr-8',
                    error
                        ? 'border-[#C9302C]'
                        : 'border-[#CCCCCC] dark:border-[#384150]',
                    Icon ? (size === 'sm' ? 'pl-8' : 'pl-9') : size === 'sm' ? 'pl-2.5' : 'pl-3',
                    triggerClassName
                )}
            >
                {Icon && (
                    <span
                        className={cn(
                            'pointer-events-none absolute inset-y-0 left-0 flex items-center text-[#666666] dark:text-slate-400',
                            size === 'sm' ? 'pl-2.5' : 'pl-3'
                        )}
                    >
                        <Icon size={size === 'sm' ? 13 : 14} aria-hidden="true" />
                    </span>
                )}
                <span
                    className={cn(
                        'block truncate',
                        multiple ? 'break-words whitespace-normal pb-0.5' : 'truncate'
                    )}
                >
                    {renderSelectedDisplay(
                        multiple,
                        normalizedValue,
                        finalOptions,
                        placeholder,
                        size,
                        Icon
                    )}
                </span>
                <span
                    className={cn(
                        'pointer-events-none absolute inset-y-0 right-0 flex items-center text-[#555555] dark:text-slate-400',
                        size === 'sm' ? 'pr-2' : 'pr-2.5'
                    )}
                >
                    <ChevronDown
                        size={size === 'sm' ? 13 : 14}
                        aria-hidden="true"
                        className={cn(
                            'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                            isOpen && 'rotate-180'
                        )}
                    />
                </span>
            </button>

            <SelectPortalMenu
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                dropdownPos={dropdownPos}
                shouldShowSearch={shouldShowSearch}
                searchInputRef={searchInputRef}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filteredOptions={filteredOptions}
                size={size}
                isSelected={isSelected}
                onSelectOption={handleSelectOption}
                onCreate={
                    onCreateProp
                        ? (createdName) => {
                              onCreateProp(createdName);
                              setSearchQuery('');
                          }
                        : undefined
                }
            />

            {typeof error === 'string' && error && (
                <span className="text-[12px] text-[#d82c0d] mt-0.5 font-sans">{error}</span>
            )}
        </div>
    );
}

