<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\MedicineCategory;
use App\Models\Supplier;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function index(Request $request, TenantContext $tenantContext): Response
    {
        $search = trim((string) $request->query('q', ''));
        $filter = (string) $request->query('filter', 'all');
        $categoryId = $request->query('category_id');

        $medicinesQuery = Medicine::query()
            ->with(['category:id,name', 'batches' => fn ($q) => $q->where('status', 'active')->orderBy('expiry_date')])
            ->withSum(['batches as available_stock' => fn ($q) => $q->where('status', 'active')], 'quantity_available')
            ->when($search !== '', function ($query) use ($search): void {
                $needle = mb_strtolower($search);
                $query->where(function ($sub) use ($needle): void {
                    $sub->whereRaw('LOWER(name) LIKE ?', ["%{$needle}%"])
                        ->orWhereRaw('LOWER(COALESCE(generic_name, \'\')) LIKE ?', ["%{$needle}%"])
                        ->orWhereRaw('LOWER(sku) LIKE ?', ["%{$needle}%"])
                        ->orWhereRaw('LOWER(COALESCE(barcode, \'\')) LIKE ?', ["%{$needle}%"]);
                });
            })
            ->when($categoryId, fn ($query) => $query->where('category_id', (int) $categoryId))
            ->orderBy('name');

        $medicines = $medicinesQuery->get()->map(function (Medicine $medicine) {
            $stock = (int) ($medicine->available_stock ?? 0);
            $nextBatch = $medicine->batches->where('quantity_available', '>', 0)->sortBy('expiry_date')->first();

            return [
                'id' => $medicine->id,
                'name' => $medicine->name,
                'generic_name' => $medicine->generic_name,
                'manufacturer' => $medicine->manufacturer,
                'sku' => $medicine->sku,
                'barcode' => $medicine->barcode,
                'dosage_form' => $medicine->dosage_form,
                'strength' => $medicine->strength,
                'unit' => $medicine->unit,
                'units_per_strip' => (int) ($medicine->units_per_strip ?: 1),
                'units_per_box' => (int) ($medicine->units_per_box ?: 1),
                'category_name' => $medicine->category?->name ?? 'Uncategorized',
                'reorder_level' => $medicine->reorder_level,
                'requires_prescription' => $medicine->requires_prescription,
                'default_selling_price' => (float) $medicine->default_selling_price,
                'box_selling_price' => $medicine->resolvedBoxSellingPrice(),
                'available_stock' => $stock,
                'is_low_stock' => $stock <= $medicine->reorder_level,
                'nearest_expiry' => $nextBatch?->expiry_date?->toDateString(),
                'days_to_expiry' => $nextBatch?->expiry_date
                    ? (int) now()->startOfDay()->diffInDays($nextBatch->expiry_date, false)
                    : null,
                'batch_count' => $medicine->batches->count(),
            ];
        });

        if ($filter === 'low_stock') {
            $medicines = $medicines->where('is_low_stock', true)->values();
        } elseif ($filter === 'expiring') {
            $medicines = $medicines->filter(
                fn ($m) => $m['days_to_expiry'] !== null && $m['days_to_expiry'] <= 30
            )->values();
        } else {
            $medicines = $medicines->values();
        }

        return Inertia::render('Inventory/Index', [
            'medicines' => $medicines,
            'categories' => MedicineCategory::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'suppliers' => Supplier::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'filters' => [
                'q' => $search,
                'filter' => $filter,
                'category_id' => $categoryId ? (string) $categoryId : '',
            ],
            'activeBranchName' => $tenantContext->branch()?->name,
        ]);
    }

    public function store(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        $branch = $tenantContext->branch();

        $subscription = $tenant?->subscriberSubscription();
        $maxMedicines = $subscription?->plan?->max_medicines ?? 500;

        if (Medicine::query()->count() >= $maxMedicines) {
            return back()->with('error', "Plan limit reached ({$maxMedicines} medicines). Upgrade your subscription to add more SKUs.");
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'generic_name' => ['nullable', 'string', 'max:255'],
            'manufacturer' => ['nullable', 'string', 'max:255'],
            'sku' => [
                'required',
                'string',
                'max:64',
                Rule::unique('medicines', 'sku')->where('tenant_id', $tenant->id),
            ],
            'barcode' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('medicines', 'barcode')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'category_id' => [
                'nullable',
                Rule::exists('medicine_categories', 'id')->where('tenant_id', $tenant->id),
            ],
            'dosage_form' => ['required', 'string', 'max:50'],
            'strength' => ['nullable', 'string', 'max:64'],
            'unit' => ['required', 'string', 'max:32'],
            'units_per_strip' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'units_per_box' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'reorder_level' => ['required', 'integer', 'min:0'],
            'requires_prescription' => ['boolean'],
            'purchase_price' => ['required_without:box_purchase_price', 'nullable', 'numeric', 'min:0'],
            'box_purchase_price' => ['nullable', 'numeric', 'min:0'],
            'selling_price' => ['required_without:box_selling_price', 'nullable', 'numeric', 'min:0'],
            'box_selling_price' => ['nullable', 'numeric', 'min:0'],
            'batch_number' => ['nullable', 'string', 'max:64'],
            'quantity' => ['nullable', 'integer', 'min:0'],
            'expiry_date' => ['nullable', 'date'],
        ]);

        DB::transaction(function () use ($validated, $branch, $tenant): void {
            $barcode = ! empty($validated['barcode'])
                ? trim($validated['barcode'])
                : $this->generateUniqueEan13($tenant->id);

            $unitsPerStrip = max(1, (int) ($validated['units_per_strip'] ?? 1));
            $unitsPerBox = max(1, (int) ($validated['units_per_box'] ?? 1));

            $unitPurchase = isset($validated['purchase_price']) && $validated['purchase_price'] !== ''
                ? round((float) $validated['purchase_price'], 2)
                : round(((float) ($validated['box_purchase_price'] ?? 0)) / $unitsPerBox, 2);

            $unitSelling = isset($validated['selling_price']) && $validated['selling_price'] !== ''
                ? round((float) $validated['selling_price'], 2)
                : round(((float) ($validated['box_selling_price'] ?? 0)) / $unitsPerBox, 2);

            $boxPurchase = isset($validated['box_purchase_price']) && $validated['box_purchase_price'] !== ''
                ? round((float) $validated['box_purchase_price'], 2)
                : ($unitsPerBox > 1 ? round($unitPurchase * $unitsPerBox, 2) : null);

            $boxSelling = isset($validated['box_selling_price']) && $validated['box_selling_price'] !== ''
                ? round((float) $validated['box_selling_price'], 2)
                : ($unitsPerBox > 1 ? round($unitSelling * $unitsPerBox, 2) : null);

            $medicine = Medicine::query()->create([
                'category_id' => $validated['category_id'] ?? null,
                'name' => trim($validated['name']),
                'generic_name' => $validated['generic_name'] ?? null,
                'manufacturer' => $validated['manufacturer'] ?? null,
                'sku' => strtoupper(trim($validated['sku'])),
                'barcode' => $barcode,
                'dosage_form' => $validated['dosage_form'],
                'strength' => $validated['strength'] ?? null,
                'unit' => $validated['unit'],
                'units_per_strip' => $unitsPerStrip,
                'units_per_box' => $unitsPerBox,
                'reorder_level' => $validated['reorder_level'],
                'requires_prescription' => (bool) ($validated['requires_prescription'] ?? false),
                'default_purchase_price' => $unitPurchase,
                'box_purchase_price' => $boxPurchase,
                'default_selling_price' => $unitSelling,
                'box_selling_price' => $boxSelling,
                'is_active' => true,
            ]);

            if ($branch && ! empty($validated['batch_number']) && ! empty($validated['quantity']) && ! empty($validated['expiry_date'])) {
                MedicineBatch::query()->create([
                    'branch_id' => $branch->id,
                    'medicine_id' => $medicine->id,
                    'batch_number' => strtoupper(trim($validated['batch_number'])),
                    'expiry_date' => $validated['expiry_date'],
                    'quantity_received' => $validated['quantity'],
                    'quantity_available' => $validated['quantity'],
                    'purchase_price' => $unitPurchase,
                    'selling_price' => $unitSelling,
                    'status' => 'active',
                ]);
            }

            AuditLog::record(
                action: 'inventory.medicine_created',
                description: "Added {$medicine->name} ({$medicine->sku}) to tenant catalog.",
                subject: $medicine,
            );
        });

        return back()->with('success', 'Medicine saved to tenant inventory catalog.');
    }

    private function generateUniqueEan13(int $tenantId): string
    {
        $tenantPart = str_pad((string) ($tenantId % 1000), 3, '0', STR_PAD_LEFT);

        for ($attempt = 0; $attempt < 20; $attempt++) {
            $randomPart = str_pad((string) random_int(0, 9999999), 7, '0', STR_PAD_LEFT);
            $base = '20'.$tenantPart.$randomPart;

            $sum = 0;
            for ($i = 0; $i < 12; $i++) {
                $sum += ((int) $base[$i]) * ($i % 2 === 0 ? 1 : 3);
            }
            $checkDigit = (10 - ($sum % 10)) % 10;
            $candidate = $base.$checkDigit;

            if (! Medicine::query()->withTrashed()->where('barcode', $candidate)->exists()) {
                return $candidate;
            }
        }

        return '20'.substr((string) (int) (microtime(true) * 1000), -11);
    }
}
