<?php

namespace App\Modules\Accounting\Services;

use App\Modules\Accounting\Models\Voucher;
use Illuminate\Support\Facades\DB;

class VatService
{
    /**
     * Exact integer paisa VAT calculation using basis points (e.g. 500 = 5.00%, 1500 = 15.00%).
     * Half-up rounding — zero floats.
     */
    public static function calculateVatPaisa(int $taxablePaisa, int $rateBps): int
    {
        if ($taxablePaisa <= 0 || $rateBps <= 0) {
            return 0;
        }

        return intdiv(($taxablePaisa * $rateBps) + 5000, 10000);
    }

    /**
     * VAT Summary report aggregated strictly from Posted vouchers using report_group (vat_output & vat_input).
     *
     * @return array<string, mixed>
     */
    public function summary(int $tenantId, ?int $branchId, string $from, string $to): array
    {
        $rows = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->leftJoin('branches as b', 'b.id', '=', 'v.branch_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->whereIn('a.report_group', ['vat_output', 'vat_input'])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereDate('v.date', '>=', $from)
            ->whereDate('v.date', '<=', $to)
            ->orderByDesc('v.date')
            ->orderByDesc('v.id')
            ->select([
                'vl.id',
                'v.id as voucher_id',
                'v.number as voucher_number',
                'v.type as voucher_type',
                'v.date',
                'v.narration',
                'a.code as account_code',
                'a.name_en as account_name_en',
                'a.name_bn as account_name_bn',
                'a.report_group',
                'vl.debit_paisa',
                'vl.credit_paisa',
                'vl.vat_rate_bps',
                'b.name as branch_name',
            ])
            ->get();

        $outputVat = 0;
        $inputVat = 0;
        $entries = [];

        foreach ($rows as $r) {
            $d = (int) $r->debit_paisa;
            $c = (int) $r->credit_paisa;

            if ($r->report_group === 'vat_output') {
                $net = $c - $d; // Output VAT is a liability (normal credit)
                $outputVat += $net;
            } else {
                $net = $d - $c; // Input VAT is an asset (normal debit)
                $inputVat += $net;
            }

            $entries[] = [
                'id' => (int) $r->id,
                'voucher_id' => (int) $r->voucher_id,
                'voucher_number' => $r->voucher_number,
                'voucher_type' => $r->voucher_type,
                'date' => (string) $r->date,
                'narration' => $r->narration,
                'vat_kind' => $r->report_group === 'vat_output' ? 'output' : 'input',
                'account_code' => $r->account_code,
                'account_name_en' => $r->account_name_en,
                'account_name_bn' => $r->account_name_bn,
                'vat_rate_percent' => round(((int) $r->vat_rate_bps) / 100, 2),
                'amount_paisa' => $net,
                'branch_name' => $r->branch_name,
            ];
        }

        return [
            'from' => $from,
            'to' => $to,
            'output_vat_paisa' => $outputVat,
            'input_vat_paisa' => $inputVat,
            'net_vat_payable_paisa' => $outputVat - $inputVat,
            'entries' => $entries,
        ];
    }
}
