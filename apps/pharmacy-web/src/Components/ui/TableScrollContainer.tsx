import React, { useRef, useState } from 'react';
import { cn } from '@/lib/cn';

interface TableScrollContainerProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * Matches DataTable's hidden-scrollbar horizontal scrolling:
 * - Touch & trackpad swipe (overflow-x-auto with hidden scrollbar)
 * - Mouse click-and-drag horizontal panning (suppresses accidental row click after drag)
 * - Shift + mouse wheel horizontal scrolling
 */
export const TableScrollContainer: React.FC<TableScrollContainerProps> = ({
    children,
    className,
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const dragStateRef = useRef<{
        active: boolean;
        moved: boolean;
        startX: number;
        startY: number;
        startScrollLeft: number;
    }>({
        active: false,
        moved: false,
        startX: 0,
        startY: 0,
        startScrollLeft: 0,
    });
    const [isPanning, setIsPanning] = useState(false);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        const el = scrollContainerRef.current;
        if (!el || el.scrollWidth <= el.clientWidth) return;

        const target = e.target as HTMLElement;
        if (
            target.closest(
                'button, a, input, select, textarea, [role="button"], th[draggable="true"]'
            )
        ) {
            return;
        }

        dragStateRef.current = {
            active: true,
            moved: false,
            startX: e.clientX,
            startY: e.clientY,
            startScrollLeft: el.scrollLeft,
        };

        const handleMouseMove = (moveEvt: MouseEvent) => {
            const drag = dragStateRef.current;
            if (!drag.active) return;
            const dx = moveEvt.clientX - drag.startX;
            const dy = moveEvt.clientY - drag.startY;

            if (!drag.moved) {
                if (Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy)) {
                    drag.moved = true;
                    setIsPanning(true);
                } else if (Math.abs(dy) > 6) {
                    drag.active = false;
                    return;
                } else {
                    return;
                }
            }

            el.scrollLeft = drag.startScrollLeft - dx;
            window.getSelection()?.removeAllRanges();
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            const wasMoved = dragStateRef.current.moved;
            dragStateRef.current.active = false;
            setIsPanning(false);
            if (wasMoved) {
                setTimeout(() => {
                    dragStateRef.current.moved = false;
                }, 0);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onClickCapture={(e) => {
                if (dragStateRef.current.moved) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }}
            onWheel={(e) => {
                if (e.shiftKey && e.deltaY !== 0) {
                    const el = e.currentTarget;
                    if (el.scrollWidth > el.clientWidth) {
                        e.preventDefault();
                        el.scrollLeft += e.deltaY;
                    }
                }
            }}
            className={cn(
                'w-full max-w-full overflow-x-auto custom-scrollbar no-scrollbar touch-pan-x touch-pan-y',
                isPanning && 'cursor-grabbing select-none',
                className
            )}
        >
            {children}
        </div>
    );
};

