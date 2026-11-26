import React from 'react';

export interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

export default function Skeleton({ className = '', style }: SkeletonProps) {
    const hasRounded = className.split(' ').some((c) => c.startsWith('rounded-[2px]'));
    const roundedClass = hasRounded ? '' : 'rounded-[2px]';
    return (
        <div
            className={`animate-live-shimmer ${roundedClass} ${className}`.trim()}
            style={style}
        />
    );
}

