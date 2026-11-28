<?php

namespace App\Services;

use App\Models\Medicine;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Smalot\PdfParser\Parser as PdfParser;
use Throwable;

class PrescriptionScanService
{
    private const DOSAGE_FORMS = [
        'tablet' => ['tab', 'tabs', 'tablet', 'tablets', 'ট্যাবলেট', 'ট্যাব'],
        'capsule' => ['cap', 'caps', 'capsule', 'capsules', 'ক্যাপসুল', 'ক্যাপ'],
        'syrup' => ['syp', 'syr', 'syrup', 'সিরাপ'],
        'suspension' => ['susp', 'suspension', 'সাসপেনশন'],
        'injection' => ['inj', 'injection', 'amp', 'vial', 'ইনজেকশন'],
        'drops' => ['drop', 'drops', 'ড্রপ'],
        'cream' => ['cream', 'ointment', 'oint', 'gel', 'lotion', 'ক্রিম', 'মলম'],
        'inhaler' => ['inhaler', 'rotacap', 'cozycap', 'spray', 'ইনহেলার'],
        'sachet' => ['sachet', 'ors', 'powder', 'স্যাশে'],
        'suppository' => ['supp', 'suppository'],
    ];

    /**
     * Scan an uploaded PDF or image and match detected medicines against the active branch stock.
     */
    public function scan(UploadedFile $file, ?int $branchId, bool $forceAi = false): array
    {
        $mime = strtolower((string) ($file->getMimeType() ?: $file->getClientMimeType()));
        $ext = strtolower((string) $file->getClientOriginalExtension());
        $isPdf = $ext === 'pdf' || str_contains($mime, 'pdf');
        $geminiKey = trim((string) config('services.gemini.key', ''));
        $aiConfigured = $geminiKey !== '';

        $warnings = [];
        $engine = 'local_pdf';
        $extractedMeta = [
            'doctor_name' => null,
            'patient_name' => null,
            'patient_phone' => null,
            'notes' => null,
        ];
        $rawCandidates = [];
        $catalog = collect();

        if ($isPdf && ! $forceAi) {
            $rawText = $this->extractPdfText($file);
            $cleanAlphaNum = preg_replace('/\s+/u', '', $rawText) ?? '';

            if (mb_strlen($cleanAlphaNum) >= 12) {
                $catalog = $this->loadTargetedCatalogFromText($rawText);
                $parsed = $this->parsePlainTextDocument($rawText, $catalog);
                $extractedMeta = $parsed['meta'];
                $rawCandidates = $parsed['candidates'];
                $engine = 'local_pdf';
            }

            // Fallback to Gemini Vision if PDF is scanned/image-only or yielded 0 medicines
            if (empty($rawCandidates) && $aiConfigured) {
                $aiResult = $this->extractWithGemini($file, 'application/pdf', $geminiKey, $warnings);
                if ($aiResult !== null) {
                    $extractedMeta = $this->mergeMeta($extractedMeta, $aiResult['meta']);
                    $rawCandidates = $aiResult['candidates'];
                    $catalog = $this->loadTargetedCatalogFromCandidates($rawCandidates);
                    $engine = 'gemini_ai';
                }
            } elseif (empty($rawCandidates) && mb_strlen($cleanAlphaNum) < 12 && ! $aiConfigured) {
                $warnings[] = 'এই PDF ফাইলটি স্ক্যান করা ছবি (টেক্সট লেয়ার নেই)। হাতে লেখা বা স্ক্যান করা PDF পড়ার জন্য .env ফাইলে GEMINI_API_KEY যুক্ত করুন।';
            }
        } else {
            // Image upload OR forced AI mode
            $resolvedMime = $isPdf ? 'application/pdf' : ($mime ?: 'image/jpeg');
            if ($aiConfigured) {
                $aiResult = $this->extractWithGemini($file, $resolvedMime, $geminiKey, $warnings);
                if ($aiResult !== null) {
                    $extractedMeta = $aiResult['meta'];
                    $rawCandidates = $aiResult['candidates'];
                    $catalog = $this->loadTargetedCatalogFromCandidates($rawCandidates);
                    $engine = 'gemini_ai';
                }
            } elseif ($isPdf) {
                $rawText = $this->extractPdfText($file);
                $catalog = $this->loadTargetedCatalogFromText($rawText);
                $parsed = $this->parsePlainTextDocument($rawText, $catalog);
                $extractedMeta = $parsed['meta'];
                $rawCandidates = $parsed['candidates'];
                $engine = 'local_pdf';
                $warnings[] = 'GEMINI_API_KEY সেট করা নেই, তাই লোকাল PDF স্ক্যানার ব্যবহার করা হয়েছে।';
            } else {
                $warnings[] = 'ছবি বা হাতে লেখা প্রেসক্রিপশন স্ক্যান করার জন্য .env ফাইলে GEMINI_API_KEY যুক্ত করুন। ডিজিটাল টেক্সট PDF এখনই API ছাড়া স্ক্যান করা যাবে।';
            }
        }

        $items = $this->hydrateAndMatchCandidates($rawCandidates, $catalog, $branchId);

        if (empty($items) && empty($warnings)) {
            $warnings[] = 'ফাইলটি থেকে কোনো ওষুধের নাম শনাক্ত করা যায়নি। অনুগ্রহ করে স্পষ্ট PDF বা প্রেসক্রিপশন আপলোড করুন।';
        }

        $matchedInStock = 0;
        $outOfStock = 0;
        $unmatched = 0;
        foreach ($items as $it) {
            if ($it['status'] === 'matched') {
                $matchedInStock++;
            } elseif ($it['status'] === 'out_of_stock') {
                $outOfStock++;
            } else {
                $unmatched++;
            }
        }

        return [
            'ok' => true,
            'engine' => $engine,
            'ai_configured' => $aiConfigured,
            'file_name' => $file->getClientOriginalName(),
            'extracted' => $extractedMeta,
            'summary' => [
                'total_detected' => count($items),
                'matched_in_stock' => $matchedInStock,
                'out_of_stock' => $outOfStock,
                'unmatched' => $unmatched,
            ],
            'warnings' => $warnings,
            'items' => $items,
        ];
    }

    /**
     * Extract plain text from a digital PDF using Smalot\PdfParser.
     */
    private function extractPdfText(UploadedFile $file): string
    {
        try {
            $parser = new PdfParser();
            $pdf = $parser->parseFile($file->getRealPath());
            $text = $pdf->getText();

            return $this->normalizeDigitsAndSpaces($text);
        } catch (Throwable $e) {
            Log::warning('Local PDF text parse failed: '.$e->getMessage());

            return '';
        }
    }

    /**
     * Convert Bengali digits to ASCII and normalize line breaks.
     */
    private function normalizeDigitsAndSpaces(string $text): string
    {
        $bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
        $en = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        $converted = str_replace($bn, $en, $text);
        $converted = str_replace(["\r\n", "\r"], "\n", $converted);

        return $converted;
    }

    /**
     * Parse plain text from digital prescriptions, hospital discharge summaries, or medicine order PDFs.
     */
    private function parsePlainTextDocument(string $rawText, Collection $catalog): array
    {
        $lines = array_values(array_filter(
            array_map(fn ($l) => trim(preg_replace('/[ \t]+/u', ' ', $l) ?? ''), explode("\n", $rawText)),
            fn ($l) => $l !== ''
        ));

        $meta = [
            'doctor_name' => null,
            'patient_name' => null,
            'patient_phone' => null,
            'notes' => null,
        ];

        // Pre-prepare catalog search tokens sorted by longest brand name first
        $indexedCatalog = $catalog->map(function (Medicine $m) {
            $normName = $this->normalizeMedString($m->name);
            $coreBrand = $this->extractCoreBrand($m->name);
            $normStrength = $this->normalizeStrength((string) $m->strength);

            return [
                'med' => $m,
                'norm_name' => $normName,
                'name_len' => mb_strlen($normName),
                'core_brand' => $coreBrand,
                'core_len' => mb_strlen($coreBrand),
                'norm_strength' => $normStrength,
                'sku_lower' => strtolower(trim((string) $m->sku)),
                'barcode' => trim((string) $m->barcode),
            ];
        })->filter(fn ($row) => $row['name_len'] >= 2)
            ->sortByDesc('core_len')
            ->values();

        $candidates = [];
        $seenKeys = [];

        foreach ($lines as $idx => $line) {
            // 1. Metadata extraction (Doctor, Patient, Phone)
            if ($meta['doctor_name'] === null && preg_match('/^(?:prescribed\s*by\s*[:\-]?\s*|doctor(?:\s*name)?\s*[:\-]\s*)?((?:prof\.?\s*)?(?:dr\.?|ডাঃ|ডা\.)\s*[^\n,|]{3,45})/iu', $line, $dm)) {
                $meta['doctor_name'] = trim($dm[1]);
                continue;
            }

            if ($meta['patient_name'] === null && preg_match('/(?:patient(?:\s*name)?|customer(?:\s*name)?|রোগীর\s*নাম|নাম)\s*[:\-]\s*([^\n,;|]{2,45})/iu', $line, $pm)) {
                $candidateName = trim(preg_replace('/\b(?:age|sex|phone|mobile|date|বয়স|মোবাইল).*$/iu', '', $pm[1]) ?? '');
                if ($candidateName !== '') {
                    $meta['patient_name'] = $candidateName;
                }
            }

            if ($meta['patient_phone'] === null && preg_match('/(?:\+?88)?(01[3-9]\d{8})\b/', $line, $phm)) {
                $meta['patient_phone'] = $phm[1];
            }

            // Skip obvious non-medicine header/footer/summary lines
            if ($this->isNoiseLine($line)) {
                continue;
            }

            // Look ahead 1 line in case dosage (`1+0+1 - 7 days`) is printed right below medicine name
            $nextLine = $lines[$idx + 1] ?? '';
            $combinedContext = $line;
            if ($nextLine !== '' && $this->looksLikePureDosageLine($nextLine)) {
                $combinedContext = $line.' '.$nextLine;
            }

            // 2. Try matching against tenant catalog directly in this line
            $matchedRow = $this->findBestCatalogMatchInLine($line, $indexedCatalog);
            [$qty, $unit, $dosageLabel] = $this->extractQuantityAndDosage($combinedContext);

            if ($matchedRow !== null) {
                /** @var Medicine $med */
                $med = $matchedRow['med'];
                $dedupeKey = 'med_'.$med->id;
                if (isset($seenKeys[$dedupeKey])) {
                    $candidates[$seenKeys[$dedupeKey]]['requested_qty'] += $qty;
                    continue;
                }

                $seenKeys[$dedupeKey] = count($candidates);
                $candidates[] = [
                    'detected_name' => $this->cleanDetectedLabel($line),
                    'detected_dosage' => $dosageLabel,
                    'requested_qty' => $qty,
                    'requested_unit' => $unit,
                    'confidence' => $matchedRow['confidence'],
                    'matched_medicine_id' => $med->id,
                    'raw_brand' => $med->name,
                    'raw_generic' => $med->generic_name,
                    'raw_strength' => $med->strength,
                ];
                continue;
            }

            // 3. Even if not in catalog, check if the line clearly looks like a prescribed medicine line
            if ($this->looksLikePrescriptionMedicineLine($line)) {
                $extractedName = $this->extractCandidateMedicineName($line);
                if (mb_strlen($extractedName) >= 3) {
                    $dedupeKey = 'raw_'.strtolower($extractedName);
                    if (! isset($seenKeys[$dedupeKey])) {
                        $seenKeys[$dedupeKey] = count($candidates);
                        $candidates[] = [
                            'detected_name' => $this->cleanDetectedLabel($line),
                            'detected_dosage' => $dosageLabel,
                            'requested_qty' => $qty,
                            'requested_unit' => $unit,
                            'confidence' => 'medium',
                            'matched_medicine_id' => null,
                            'raw_brand' => $extractedName,
                            'raw_generic' => null,
                            'raw_strength' => $this->extractStrengthToken($line),
                        ];
                    }
                }
            }
        }

        return [
            'meta' => $meta,
            'candidates' => $candidates,
        ];
    }

    /**
     * Call Google Gemini Multimodal API for scanned PDFs, images, or handwritten prescriptions.
     */
    private function extractWithGemini(UploadedFile $file, string $mimeType, string $apiKey, array &$warnings): ?array
    {
        try {
            $configuredModel = preg_replace('/^models\//', '', trim((string) config('services.gemini.model', 'gemini-3.5-flash'))) ?: 'gemini-3.5-flash';
            $modelsToTry = array_values(array_unique([
                $configuredModel,
                'gemini-3.5-flash',
                'gemini-flash-lite-latest',
                'gemini-flash-latest',
            ]));
            $base64 = base64_encode((string) file_get_contents($file->getRealPath()));

            $prompt = <<<'PROMPT'
You are an expert Bangladesh clinical pharmacist and medical document parser.
Extract all prescribed or ordered medicines and metadata from this prescription / medicine order document.

Rules:
1. Return ONLY valid JSON matching this exact structure:
{
  "doctor_name": string | null,
  "patient_name": string | null,
  "patient_phone": string | null,
  "notes": string | null,
  "items": [
    {
      "detected_name": "Full medicine line text e.g. Tab. Napa Extend 665mg",
      "brand_name": "Core brand name e.g. Napa Extend",
      "generic_name": "Generic name if known/visible e.g. Paracetamol, else null",
      "strength": "Strength e.g. 665mg or 20mg, else null",
      "dosage_form": "tablet | capsule | syrup | suspension | injection | drops | cream | inhaler | sachet | other",
      "dosage_schedule": "e.g. 1+0+1 x 7 days, else null",
      "quantity": integer,
      "unit": "piece | strip | box"
    }
  ]
}
2. Quantity calculation:
   - If an explicit quantity is written (e.g. "Qty: 20", "2 strips", "1 box"), use that integer and unit ("piece", "strip", or "box").
   - If a dosage schedule + duration is written (e.g. "1+0+1 for 7 days" -> (1+0+1)*7 = 14; "1+1+1 for 5 days" -> 15; "0+0+1 for 1 month" -> 30), set unit="piece" and quantity to the calculated total pieces.
   - For syrups, suspensions, drops, creams, inhalers, or injections without explicit count, set quantity=1 and unit="piece".
   - Default to quantity=1, unit="piece" if uncertain.
PROMPT;

            $payload = [
                'contents' => [
                    [
                        'parts' => [
                            ['text' => $prompt],
                            [
                                'inline_data' => [
                                    'mime_type' => $mimeType,
                                    'data' => $base64,
                                ],
                            ],
                        ],
                    ],
                ],
                'generationConfig' => [
                    'temperature' => 0.1,
                    'responseMimeType' => 'application/json',
                ],
            ];

            $response = null;
            foreach ($modelsToTry as $candidateModel) {
                $url = "https://generativelanguage.googleapis.com/v1beta/models/{$candidateModel}:generateContent?key={$apiKey}";
                $response = Http::withOptions(['force_ip_resolve' => 'v4'])
                    ->connectTimeout(8)
                    ->timeout(30)
                    ->acceptJson()
                    ->post($url, $payload);

                if ($response->successful()) {
                    break;
                }
                if ($response->status() !== 404 && $response->status() < 500) {
                    break;
                }
            }

            if (! $response || ! $response->successful()) {
                Log::warning('Gemini scan HTTP error: '.($response?->status() ?? 0).' '.($response?->body() ?? ''));
                $warnings[] = 'AI স্ক্যান সার্ভিসে সাময়িক সমস্যা হয়েছে (HTTP '.($response?->status() ?? 0).')। API Key ও ইন্টারনেট সংযোগ যাচাই করুন।';

                return null;
            }

            $jsonText = data_get($response->json(), 'candidates.0.content.parts.0.text', '');
            $cleanJson = trim((string) preg_replace('/^```(?:json)?\s*|\s*```$/i', '', trim((string) $jsonText)));
            $decoded = json_decode($cleanJson, true);

            if (! is_array($decoded)) {
                $warnings[] = 'AI থেকে সঠিক ফরম্যাটে ডাটা পাওয়া যায়নি।';

                return null;
            }

            $candidates = [];
            foreach (($decoded['items'] ?? []) as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $brand = trim((string) ($row['brand_name'] ?? $row['detected_name'] ?? ''));
                if ($brand === '') {
                    continue;
                }
                $unit = strtolower(trim((string) ($row['unit'] ?? 'piece')));
                if (! in_array($unit, ['piece', 'strip', 'box'], true)) {
                    $unit = 'piece';
                }

                $candidates[] = [
                    'detected_name' => trim((string) ($row['detected_name'] ?? $brand)),
                    'detected_dosage' => $row['dosage_schedule'] ?? null,
                    'requested_qty' => max(1, (int) ($row['quantity'] ?? 1)),
                    'requested_unit' => $unit,
                    'confidence' => 'high',
                    'matched_medicine_id' => null,
                    'raw_brand' => $brand,
                    'raw_generic' => $row['generic_name'] ?? null,
                    'raw_strength' => $row['strength'] ?? null,
                ];
            }

            return [
                'meta' => [
                    'doctor_name' => $decoded['doctor_name'] ?? null,
                    'patient_name' => $decoded['patient_name'] ?? null,
                    'patient_phone' => $decoded['patient_phone'] ?? null,
                    'notes' => $decoded['notes'] ?? null,
                ],
                'candidates' => $candidates,
            ];
        } catch (Throwable $e) {
            Log::error('Gemini prescription scan exception: '.$e->getMessage());
            $warnings[] = 'AI স্ক্যান সম্পন্ন করা যায়নি: '.$e->getMessage();

            return null;
        }
    }

    /**
     * Match extracted candidates against tenant catalog and hydrate full branch stock + FEFO batches.
     */
    private function hydrateAndMatchCandidates(array $rawCandidates, Collection $catalog, ?int $branchId): array
    {
        if (empty($rawCandidates)) {
            return [];
        }

        $resolvedRows = [];
        $medicineIdsToHydrate = [];

        foreach ($rawCandidates as $idx => $cand) {
            $matchedMed = null;
            $confidence = $cand['confidence'] ?? 'medium';

            if (! empty($cand['matched_medicine_id'])) {
                $matchedMed = $catalog->firstWhere('id', $cand['matched_medicine_id']);
            }

            if (! $matchedMed && ! empty($cand['raw_brand'])) {
                $match = $this->fuzzyMatchMedicine(
                    (string) $cand['raw_brand'],
                    $cand['raw_strength'] ?? null,
                    $cand['raw_generic'] ?? null,
                    $catalog
                );
                if ($match) {
                    $matchedMed = $match['med'];
                    $confidence = $match['confidence'];
                }
            }

            $alternatives = $this->findAlternatives(
                $matchedMed,
                $cand['raw_generic'] ?? $matchedMed?->generic_name,
                $cand['raw_brand'] ?? '',
                $catalog
            );

            if ($matchedMed) {
                $medicineIdsToHydrate[] = $matchedMed->id;
            }
            foreach ($alternatives as $alt) {
                $medicineIdsToHydrate[] = $alt->id;
            }

            $resolvedRows[] = [
                'idx' => $idx,
                'cand' => $cand,
                'matched_id' => $matchedMed?->id,
                'alt_ids' => $alternatives->pluck('id')->all(),
                'confidence' => $confidence,
            ];
        }

        $hydratedMap = $this->loadHydratedMedicines(array_values(array_unique($medicineIdsToHydrate)), $branchId);

        $finalItems = [];
        foreach ($resolvedRows as $row) {
            $cand = $row['cand'];
            $primary = $row['matched_id'] ? ($hydratedMap[$row['matched_id']] ?? null) : null;
            $alts = array_values(array_filter(array_map(
                fn ($id) => $hydratedMap[$id] ?? null,
                $row['alt_ids']
            )));

            // If primary matched medicine is out of stock, keep it visible as out_of_stock and surface in-stock alternatives
            $status = 'not_found';
            if ($primary !== null) {
                $status = $primary['available_stock'] > 0 ? 'matched' : 'out_of_stock';
            } elseif (! empty($alts)) {
                $status = 'alternative';
            }

            $finalItems[] = [
                'id' => 'scan-item-'.($row['idx'] + 1),
                'detected_name' => $cand['detected_name'],
                'detected_dosage' => $cand['detected_dosage'],
                'requested_qty' => max(1, (int) $cand['requested_qty']),
                'requested_unit' => $cand['requested_unit'] ?? 'piece',
                'confidence' => $row['confidence'],
                'status' => $status,
                'medicine' => $primary,
                'alternatives' => array_slice($alts, 0, 5),
            ];
        }

        return $finalItems;
    }

    /**
     * Load targeted active medicine subset matching tokens in the document (fast even on 25,000+ medicines).
     */
    private function loadTargetedCatalogFromText(string $rawText): Collection
    {
        preg_match_all('/\b[A-Za-z][A-Za-z0-9\-]{2,24}\b/u', $rawText, $m);
        $stopWords = [
            'the', 'and', 'for', 'with', 'days', 'day', 'week', 'weeks', 'month', 'months',
            'tab', 'tabs', 'tablet', 'tablets', 'cap', 'caps', 'capsule', 'capsules', 'syp', 'syrup',
            'susp', 'inj', 'drop', 'drops', 'qty', 'quantity', 'pcs', 'piece', 'pieces', 'strip', 'strips', 'box',
            'patient', 'name', 'doctor', 'phone', 'mobile', 'male', 'female', 'age', 'date', 'yrs', 'years',
            'advice', 'drink', 'plenty', 'water', 'follow', 'after', 'before', 'meal', 'diagnostic', 'consultation',
            'hospital', 'clinic', 'chamber', 'consultant', 'physician', 'bmdc', 'reg', 'mbbs', 'fcps',
        ];

        $tokens = [];
        foreach (($m[0] ?? []) as $word) {
            $lw = strtolower($word);
            if (! in_array($lw, $stopWords, true) && strlen($lw) >= 3) {
                $tokens[$lw] = true;
            }
            if (count($tokens) >= 35) {
                break;
            }
        }

        return $this->queryCatalogByTokens(array_keys($tokens));
    }

    private function loadTargetedCatalogFromCandidates(array $candidates): Collection
    {
        $tokens = [];
        foreach ($candidates as $c) {
            foreach (['raw_brand', 'raw_generic'] as $field) {
                if (! empty($c[$field])) {
                    $first = strtok($this->normalizeMedString((string) $c[$field]), ' ');
                    if ($first && strlen($first) >= 3) {
                        $tokens[$first] = true;
                    }
                }
            }
        }

        return $this->queryCatalogByTokens(array_keys($tokens));
    }

    private function queryCatalogByTokens(array $tokens): Collection
    {
        if (empty($tokens)) {
            return collect();
        }

        return Medicine::query()
            ->where('is_active', true)
            ->where(function ($q) use ($tokens) {
                foreach ($tokens as $tok) {
                    $q->orWhere('name', 'ilike', $tok.'%')
                        ->orWhere('name', 'ilike', '% '.$tok.'%')
                        ->orWhere('sku', 'ilike', $tok)
                        ->orWhere('generic_name', 'ilike', $tok.'%');
                }
            })
            ->select([
                'id',
                'name',
                'generic_name',
                'sku',
                'barcode',
                'dosage_form',
                'strength',
                'unit',
                'units_per_strip',
                'units_per_box',
                'requires_prescription',
                'default_selling_price',
                'box_selling_price',
            ])
            ->limit(500)
            ->get();
    }

    /**
     * Load full branch stock + FEFO batches for matched and alternative medicine IDs.
     */
    private function loadHydratedMedicines(array $ids, ?int $branchId): array
    {
        if (empty($ids)) {
            return [];
        }

        return Medicine::query()
            ->whereIn('id', $ids)
            ->with([
                'batches' => fn ($q) => $q->sellable($branchId)->orderBy('expiry_date'),
            ])
            ->withSum([
                'batches as available_stock' => fn ($q) => $q->sellable($branchId),
            ], 'quantity_available')
            ->get()
            ->mapWithKeys(fn (Medicine $med) => [
                $med->id => [
                    'id' => $med->id,
                    'name' => $med->name,
                    'generic_name' => $med->generic_name,
                    'sku' => $med->sku,
                    'barcode' => $med->barcode,
                    'dosage_form' => $med->dosage_form,
                    'strength' => $med->strength,
                    'unit' => $med->unit,
                    'units_per_strip' => (int) ($med->units_per_strip ?: 1),
                    'units_per_box' => (int) ($med->units_per_box ?: 1),
                    'requires_prescription' => (bool) $med->requires_prescription,
                    'selling_price' => (float) $med->default_selling_price,
                    'box_selling_price' => $med->resolvedBoxSellingPrice(),
                    'available_stock' => (int) ($med->available_stock ?? 0),
                    'batches' => $med->batches->map(fn ($b) => [
                        'id' => $b->id,
                        'batch_number' => $b->batch_number,
                        'expiry_date' => $b->expiry_date?->format('d M Y'),
                        'quantity_available' => (int) $b->quantity_available,
                        'selling_price' => (float) ($b->selling_price ?: $med->default_selling_price),
                    ])->values()->all(),
                ],
            ])
            ->all();
    }

    private function findBestCatalogMatchInLine(string $line, Collection $indexedCatalog): ?array
    {
        $lineLower = strtolower($line);
        $normLine = ' '.$this->normalizeMedString($line).' ';
        $lineStrength = $this->extractStrengthToken($line);
        $lineForm = $this->detectDosageForm($line);

        // 1. Exact SKU or Barcode match
        foreach ($indexedCatalog as $row) {
            if ($row['sku_lower'] !== '' && strlen($row['sku_lower']) >= 4 && str_contains($lineLower, $row['sku_lower'])) {
                return ['med' => $row['med'], 'confidence' => 'high'];
            }
            if ($row['barcode'] !== '' && strlen($row['barcode']) >= 6 && str_contains($line, $row['barcode'])) {
                return ['med' => $row['med'], 'confidence' => 'high'];
            }
        }

        // 2. Brand phrase match with strength & form scoring
        $hasMedCue = $this->looksLikePrescriptionMedicineLine($line)
            || preg_match('/^\s*\d{1,2}[\.\)\-]\s+/u', $line)
            || preg_match('/\b(?:qty|quantity|pcs|strip|strips|box|boxes|\d+\s*(?:mg|ml|mcg|gm|g))\b/iu', $line);

        $best = null;
        $bestScore = 0;

        foreach ($indexedCatalog as $row) {
            $fullNeedle = ' '.$row['norm_name'].' ';
            $coreNeedle = ' '.$row['core_brand'].' ';
            $minCoreLen = $hasMedCue ? 3 : 6;
            $fullMatched = $row['name_len'] >= $minCoreLen && str_contains($normLine, $fullNeedle);
            $coreMatched = ! $fullMatched && $row['core_len'] >= $minCoreLen && str_contains($normLine, $coreNeedle);

            if (! $fullMatched && ! $coreMatched) {
                continue;
            }

            $score = $fullMatched
                ? 70 + min(30, $row['name_len'] * 2)
                : 50 + min(28, $row['core_len'] * 2);

            if ($lineStrength !== null && $row['norm_strength'] !== '') {
                if ($row['norm_strength'] === $lineStrength || str_contains($row['norm_strength'], $lineStrength)) {
                    $score += 35;
                } else {
                    $score -= 15;
                }
            }

            if ($lineForm !== null && strtolower((string) $row['med']->dosage_form) === $lineForm) {
                $score += 15;
            }

            if ($score > $bestScore) {
                $bestScore = $score;
                $best = [
                    'med' => $row['med'],
                    'confidence' => $score >= 75 ? 'high' : 'medium',
                ];
            }
        }

        return $best;
    }

    private function fuzzyMatchMedicine(string $rawBrand, ?string $rawStrength, ?string $rawGeneric, Collection $catalog): ?array
    {
        $normBrand = $this->normalizeMedString($this->stripDosageFormPrefix($rawBrand));
        $normStrength = $this->normalizeStrength((string) $rawStrength);
        if ($normStrength === '') {
            $normStrength = $this->extractStrengthToken($rawBrand) ?? '';
        }

        // Strip strength from brand for cleaner comparison
        $brandOnly = trim(preg_replace('/\b\d+(?:\.\d+)?\s*(?:mg|ml|mcg|gm|g|iu|%)\b/iu', '', $normBrand) ?? $normBrand);

        $bestMed = null;
        $bestScore = 0;

        foreach ($catalog as $med) {
            $medNorm = $this->normalizeMedString($med->name);
            $medBrandOnly = trim(preg_replace('/\b\d+(?:\.\d+)?\s*(?:mg|ml|mcg|gm|g|iu|%)\b/iu', '', $medNorm) ?? $medNorm);
            $medStrength = $this->normalizeStrength((string) $med->strength);

            $score = 0;
            if ($medNorm === $normBrand || ($brandOnly !== '' && $medBrandOnly === $brandOnly)) {
                $score = 90;
            } elseif ($brandOnly !== '' && strlen($brandOnly) >= 3 && (str_starts_with($medBrandOnly, $brandOnly) || str_starts_with($brandOnly, $medBrandOnly))) {
                $score = 74;
            } elseif ($brandOnly !== '' && strlen($brandOnly) >= 4) {
                similar_text($brandOnly, $medBrandOnly, $pct);
                if ($pct >= 82) {
                    $score = (int) round($pct * 0.85);
                }
            }

            if ($score === 0) {
                continue;
            }

            if ($normStrength !== '' && $medStrength !== '') {
                $score += ($normStrength === $medStrength) ? 25 : -12;
            }

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestMed = $med;
            }
        }

        if ($bestMed && $bestScore >= 62) {
            return [
                'med' => $bestMed,
                'confidence' => $bestScore >= 85 ? 'high' : 'medium',
            ];
        }

        // Fallback: match by generic + strength if brand isn't in catalog
        if ($rawGeneric) {
            $normGen = $this->normalizeMedString($rawGeneric);
            foreach ($catalog as $med) {
                $medGen = $this->normalizeMedString((string) $med->generic_name);
                if ($medGen !== '' && str_contains($medGen, $normGen)) {
                    $medStrength = $this->normalizeStrength((string) $med->strength);
                    if ($normStrength === '' || $medStrength === $normStrength) {
                        return [
                            'med' => $med,
                            'confidence' => 'low',
                        ];
                    }
                }
            }
        }

        return null;
    }

    private function findAlternatives(?Medicine $primary, ?string $genericName, string $rawBrand, Collection $catalog): Collection
    {
        $normGen = $this->normalizeMedString((string) $genericName);
        $brandPrefix = substr($this->normalizeMedString($this->stripDosageFormPrefix($rawBrand)), 0, 4);

        return $catalog
            ->filter(function (Medicine $m) use ($primary, $normGen, $brandPrefix) {
                if ($primary && $m->id === $primary->id) {
                    return false;
                }
                if ($normGen !== '' && strlen($normGen) >= 3) {
                    $mGen = $this->normalizeMedString((string) $m->generic_name);
                    if ($mGen !== '' && (str_contains($mGen, $normGen) || str_contains($normGen, $mGen))) {
                        return true;
                    }
                }
                if (strlen($brandPrefix) >= 4) {
                    return str_starts_with($this->normalizeMedString($m->name), $brandPrefix);
                }

                return false;
            })
            ->take(5)
            ->values();
    }

    /**
     * Extract [quantity, saleUnit, dosageSummary] from a prescription or order line.
     */
    private function extractQuantityAndDosage(string $context): array
    {
        // Strip leading serial number ("1. ", "2) ") and strength tokens ("500mg", "20 ml") so they aren't misread as quantities
        $cleaned = preg_replace('/^\s*\d{1,2}[\.\)\-]\s*/u', '', $context) ?? $context;
        $withoutStrength = preg_replace('/\b\d+(?:\.\d+)?\s*(?:mg|ml|mcg|gm|g|iu|%)\b/iu', ' ', $cleaned) ?? $cleaned;

        // 1. Explicit Qty label: "Qty: 20", "Quantity - 2 strips", "পরিমাণ: ১০"
        if (preg_match('/\b(?:qty|quantity|পরিমাণ|সংখ্যা)\s*[:\-=]?\s*(\d{1,4})\s*(box|boxes|বক্স|strip|strips|পাতা|pcs|pc|piece|pieces|tab|tabs|cap|caps|টি|টা)?/iu', $withoutStrength, $qm)) {
            $qty = max(1, (int) $qm[1]);
            $unit = $this->mapUnitWord($qm[2] ?? '');

            return [$qty, $unit, "Qty: {$qty} {$unit}"];
        }

        // 2. Dosage schedule like `1+0+1`, `1+1+1`, `0+0+1`, `1-0-1` (all separators must match)
        $perDay = null;
        $scheduleStr = null;
        if (preg_match('/\b([0-4])\s*([+\-])\s*([0-4])\s*\2\s*([0-4])(?:\s*\2\s*([0-4]))?\b/', $withoutStrength, $dm)) {
            $perDay = (int) $dm[1] + (int) $dm[3] + (int) $dm[4] + (isset($dm[5]) && $dm[5] !== '' ? (int) $dm[5] : 0);
            $scheduleStr = $dm[0];
        } elseif (preg_match('/\b(OD|QD|BD|BID|TDS|TID|QDS|QID)\b/i', $withoutStrength, $am)) {
            $abbr = strtoupper($am[1]);
            $scheduleStr = $abbr;
            $perDay = match ($abbr) {
                'OD', 'QD' => 1,
                'BD', 'BID' => 2,
                'TDS', 'TID' => 3,
                'QDS', 'QID' => 4,
                default => 1,
            };
        }

        if ($perDay !== null && $perDay > 0) {
            $days = 1;
            $durationText = null;
            if (preg_match('/(\d{1,3})\s*(days?|d|দিন|রোজ|weeks?|wk|সপ্তাহ|months?|mo|মাস)\b/iu', $withoutStrength, $dur)) {
                $num = max(1, (int) $dur[1]);
                $u = mb_strtolower($dur[2]);
                if (str_starts_with($u, 'w') || $u === 'সপ্তাহ') {
                    $days = $num * 7;
                } elseif (str_starts_with($u, 'm') || $u === 'মাস') {
                    $days = $num * 30;
                } else {
                    $days = $num;
                }
                $durationText = $dur[0];
            } elseif (preg_match('/(?:চলবে|continue)/iu', $withoutStrength)) {
                $days = 30;
                $durationText = '30 days';
            }

            $totalPcs = max(1, $perDay * $days);
            $label = $durationText ? "{$scheduleStr} × {$durationText}" : $scheduleStr;

            return [$totalPcs, 'piece', $label];
        }

        // 3. Explicit unit count: "2 strips", "1 box", "15 pcs", "১০ পাতা", "২০ টি"
        if (preg_match('/\b(\d{1,4})\s*(box|boxes|বক্স|strip|strips|পাতা|pcs|pc|piece|pieces|tablets?|capsules?|tabs?|caps?|টি|টা)\b/iu', $withoutStrength, $um)) {
            $qty = max(1, (int) $um[1]);
            $unit = $this->mapUnitWord($um[2]);

            return [$qty, $unit, "{$qty} {$unit}"];
        }

        // 4. Multiplier or trailing column quantity in tabular order PDFs: "x 12" or "... 15"
        if (preg_match('/(?:[x×*]\s*(\d{1,4})|\s+(\d{1,3}))\s*$/u', trim($withoutStrength), $tm)) {
            $val = (int) (($tm[1] ?? '') !== '' ? $tm[1] : ($tm[2] ?? 1));
            if ($val >= 1 && $val <= 500) {
                return [$val, 'piece', "Qty: {$val}"];
            }
        }

        return [1, 'piece', null];
    }

    private function mapUnitWord(string $word): string
    {
        $w = mb_strtolower(trim($word));
        if (in_array($w, ['box', 'boxes', 'বক্স'], true)) {
            return 'box';
        }
        if (in_array($w, ['strip', 'strips', 'পাতা'], true)) {
            return 'strip';
        }

        return 'piece';
    }

    private function isNoiseLine(string $line): bool
    {
        if (mb_strlen($line) < 3) {
            return true;
        }

        return (bool) preg_match(
            '/^(?:page\s+\d+|date\s*[:\-]|age\s*[:\-]|sex\s*[:\-]|gender\s*[:\-]|weight\s*[:\-]|bp\s*[:\-]|pulse\s*[:\-]|advice\s*[:\-]|address\s*[:\-]|consultant\b|bmdc\b|subtotal\b|grand\s*total\b|total\s*payable\b|discount\b|thank\s+you|invoice\s*#|order\s*#|sku\s+barcode\s+medicine)|(?:diagnostic\s*&?\s*consultation|hospital\s*&?\s*diagnostic)/iu',
            $line
        );
    }

    private function looksLikePureDosageLine(string $line): bool
    {
        return (bool) preg_match('/^\s*(?:[0-4]\s*[+\-]\s*[0-4]\s*[+\-]\s*[0-4]|(?:before|after)\s+meal|খাবার\s+(?:আগে|পরে))/iu', $line);
    }

    private function looksLikePrescriptionMedicineLine(string $line): bool
    {
        if ($this->detectDosageForm($line) !== null) {
            return true;
        }

        if (preg_match('/\b[0-4]\s*[+\-]\s*[0-4]\s*[+\-]\s*[0-4]\b/', $line)) {
            return true;
        }

        if (preg_match('/^\s*\d{1,2}[\.\)]\s*[A-Za-z].*\b\d+(?:\.\d+)?\s*(?:mg|ml|mcg|gm|g)\b/i', $line)) {
            return true;
        }

        return false;
    }

    private function extractCandidateMedicineName(string $line): string
    {
        $s = preg_replace('/^\s*(?:rx\s*[:\-]?\s*)?(?:\d{1,2}[\.\)\-]\s*)?/iu', '', $line) ?? $line;
        $s = $this->stripDosageFormPrefix($s);
        // Cut off at dosage schedule, quantity, or meal instruction
        $s = preg_replace('/\b(?:[0-4]\s*[+\-]\s*[0-4]|qty\b|quantity\b|before\s+meal|after\s+meal|খাবার).*$/iu', '', $s) ?? $s;
        $s = trim($s, " \t\n\r\0\x0B-—:|,.");

        return $s;
    }

    private function stripDosageFormPrefix(string $text): string
    {
        return preg_replace(
            '/^\s*(?:tab\.?|tabs\.?|tablet|cap\.?|caps\.?|capsule|syp\.?|syr\.?|syrup|susp\.?|suspension|inj\.?|injection|drop|drops|cream|oint\.?|ointment|gel|inhaler|spray|sachet|supp\.?|ট্যাবলেট|ক্যাপসুল|সিরাপ|ড্রপ)\s+/iu',
            '',
            trim($text)
        ) ?? trim($text);
    }

    private function detectDosageForm(string $line): ?string
    {
        $lower = mb_strtolower($line);
        foreach (self::DOSAGE_FORMS as $canonical => $aliases) {
            foreach ($aliases as $alias) {
                if (preg_match('/(?:^|\s|\d|\.)'.preg_quote($alias, '/').'(?:\.|\s|$)/u', $lower)) {
                    return $canonical;
                }
            }
        }

        return null;
    }

    private function extractStrengthToken(string $text): ?string
    {
        if (preg_match('/\b(\d+(?:\.\d+)?)\s*(mg|ml|mcg|gm|g|iu|%)\b/iu', $text, $m)) {
            return strtolower($m[1].$m[2]);
        }

        return null;
    }

    private function normalizeStrength(string $strength): string
    {
        if ($strength === '') {
            return '';
        }

        return strtolower(preg_replace('/\s+/', '', trim($strength)) ?? '');
    }

    private function normalizeMedString(string $str): string
    {
        $s = mb_strtolower($str);
        $s = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $s) ?? $s;

        return trim(preg_replace('/\s+/u', ' ', $s) ?? '');
    }

    private function extractCoreBrand(string $name): string
    {
        $s = $this->stripDosageFormPrefix($name);
        // Strip strength patterns like "500mg", "500 mg", "5/20mg", "100ml"
        $s = preg_replace('/\b\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?\s*(?:mg|ml|mcg|gm|g|iu|%)\b/iu', ' ', $s) ?? $s;
        // Strip trailing dosage form words like "Tablet", "Capsule", "Syrup", "Suspension"
        $s = preg_replace('/\b(?:tablets?|tabs?|capsules?|caps?|syrup|syp|suspension|susp|injections?|inj|drops?|cream|ointment|gel|inhaler|spray|sachet|suppository)\b/iu', ' ', $s) ?? $s;

        return $this->normalizeMedString($s);
    }

    private function cleanDetectedLabel(string $line): string
    {
        $clean = trim(preg_replace('/^\s*\d{1,2}[\.\)]\s*/u', '', $line) ?? $line);

        return mb_strlen($clean) > 90 ? mb_substr($clean, 0, 87).'...' : $clean;
    }

    private function mergeMeta(array $base, array $incoming): array
    {
        foreach (['doctor_name', 'patient_name', 'patient_phone', 'notes'] as $k) {
            if (empty($base[$k]) && ! empty($incoming[$k])) {
                $base[$k] = $incoming[$k];
            }
        }

        return $base;
    }
}
