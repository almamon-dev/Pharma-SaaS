<?php

namespace App\Modules\Catalog\Support;

class CatalogNormalizer
{
    /**
     * Normalize general text: trim, NFC-normalize, collapse whitespace, lowercase for keys.
     */
    public static function normalizeText(?string $text): string
    {
        if ($text === null) {
            return '';
        }

        // NFC-normalize Unicode (especially important for Bengali combining characters)
        if (class_exists(\Normalizer::class)) {
            $normalized = \Normalizer::normalize($text, \Normalizer::FORM_C);
            if ($normalized !== false) {
                $text = $normalized;
            }
        }

        // Collapse multiple whitespace characters into single space and trim
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');

        return mb_strtolower($text, 'UTF-8');
    }

    /**
     * Normalize medicine strength: "500 mg" -> "500mg", "5 mg / 5 ml" -> "5mg/5ml".
     */
    public static function normalizeStrength(?string $strength): ?string
    {
        if ($strength === null || trim($strength) === '') {
            return null;
        }

        $s = self::normalizeText($strength);
        // Remove spaces around slashes: "5 mg / 5 ml" -> "5mg/5ml"
        $s = preg_replace('/\s*\/\s*/u', '/', $s) ?? $s;
        // Remove spaces between numbers and unit abbreviations (mg, ml, mcg, g, iu, %, etc.)
        $s = preg_replace('/(\d+)\s+([a-z%]+)/ui', '$1$2', $s) ?? $s;
        // Remove any remaining internal whitespace
        $s = str_replace(' ', '', $s);

        return $s;
    }

    /**
     * Build standard dedupe_key: normalizeText(name)|normalizeStrength(strength)|dosage_form|company_id.
     */
    public static function dedupeKey(
        string $name,
        ?string $strength,
        ?string $dosageForm,
        ?string $companyId
    ): string {
        $normName = self::normalizeText($name);
        $normStrength = self::normalizeStrength($strength) ?? '';
        $normForm = self::normalizeText($dosageForm);
        $cid = $companyId ? trim($companyId) : '';

        return "{$normName}|{$normStrength}|{$normForm}|{$cid}";
    }

    /**
     * Convert Bengali numerals (০-৯) to standard ASCII digits (0-9).
     */
    public static function normalizeDigits(?string $value): string
    {
        if ($value === null) {
            return '';
        }

        $bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
        $asciiDigits   = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

        return str_replace($bengaliDigits, $asciiDigits, trim($value));
    }
}

