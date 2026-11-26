import React, { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { ChevronRight, Lock } from 'lucide-react';

export interface SidebarSubItem {
    name: string;
    href: string;
    active: boolean;
    badge?: number | string | null;
    locked?: boolean;
}

export interface SidebarGroupItem {
    group: string;
    icon: React.ElementType;
    items: SidebarSubItem[];
}

interface NavGroupProps {
    item: SidebarGroupItem;
    isOpen: boolean;
    onClose?: () => void;
}

const persistedExpandedGroups = new Set<string>();

export const NavGroup: React.FC<NavGroupProps> = ({
    item,
    isOpen,
    onClose,
}) => {
    const isActiveGroup = item.items.some((sub) => sub.active);
    const [isExpanded, setIsExpanded] = useState(
        () => isActiveGroup || persistedExpandedGroups.has(item.group)
    );

    useEffect(() => {
        if (isActiveGroup) {
            persistedExpandedGroups.add(item.group);
            setIsExpanded(true);
        }
    }, [isActiveGroup, item.group]);

    const toggleExpanded = () => {
        setIsExpanded((prev) => {
            const next = !prev;
            if (next) {
                persistedExpandedGroups.add(item.group);
            } else {
                persistedExpandedGroups.delete(item.group);
            }
            return next;
        });
    };

    if (!item.items.length) return null;

    const Icon = item.icon;
    const activeIdx = item.items.findIndex((sub) => sub.active);

    return (
        <div className="mb-0.5">
            <button
                type="button"
                onClick={toggleExpanded}
                title={!isOpen ? item.group : undefined}
                className={`w-full flex items-center ${
                    isOpen ? 'justify-between px-3' : 'justify-center'
                } py-2 rounded-[2px] text-[13.5px] font-medium transition-colors group cursor-pointer ${
                    isActiveGroup
                        ? 'text-[#0E5F3F] dark:text-emerald-400 font-semibold bg-[#EAF5F0] dark:bg-slate-800/80'
                        : 'text-[#333333] dark:text-slate-400 hover:text-[#0E5F3F] dark:hover:text-slate-100 hover:bg-[#F5F7F4] dark:hover:bg-slate-800/40'
                }`}
            >
                <div
                    className={`flex items-center ${
                        isOpen ? 'gap-2.5' : 'justify-center'
                    }`}
                >
                    <Icon
                        size={19}
                        strokeWidth={1.7}
                        className={
                            isActiveGroup
                                ? 'text-[#0E5F3F] dark:text-emerald-400'
                                : 'text-[#666666] dark:text-slate-500 group-hover:text-[#0E5F3F] dark:group-hover:text-slate-300'
                        }
                    />
                    {isOpen && (
                        <span className="whitespace-nowrap">{item.group}</span>
                    )}
                </div>
                {isOpen && (
                    <ChevronRight
                        size={16}
                        strokeWidth={1.5}
                        className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${
                            isExpanded ? 'rotate-90' : ''
                        }`}
                    />
                )}
            </button>

            {isExpanded && (
                <div
                    className={`${
                        isOpen ? 'relative ml-[22px] pr-2' : 'px-1'
                    } mb-1 mt-0.5`}
                >
                    {item.items.map((subItem, sIdx) => {
                        const isActive = subItem.active;
                        const isLast = sIdx === item.items.length - 1;
                        const isBeforeActive =
                            activeIdx !== -1 && sIdx < activeIdx;
                        const isCurrentActive =
                            activeIdx !== -1 && sIdx === activeIdx;

                        return (
                            <Link
                                key={subItem.href}
                                href={subItem.href}
                                onClick={() => {
                                    if (window.innerWidth < 1024) {
                                        onClose?.();
                                    }
                                }}
                                title={!isOpen ? subItem.name : undefined}
                                className={`relative flex items-center ${
                                    isOpen
                                        ? 'justify-between py-1.5 pl-[18px] pr-1.5'
                                        : 'justify-center py-2'
                                } rounded-[2px] text-[13px] transition-colors group ${
                                    isActive
                                        ? 'text-[#0E5F3F] dark:text-emerald-400 font-bold'
                                        : 'text-[#444444] dark:text-slate-400 font-medium hover:text-[#0E5F3F] dark:hover:text-slate-200'
                                }`}
                            >
                                {isOpen && (
                                    <>
                                        <div
                                            className={`absolute left-0 top-0 h-1/2 w-[1.5px] transition-colors ${
                                                isBeforeActive ||
                                                isCurrentActive
                                                    ? 'bg-[#0E5F3F] dark:bg-emerald-500'
                                                    : 'bg-[#CCCCCC] dark:bg-slate-700'
                                            }`}
                                        />
                                        {!isLast && (
                                            <div
                                                className={`absolute left-0 top-1/2 h-1/2 w-[1.5px] transition-colors ${
                                                    isBeforeActive
                                                        ? 'bg-[#0E5F3F] dark:bg-emerald-500'
                                                        : 'bg-[#CCCCCC] dark:bg-slate-700'
                                                }`}
                                            />
                                        )}
                                        <div
                                            className={`absolute left-0 top-1/2 w-[13px] h-[1.5px] transition-colors ${
                                                isCurrentActive
                                                    ? 'bg-[#0E5F3F] dark:bg-emerald-500'
                                                    : 'bg-[#CCCCCC] dark:bg-slate-700'
                                            }`}
                                        />
                                    </>
                                )}

                                <div
                                    className={`flex items-center ${
                                        isOpen
                                            ? 'gap-2 relative'
                                            : 'justify-center'
                                    } whitespace-nowrap min-w-0`}
                                >
                                    {isOpen ? (
                                        <>
                                            <div
                                                className={`relative flex items-center justify-center shrink-0 w-3.5 h-3.5 rounded-full ${
                                                    isActive
                                                        ? 'bg-[#D5EDE2] dark:bg-emerald-950/60 ring-2 ring-[#0E5F3F]/25'
                                                        : 'bg-transparent'
                                                }`}
                                            >
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                        isActive
                                                            ? 'bg-[#0E5F3F] dark:bg-emerald-500'
                                                            : 'bg-[#888888] dark:bg-slate-500 group-hover:bg-[#0E5F3F] dark:group-hover:bg-slate-300'
                                                    }`}
                                                />
                                            </div>
                                            <span className="truncate">
                                                {subItem.name}
                                            </span>
                                        </>
                                    ) : (
                                        <span
                                            className={`w-2 h-2 rounded-full ${
                                                isActive
                                                    ? 'bg-[#0E5F3F] dark:bg-emerald-400'
                                                    : 'bg-[#CCCCCC] dark:bg-slate-600'
                                            }`}
                                        />
                                    )}
                                </div>

                                {isOpen && subItem.locked && (
                                    <span className="ml-auto shrink-0 flex items-center justify-center text-slate-400 dark:text-slate-500" title="Locked by plan - Click to Upgrade">
                                        <Lock size={12} strokeWidth={2} />
                                    </span>
                                )}

                                {isOpen &&
                                    !subItem.locked &&
                                    Number(subItem.badge) > 0 && (
                                        <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 bg-[#0E5F3F] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-[#12161c] shadow-xs leading-none">
                                            {subItem.badge}
                                        </span>
                                    )}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

