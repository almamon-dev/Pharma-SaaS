<?php

namespace App\Modules\Accounting\Services;

use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Supplier;
use App\Models\User;
use App\Modules\Accounting\Models\Party;
use App\Modules\Accounting\Models\Voucher;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class PartyService
{
    /**
     * Sync existing customers & suppliers of the current tenant into the unified parties table.
     */
    public function syncFromCrm(): void
    {
        $customers = Customer::query()->get(['id', 'name', 'phone', 'email', 'address']);
        foreach ($customers as $c) {
            Party::query()->firstOrCreate(
                ['customer_id' => $c->id],
                [
                    'type' => Party::TYPE_CUSTOMER,
                    'code' => 'CUS-'.str_pad((string) $c->id, 4, '0', STR_PAD_LEFT),
                    'name' => $c->name,
                    'phone' => $c->phone,
                    'email' => $c->email,
                    'address' => $c->address,
                    'credit_limit_paisa' => 0,
                    'is_active' => true,
                ]
            );
        }

        $suppliers = Supplier::query()->get(['id', 'name', 'phone', 'email', 'address']);
        foreach ($suppliers as $s) {
            Party::query()->firstOrCreate(
                ['supplier_id' => $s->id],
                [
                    'type' => Party::TYPE_SUPPLIER,
                    'code' => 'SUP-'.str_pad((string) $s->id, 4, '0', STR_PAD_LEFT),
                    'name' => $s->name,
                    'phone' => $s->phone,
                    'email' => $s->email,
                    'address' => $s->address,
                    'credit_limit_paisa' => 0,
                    'is_active' => true,
                ]
            );
        }
    }

    /**
     * Credit limit in integer paisa readable directly by the Sales module.
     */
    public function getCustomerCreditLimitPaisa(int $customerId): int
    {
        return (int) (Party::query()->where('customer_id', $customerId)->value('credit_limit_paisa') ?? 0);
    }

    public function updateCreditLimit(Party $party, int $creditLimitPaisa, User $actor): Party
    {
        $before = ['credit_limit_paisa' => (int) $party->credit_limit_paisa];
        $party->forceFill(['credit_limit_paisa' => max(0, $creditLimitPaisa)])->save();

        AuditLog::record(
            action: 'accounting.party.credit_limit_updated',
            description: "Updated credit limit for {$party->name} to ".MoneyPaisa::formatBdt($party->credit_limit_paisa).'.',
            subject: $party,
            metadata: [
                'entity' => 'party',
                'entity_id' => $party->id,
                'before' => $before,
                'after' => ['credit_limit_paisa' => (int) $party->credit_limit_paisa],
            ],
            userId: $actor->id,
        );

        return $party->fresh();
    }

    /**
     * Party Ledger statement for a specific customer or supplier.
     *
     * @return array<string, mixed>
     */
    public function partyLedger(Party $party, ?int $branchId, string $from, string $to): array
    {
        $reportGroups = $party->type === Party::TYPE_SUPPLIER
            ? ['payable']
            : ($party->type === Party::TYPE_CUSTOMER ? ['receivable'] : ['receivable', 'payable']);

        $isPayablePrimary = $party->type === Party::TYPE_SUPPLIER;

        $openingRaw = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->where('v.tenant_id', $party->tenant_id)
            ->where('vl.tenant_id', $party->tenant_id)
            ->where('vl.party_id', $party->id)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereIn('a.report_group', $reportGroups)
            ->whereDate('v.date', '<', $from)
            ->selectRaw('COALESCE(SUM(vl.debit_paisa), 0) as d, COALESCE(SUM(vl.credit_paisa), 0) as c')
            ->first();

        $opening = $isPayablePrimary
            ? ((int) $openingRaw->c - (int) $openingRaw->d)
            : ((int) $openingRaw->d - (int) $openingRaw->c);

        $rows = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->leftJoin('branches as b', 'b.id', '=', 'v.branch_id')
            ->where('v.tenant_id', $party->tenant_id)
            ->where('vl.tenant_id', $party->tenant_id)
            ->where('vl.party_id', $party->id)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereIn('a.report_group', $reportGroups)
            ->whereDate('v.date', '>=', $from)
            ->whereDate('v.date', '<=', $to)
            ->orderBy('v.date')
            ->orderBy('v.id')
            ->orderBy('vl.id')
            ->select([
                'vl.id',
                'v.id as voucher_id',
                'v.number as voucher_number',
                'v.type as voucher_type',
                'v.date',
                'v.narration as voucher_narration',
                'vl.narration as line_narration',
                'vl.debit_paisa',
                'vl.credit_paisa',
                'a.code as account_code',
                'a.name_en as account_name_en',
                'b.name as branch_name',
            ])
            ->get();

        $running = $opening;
        $totalDebit = 0;
        $totalCredit = 0;
        $entries = [];

        foreach ($rows as $r) {
            $d = (int) $r->debit_paisa;
            $c = (int) $r->credit_paisa;
            $totalDebit += $d;
            $totalCredit += $c;
            $running += $isPayablePrimary ? ($c - $d) : ($d - $c);

            $entries[] = [
                'id' => (int) $r->id,
                'voucher_id' => (int) $r->voucher_id,
                'voucher_number' => $r->voucher_number,
                'voucher_type' => $r->voucher_type,
                'date' => (string) $r->date,
                'narration' => $r->line_narration ?: $r->voucher_narration,
                'account_code' => $r->account_code,
                'account_name_en' => $r->account_name_en,
                'branch_name' => $r->branch_name,
                'debit_paisa' => $d,
                'credit_paisa' => $c,
                'running_balance_paisa' => $running,
            ];
        }

        return [
            'from' => $from,
            'to' => $to,
            'is_payable' => $isPayablePrimary,
            'opening_balance_paisa' => $opening,
            'total_debit_paisa' => $totalDebit,
            'total_credit_paisa' => $totalCredit,
            'closing_balance_paisa' => $running,
            'entries' => $entries,
        ];
    }

    /**
     * Compute FIFO Party Ageing in integer paisa for buckets: 0-30, 31-60, 61-90, 90+ days.
     *
     * @return array<int, array<string, mixed>>
     */
    public function partyAgeing(int $tenantId, ?int $branchId, string $partyType, string $asOfDate): array
    {
        $isPayable = $partyType === Party::TYPE_SUPPLIER;
        $reportGroup = $isPayable ? 'payable' : 'receivable';
        $asOf = CarbonImmutable::parse($asOfDate)->startOfDay();

        $parties = Party::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('type', [$partyType, Party::TYPE_BOTH])
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        if ($parties->isEmpty()) {
            return [];
        }

        $lines = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->whereNotNull('vl.party_id')
            ->where('a.report_group', $reportGroup)
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereDate('v.date', '<=', $asOf->toDateString())
            ->orderBy('v.date')
            ->orderBy('v.id')
            ->select(['vl.party_id', 'v.date', 'vl.debit_paisa', 'vl.credit_paisa'])
            ->get()
            ->groupBy('party_id');

        $result = [];

        foreach ($parties as $party) {
            $partyLines = $lines->get($party->id, collect());

            // Collect charges (invoices) chronologically and total settlements (payments/returns)
            $charges = [];
            $settlements = 0;

            foreach ($partyLines as $ln) {
                $charge = $isPayable ? (int) $ln->credit_paisa : (int) $ln->debit_paisa;
                $settle = $isPayable ? (int) $ln->debit_paisa : (int) $ln->credit_paisa;

                if ($charge > 0) {
                    $charges[] = ['date' => (string) $ln->date, 'amount' => $charge];
                }
                if ($settle > 0) {
                    $settlements += $settle;
                }
            }

            // Apply settlements FIFO against oldest charges first
            $b0_30 = 0;
            $b31_60 = 0;
            $b61_90 = 0;
            $b90_plus = 0;

            foreach ($charges as $ch) {
                $remaining = $ch['amount'];
                if ($settlements > 0) {
                    $applied = min($remaining, $settlements);
                    $remaining -= $applied;
                    $settlements -= $applied;
                }

                if ($remaining <= 0) {
                    continue;
                }

                $days = max(0, (int) CarbonImmutable::parse($ch['date'])->startOfDay()->diffInDays($asOf, false));
                if ($days <= 30) {
                    $b0_30 += $remaining;
                } elseif ($days <= 60) {
                    $b31_60 += $remaining;
                } elseif ($days <= 90) {
                    $b61_90 += $remaining;
                } else {
                    $b90_plus += $remaining;
                }
            }

            $totalOutstanding = $b0_30 + $b31_60 + $b61_90 + $b90_plus;

            $result[] = [
                'id' => $party->id,
                'code' => $party->code,
                'type' => $party->type,
                'name' => $party->name,
                'phone' => $party->phone,
                'credit_limit_paisa' => (int) $party->credit_limit_paisa,
                'bucket_0_30_paisa' => $b0_30,
                'bucket_31_60_paisa' => $b31_60,
                'bucket_61_90_paisa' => $b61_90,
                'bucket_90_plus_paisa' => $b90_plus,
                'total_outstanding_paisa' => $totalOutstanding,
                'overdue_60_plus_paisa' => $b61_90 + $b90_plus,
                'over_credit_limit' => ! $isPayable && $party->credit_limit_paisa > 0 && $totalOutstanding > $party->credit_limit_paisa,
            ];
        }

        return $result;
    }
}
