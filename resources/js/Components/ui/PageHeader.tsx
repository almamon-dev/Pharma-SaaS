import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PageHeaderBreadcrumb {
    label: string;
    href?: string;
}

export interface PageHeaderProps {
    /** The main title of the page */
    title: string | React.ReactNode;
    /** The subtitle or description explaining the page purpose */
    description?: string | React.ReactNode;
    /** Optional Lucide icon to display next to the title */
    icon?: LucideIcon | React.ComponentType<{ className?: string }>;
    /** Optional badge pill next to the title (e.g. status, count, tag) */
    badge?: string | React.ReactNode;
    /** Optional breadcrumbs trail above the title */
    breadcrumbs?: PageHeaderBreadcrumb[];
    /** Right-aligned action buttons or controls (e.g. Add, Export, Filters) */
    actions?: React.ReactNode;
    /** Additional elements placed directly beneath the header */
    children?: React.ReactNode;
    /** Extra CSS classes for the container */
    className?: string;
}

/**
 * Standard PharmaCore PageHeader component.
 * Provides a unified, accessible header row with Title, Description, Icon, Badge, and Action Buttons.
 * Matches PharmaCore design system: rounded-[4px], primary #FF4A1F accent, adaptive light/dark mode.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    description,
    icon: Icon,
    badge,
    breadcrumbs,
    actions,
    children,
    className,
}) => {
    return (
        <div className={cn('flex flex-col gap-1 mb-3', className)}>
            {/* Optional Breadcrumb Trail */}
            {breadcrumbs && breadcrumbs.length > 0 && (
                <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">
                    {breadcrumbs.map((crumb, idx) => (
                        <React.Fragment key={idx}>
                            {idx > 0 && <span className="opacity-40 select-none">/</span>}
                            {crumb.href ? (
                                <a
                                    href={crumb.href}
                                    className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                >
                                    {crumb.label}
                                </a>
                            ) : (
                                <span className="font-medium text-slate-600 dark:text-slate-400">
                                    {crumb.label}
                                </span>
                            )}
                        </React.Fragment>
                    ))}
                </nav>
            )}

            {/* Main Header Content: Compact Title + Description on left, Actions on right */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        {Icon && (
                            <div className="w-6 h-6 rounded-[3px] bg-[#FF4A1F]/10 dark:bg-[#FF4A1F]/15 flex items-center justify-center shrink-0 border border-[#FF4A1F]/20">
                                <Icon className="w-3.5 h-3.5 text-[#FF4A1F]" />
                            </div>
                        )}
                        <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                            {title}
                        </h1>
                        {badge && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded-[3px] text-[10px] font-semibold bg-orange-50 dark:bg-[#FF4A1F]/10 text-[#FF4A1F] border border-orange-200 dark:border-orange-500/20">
                                {badge}
                            </span>
                        )}
                    </div>
                    {description && (
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal max-w-2xl">
                            {description}
                        </p>
                    )}
                </div>

                {/* Right-aligned action buttons */}
                {actions && (
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {actions}
                    </div>
                )}
            </div>

            {/* Optional extra children slot (e.g. tabs or filter toolbar) */}
            {children && <div className="mt-1.5">{children}</div>}
        </div>
    );
};

export default PageHeader;

