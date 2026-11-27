import { Search } from 'lucide-react';
import {
    AnimatedSearchInput,
    buildSearchPhrases,
} from '@/Components/ui/AnimatedSearchInput';

export interface TableSearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    placeholders?: string[];
    className?: string;
}

export default function TableSearch({
    value,
    onChange,
    placeholder = 'Search...',
    placeholders,
    className = '',
}: TableSearchProps) {
    const resolvedPhrases = placeholders ?? buildSearchPhrases(placeholder);

    return (
        <div className={`relative w-full sm:w-[320px] max-w-full ${className}`}>
            <AnimatedSearchInput
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholders={resolvedPhrases}
                icon={<Search size={14} />}
                wrapperClassName="h-[32px] rounded-[4px]"
                className="h-[32px] rounded-[4px] text-[12.5px] pl-9 pr-3"
                typingSpeedMs={65}
                deletingSpeedMs={32}
                pauseMs={2000}
            />
        </div>
    );
}

