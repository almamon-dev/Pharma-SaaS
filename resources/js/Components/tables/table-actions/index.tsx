import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit, Eye, MoreVertical, Trash2 } from 'lucide-react';

export interface TableActionItem {
    key?: string;
    label: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    href?: string;
    target?: string;
    variant?: 'default' | 'danger' | 'brand';
    disabled?: boolean;
    hidden?: boolean;
}

export interface TableActionMenuProps {
    items: TableActionItem[];
    label?: string;
    className?: string;
}

export function TableActionMenu({
    items,
    label = 'Row actions',
    className = '',
}: TableActionMenuProps) {
    const visibleItems = items.filter((item) => !item.hidden);
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<{
        top?: number;
        bottom?: number;
        right: number;
    }>({ top: 0, right: 0 });

    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const estimatedHeight = visibleItems.length * 34 + 12;
        const openUpward = rect.bottom + estimatedHeight > window.innerHeight - 12;

        setCoords({
            top: openUpward ? undefined : rect.bottom + 4,
            bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
            right: Math.max(8, window.innerWidth - rect.right),
        });
    };

    const toggleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!open) {
            updatePosition();
        }
        setOpen((prev) => !prev);
    };

    useEffect(() => {
        if (!open) return;

        const handleOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                triggerRef.current?.contains(target) ||
                menuRef.current?.contains(target)
            ) {
                return;
            }
            setOpen(false);
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        const handleCloseOnViewportChange = () => setOpen(false);

        document.addEventListener('mousedown', handleOutside);
        document.addEventListener('keydown', handleEscape);
        window.addEventListener('scroll', handleCloseOnViewportChange, true);
        window.addEventListener('resize', handleCloseOnViewportChange);

        return () => {
            document.removeEventListener('mousedown', handleOutside);
            document.removeEventListener('keydown', handleEscape);
            window.removeEventListener(
                'scroll',
                handleCloseOnViewportChange,
                true
            );
            window.removeEventListener('resize', handleCloseOnViewportChange);
        };
    }, [open]);

    if (visibleItems.length === 0) {
        return <span className="text-[11px] text-slate-300">—</span>;
    }

    const itemTone = (variant?: TableActionItem['variant']) => {
        if (variant === 'danger') {
            return 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30';
        }
        if (variant === 'brand') {
            return 'text-[#FF4A1F] hover:bg-orange-50 dark:hover:bg-[#ff4a1f]/15';
        }
        return 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800';
    };

    return (
        <div
            className={`inline-flex items-center justify-end ${className}`}
            data-no-click
        >
            <button
                ref={triggerRef}
                type="button"
                onClick={toggleOpen}
                aria-label={label}
                aria-expanded={open}
                aria-haspopup="menu"
                className={`h-7 w-7 inline-flex items-center justify-center rounded-[3px] border transition-colors cursor-pointer outline-none ${
                    open
                        ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
            >
                <MoreVertical className="h-4 w-4" />
            </button>

            {open &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="menu"
                        data-no-click
                        style={{
                            position: 'fixed',
                            top: coords.top,
                            bottom: coords.bottom,
                            right: coords.right,
                        }}
                        className="z-[90] min-w-[164px] rounded-[4px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] py-1 shadow-lg font-sans"
                    >
                        {visibleItems.map((item, idx) => {
                            const itemKey = item.key ?? `${item.label}-${idx}`;
                            const classes = `w-full px-3 py-1.5 text-left text-[12px] font-medium flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${itemTone(
                                item.variant
                            )}`;

                            if (item.href) {
                                return (
                                    <a
                                        key={itemKey}
                                        role="menuitem"
                                        href={item.href}
                                        target={item.target}
                                        rel={
                                            item.target === '_blank'
                                                ? 'noreferrer'
                                                : undefined
                                        }
                                        onClick={() => setOpen(false)}
                                        className={classes}
                                    >
                                        {item.icon && (
                                            <span className="inline-flex shrink-0 opacity-85">
                                                {item.icon}
                                            </span>
                                        )}
                                        <span>{item.label}</span>
                                    </a>
                                );
                            }

                            return (
                                <button
                                    key={itemKey}
                                    type="button"
                                    role="menuitem"
                                    disabled={item.disabled}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpen(false);
                                        item.onClick?.();
                                    }}
                                    className={classes}
                                >
                                    {item.icon && (
                                        <span className="inline-flex shrink-0 opacity-85">
                                            {item.icon}
                                        </span>
                                    )}
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>,
                    document.body
                )}
        </div>
    );
}

export interface TableActionsProps<T = any> {
    item: T;
    onView?: (item: T) => void;
    onEdit?: (item: T) => void;
    onDelete?: (item: T) => void;
    className?: string;
}

export default function TableActions<T = any>({
    item,
    onView,
    onEdit,
    onDelete,
    className = '',
}: TableActionsProps<T>) {
    return (
        <TableActionMenu
            className={className}
            items={[
                {
                    key: 'view',
                    label: 'View Details',
                    icon: <Eye className="h-3.5 w-3.5" />,
                    onClick: () => onView?.(item),
                    hidden: !onView,
                },
                {
                    key: 'edit',
                    label: 'Edit',
                    icon: <Edit className="h-3.5 w-3.5" />,
                    onClick: () => onEdit?.(item),
                    hidden: !onEdit,
                },
                {
                    key: 'delete',
                    label: 'Delete',
                    icon: <Trash2 className="h-3.5 w-3.5" />,
                    variant: 'danger',
                    onClick: () => onDelete?.(item),
                    hidden: !onDelete,
                },
            ]}
        />
    );
}
