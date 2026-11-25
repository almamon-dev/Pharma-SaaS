import { Search } from 'lucide-react';
import { Input } from '@/Components/ui/Input';

export interface TableSearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export default function TableSearch({
    value,
    onChange,
    placeholder = 'Search...',
    className = '',
}: TableSearchProps) {
    return (
        <div className={`w-full sm:w-[320px] max-w-full ${className}`}>
            <Input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                icon={<Search size={14} className="text-[#6d7175] dark:text-slate-400" />}
                className="h-[32px] border-slate-200/80 dark:border-slate-700/60 text-[12px] font-medium bg-slate-50/50 dark:bg-[#1e2329] text-slate-900 dark:text-slate-200 focus:border-[#ff4a1f] dark:focus:border-[#ff4a1f] transition-colors"
            />
        </div>
    );
}

