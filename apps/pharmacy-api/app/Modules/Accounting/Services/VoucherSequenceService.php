<?php

namespace App\Modules\Accounting\Services;

use App\Models\Branch;
use App\Modules\Accounting\Models\FiscalYear;
use App\Modules\Accounting\Models\Voucher;
use App\Modules\Accounting\Models\VoucherSequence;
use App\Tenancy\CurrentTenant;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class VoucherSequenceService
{
    public function __construct(
        private readonly CurrentTenant $currentTenant,
    ) {}

    /**
     * Atomically generate the next gapless voucher number per tenant + branch + voucher type + fiscal year.
     * Must be invoked inside a DB transaction; uses SELECT ... FOR UPDATE row locking.
     */
    public function nextNumber(int $branchId, string $type, FiscalYear $fiscalYear): string
    {
        $tenantId = $this->currentTenant->id();
        $prefix = Voucher::TYPES[$type] ?? strtoupper(substr($type, 0, 3));
        $branchCode = strtoupper((string) (Branch::query()->whereKey($branchId)->value('code') ?? 'BR'.$branchId));
        $fyCode = preg_replace('/[^0-9]/', '', $fiscalYear->start_date->format('Y')) ?: date('Y');

        $sequence = $this->lockOrCreateSequence($tenantId, $branchId, $type, $fiscalYear->id);
        $next = ((int) $sequence->last_number) + 1;

        DB::table('voucher_sequences')
            ->where('id', $sequence->id)
            ->update([
                'last_number' => $next,
                'updated_at' => now(),
            ]);

        return sprintf('%s-%s-%s-%06d', $prefix, $branchCode, $fyCode, $next);
    }

    private function lockOrCreateSequence(int $tenantId, int $branchId, string $type, int $fiscalYearId): VoucherSequence
    {
        $existing = VoucherSequence::query()
            ->where('tenant_id', $tenantId)
            ->where('branch_id', $branchId)
            ->where('type', $type)
            ->where('fiscal_year_id', $fiscalYearId)
            ->lockForUpdate()
            ->first();

        if ($existing) {
            return $existing;
        }

        try {
            VoucherSequence::query()->create([
                'tenant_id' => $tenantId,
                'branch_id' => $branchId,
                'type' => $type,
                'fiscal_year_id' => $fiscalYearId,
                'last_number' => 0,
            ]);
        } catch (UniqueConstraintViolationException) {
            // Another concurrent transaction inserted the sequence row simultaneously; re-lock below.
        }

        return VoucherSequence::query()
            ->where('tenant_id', $tenantId)
            ->where('branch_id', $branchId)
            ->where('type', $type)
            ->where('fiscal_year_id', $fiscalYearId)
            ->lockForUpdate()
            ->firstOrFail();
    }
}

