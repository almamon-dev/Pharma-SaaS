import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { cn } from '@/lib/cn';

interface BarcodeSvgProps {
    value?: string | null;
    compact?: boolean;
    displayValue?: boolean;
    height?: number;
    barWidth?: number;
    fontSize?: number;
    className?: string;
}

function isValidGtinCheckDigit(code: string): boolean {
    if (!/^\d+$/.test(code) || code.length < 2) return false;
    const digits = code.slice(0, -1);
    const expected = Number(code.slice(-1));
    let sum = 0;

    for (let i = digits.length - 1, pos = 0; i >= 0; i--, pos++) {
        sum += Number(digits[i]) * (pos % 2 === 0 ? 3 : 1);
    }

    return (10 - (sum % 10)) % 10 === expected;
}

function resolveBarcodeFormat(code: string): string {
    if (code.length === 13 && isValidGtinCheckDigit(code)) {
        return 'EAN13';
    }
    if (code.length === 8 && isValidGtinCheckDigit(code)) {
        return 'EAN8';
    }
    if (code.length === 12 && isValidGtinCheckDigit(code)) {
        return 'UPC';
    }
    return 'CODE128';
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
    value,
    compact = false,
    displayValue = !compact,
    height,
    barWidth,
    fontSize,
    className,
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const cleaned = value?.trim() ?? '';

    const resolvedHeight = height ?? (compact ? 22 : 44);
    const resolvedBarWidth = barWidth ?? (compact ? 1 : 1.5);
    const resolvedFontSize = fontSize ?? (compact ? 9 : 11);

    useEffect(() => {
        const el = svgRef.current;
        if (!el || !cleaned) return;

        const baseOptions: JsBarcode.Options = {
            width: resolvedBarWidth,
            height: resolvedHeight,
            displayValue,
            fontSize: resolvedFontSize,
            font: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            textMargin: 2,
            margin: compact ? 0 : 2,
            background: '',
            lineColor: 'currentColor',
        };

        const preferredFormat = resolveBarcodeFormat(cleaned);
        try {
            JsBarcode(el, cleaned, {
                ...baseOptions,
                format: preferredFormat,
            });
        } catch {
            try {
                JsBarcode(el, cleaned, {
                    ...baseOptions,
                    format: 'CODE128',
                });
            } catch {
                el.innerHTML = '';
            }
        }
    }, [
        cleaned,
        compact,
        displayValue,
        resolvedBarWidth,
        resolvedHeight,
        resolvedFontSize,
    ]);

    if (!cleaned) {
        return <span className="text-[11.5px] text-slate-400">—</span>;
    }

    return (
        <span
            title={`Barcode: ${cleaned}`}
            className={cn(
                'inline-flex items-center justify-center text-slate-900 dark:text-slate-100 select-none',
                className
            )}
        >
            <svg
                ref={svgRef}
                role="img"
                aria-label={`Barcode ${cleaned}`}
                className={cn(
                    'block',
                    compact ? 'h-[22px] w-auto max-w-[96px]' : 'h-auto max-w-full'
                )}
            />
        </span>
    );
};

