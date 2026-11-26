<?php

namespace App\Modules\Catalog\Services;

use RuntimeException;
use SimpleXMLElement;
use ZipArchive;

class SpreadsheetParser
{
    /**
     * Read all rows from CSV or XLSX file as an array of rows (each row is array of string cell values).
     *
     * @return list<list<string>>
     */
    public static function parse(string $filePath): array
    {
        if (! file_exists($filePath)) {
            throw new RuntimeException("File not found at path: {$filePath}");
        }

        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        if ($ext === 'xlsx') {
            return self::parseXlsx($filePath);
        }

        return self::parseCsv($filePath);
    }

    /**
     * Parse CSV file with UTF-8 BOM handling and auto delimiter detection.
     *
     * @return list<list<string>>
     */
    public static function parseCsv(string $filePath): array
    {
        $rows = [];
        $handle = fopen($filePath, 'r');
        if (! $handle) {
            throw new RuntimeException("Cannot open CSV file: {$filePath}");
        }

        // Handle UTF-8 BOM
        $bom = fread($handle, 3);
        if ($bom !== "\xEF\xBB\xBF") {
            rewind($handle);
        }

        // Auto-detect delimiter from first line
        $firstLine = fgets($handle);
        rewind($handle);
        if ($bom === "\xEF\xBB\xBF") {
            fread($handle, 3);
        }

        $delimiter = ',';
        if ($firstLine !== false) {
            $semicolons = substr_count($firstLine, ';');
            $commas = substr_count($firstLine, ',');
            $tabs = substr_count($firstLine, "\t");
            if ($semicolons > $commas && $semicolons > $tabs) {
                $delimiter = ';';
            } elseif ($tabs > $commas && $tabs > $semicolons) {
                $delimiter = "\t";
            }
        }

        while (($data = fgetcsv($handle, 0, $delimiter)) !== false) {
            // Trim all cells
            $row = array_map(fn ($cell) => trim((string) $cell), $data);
            // Skip fully empty rows
            if (count(array_filter($row, fn ($c) => $c !== '')) === 0) {
                continue;
            }
            $rows[] = $row;
        }

        fclose($handle);
        return $rows;
    }

    /**
     * Parse XLSX file streaming rows using built-in ZipArchive and SimpleXML.
     *
     * @return list<list<string>>
     */
    public static function parseXlsx(string $filePath): array
    {
        $zip = new ZipArchive();
        if ($zip->open($filePath) !== true) {
            // If opening as XLSX fails, fallback to CSV parser
            return self::parseCsv($filePath);
        }

        // 1. Read shared strings if present
        $sharedStrings = [];
        $sharedXmlContent = $zip->getFromName('xl/sharedStrings.xml');
        if ($sharedXmlContent !== false) {
            $sharedXml = new SimpleXMLElement($sharedXmlContent);
            foreach ($sharedXml->si as $si) {
                if (isset($si->t)) {
                    $sharedStrings[] = (string) $si->t;
                } elseif (isset($si->r)) {
                    $text = '';
                    foreach ($si->r as $r) {
                        $text .= (string) $r->t;
                    }
                    $sharedStrings[] = $text;
                } else {
                    $sharedStrings[] = '';
                }
            }
        }

        // 2. Read first worksheet
        $sheetContent = $zip->getFromName('xl/worksheets/sheet1.xml');
        if ($sheetContent === false) {
            $zip->close();
            return [];
        }

        $sheetXml = new SimpleXMLElement($sheetContent);
        $rows = [];

        if (isset($sheetXml->sheetData->row)) {
            foreach ($sheetXml->sheetData->row as $r) {
                $rowCells = [];
                $colIndex = 0;

                foreach ($r->c as $c) {
                    $cellRef = (string) $c['r'];
                    preg_match('/^([A-Z]+)/', $cellRef, $matches);
                    $targetCol = isset($matches[1]) ? self::columnLetterToNumber($matches[1]) - 1 : $colIndex;

                    // Pad missing empty cells
                    while ($colIndex < $targetCol) {
                        $rowCells[] = '';
                        $colIndex++;
                    }

                    $type = (string) $c['t'];
                    $val = (string) $c->v;

                    if ($type === 's' && isset($sharedStrings[(int) $val])) {
                        $cellVal = $sharedStrings[(int) $val];
                    } elseif ($type === 'inlineStr' && isset($c->is->t)) {
                        $cellVal = (string) $c->is->t;
                    } else {
                        $cellVal = $val;
                    }

                    $rowCells[] = trim($cellVal);
                    $colIndex++;
                }

                if (count(array_filter($rowCells, fn ($c) => $c !== '')) > 0) {
                    $rows[] = $rowCells;
                }
            }
        }

        $zip->close();
        return $rows;
    }

    protected static function columnLetterToNumber(string $p): int
    {
        $num = 0;
        $len = strlen($p);
        for ($i = 0; $i < $len; $i++) {
            $num = $num * 26 + (ord($p[$i]) - 64);
        }
        return $num;
    }
}

