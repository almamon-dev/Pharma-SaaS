<?php

namespace App\Modules\Accounting\Services;

use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\AccountingSetting;
use App\Modules\Accounting\Models\Voucher;
use App\Modules\Accounting\Models\VoucherLine;
use App\Tenancy\CurrentTenant;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class VoucherService
{
    public function __construct(
        private readonly CurrentTenant $currentTenant,
        private readonly FiscalPeriodService $fiscalPeriodService,
        private readonly VoucherSequenceService $sequenceService,
        private readonly AccountingCacheService $cacheService,
        private readonly AccountingAccessService $accessService,
    ) {}

    /**
     * Create a voucher (optionally posting immediately inside the same atomic transaction).
     *
     * @param  array{
     *   branch_id: int,
     *   type: string,
     *   date: string,
     *   narration?: string|null,
     *   source_module?: string|null,
     *   source_id?: string|null,
     *   source_event?: string|null,
     *   attachments?: array<int, string>|null,
     *   post_immediately?: bool,
     *   lines: array<int, array{account_id: int, party_id?: int|null, debit_paisa?: int, credit_paisa?: int, narration?: string|null}>
     * }  $payload
     */
    public function create(array $payload, ?User $actor = null): Voucher
    {
        return DB::transaction(function () use ($payload, $actor): Voucher {
            $type = (string) ($payload['type'] ?? '');
            if (! array_key_exists($type, Voucher::TYPES)) {
                throw new DomainException("Unsupported voucher type '{$type}'.");
            }

            $date = CarbonImmutable::parse((string) $payload['date']);
            $period = $this->fiscalPeriodService->resolveForDate($date);
            $postImmediately = (bool) ($payload['post_immediately'] ?? false);

            if ($postImmediately) {
                $this->fiscalPeriodService->assertOpenForPosting($period);
            }

            $lines = $this->validateAndNormalizeLines($payload['lines'] ?? []);
            $totalDebit = array_sum(array_column($lines, 'debit_paisa'));
            $totalCredit = array_sum(array_column($lines, 'credit_paisa'));

            if ($totalDebit <= 0 || $totalDebit !== $totalCredit) {
                throw new DomainException(
                    sprintf(
                        'Voucher is unbalanced: total debit (%s) must equal total credit (%s) and be greater than zero.',
                        MoneyPaisa::toDecimalString($totalDebit),
                        MoneyPaisa::toDecimalString($totalCredit),
                    )
                );
            }

            $branchId = (int) $payload['branch_id'];
            $skipApprovalCheck = (bool) ($payload['skip_approval_check'] ?? false);
            $thresholdPaisa = (int) (AccountingSetting::query()->value('approval_threshold_paisa') ?? 0);
            $requiresApproval = $postImmediately
                && ! $skipApprovalCheck
                && $thresholdPaisa > 0
                && $totalDebit > $thresholdPaisa
                && ($payload['source_module'] ?? 'manual') === 'manual';

            $effectiveStatus = $requiresApproval
                ? Voucher::STATUS_PENDING_APPROVAL
                : ($postImmediately ? Voucher::STATUS_POSTED : Voucher::STATUS_DRAFT);

            $voucherNumber = $effectiveStatus === Voucher::STATUS_POSTED
                ? $this->sequenceService->nextNumber($branchId, $type, $period->fiscalYear)
                : null;

            $voucher = Voucher::query()->create([
                'branch_id' => $branchId,
                'fiscal_year_id' => $period->fiscal_year_id,
                'fiscal_period_id' => $period->id,
                'type' => $type,
                'number' => $voucherNumber,
                'date' => $date->toDateString(),
                'status' => $effectiveStatus,
                'narration' => $payload['narration'] ?? null,
                'total_debit_paisa' => $totalDebit,
                'total_credit_paisa' => $totalCredit,
                'source_module' => $payload['source_module'] ?? null,
                'source_id' => $payload['source_id'] ?? null,
                'source_event' => $payload['source_event'] ?? null,
                'attachments' => $payload['attachments'] ?? null,
                'created_by' => $actor?->id,
                'posted_by' => $effectiveStatus === Voucher::STATUS_POSTED ? $actor?->id : null,
                'posted_at' => $effectiveStatus === Voucher::STATUS_POSTED ? now() : null,
            ]);

            foreach ($lines as $line) {
                VoucherLine::query()->create([
                    'voucher_id' => $voucher->id,
                    'account_id' => $line['account_id'],
                    'party_id' => $line['party_id'] ?? null,
                    'vat_type' => $line['vat_type'] ?? null,
                    'vat_rate_bps' => (int) ($line['vat_rate_bps'] ?? 0),
                    'vat_amount_paisa' => (int) ($line['vat_amount_paisa'] ?? 0),
                    'date' => $date->toDateString(),
                    'debit_paisa' => $line['debit_paisa'],
                    'credit_paisa' => $line['credit_paisa'],
                    'narration' => $line['narration'] ?? null,
                ]);
            }

            $voucher->load('lines.account');

            if ($effectiveStatus === Voucher::STATUS_POSTED) {
                $this->cacheService->invalidateTenant($this->currentTenant->id());
            }

            AuditLog::record(
                action: $effectiveStatus === Voucher::STATUS_POSTED
                    ? 'accounting.voucher.posted'
                    : ($effectiveStatus === Voucher::STATUS_PENDING_APPROVAL
                        ? 'accounting.voucher.pending_approval'
                        : 'accounting.voucher.created'),
                description: ($effectiveStatus === Voucher::STATUS_POSTED
                    ? "Posted voucher {$voucher->number}"
                    : ($effectiveStatus === Voucher::STATUS_PENDING_APPROVAL
                        ? "Submitted voucher #{$voucher->id} for second-user approval"
                        : "Created draft voucher #{$voucher->id}"))
                    ." ({$voucher->type}, ".MoneyPaisa::formatBdt($totalDebit).').',
                subject: $voucher,
                metadata: [
                    'entity' => 'voucher',
                    'entity_id' => $voucher->id,
                    'before' => null,
                    'after' => $this->snapshot($voucher),
                ],
                userId: $actor?->id,
            );

            return $voucher;
        });
    }

    /**
     * Post an existing draft or pending-approval voucher atomically.
     */
    public function post(Voucher $voucher, ?User $actor = null): Voucher
    {
        return DB::transaction(function () use ($voucher, $actor): Voucher {
            /** @var Voucher $locked */
            $locked = Voucher::query()->with('lines', 'fiscalPeriod.fiscalYear')->lockForUpdate()->findOrFail($voucher->id);

            if (! in_array($locked->status, [Voucher::STATUS_DRAFT, Voucher::STATUS_PENDING_APPROVAL], true)) {
                throw new DomainException("Only draft or pending vouchers can be posted (current status: {$locked->status}).");
            }

            $period = $this->fiscalPeriodService->resolveForDate($locked->date->toDateString());
            $this->fiscalPeriodService->assertOpenForPosting($period);

            $lines = $locked->lines;
            if ($lines->count() < 2) {
                throw new DomainException('A voucher must have at least two lines.');
            }

            $totalDebit = (int) $lines->sum('debit_paisa');
            $totalCredit = (int) $lines->sum('credit_paisa');

            if ($totalDebit <= 0 || $totalDebit !== $totalCredit) {
                throw new DomainException('Voucher is unbalanced and cannot be posted.');
            }

            $before = $this->snapshot($locked);
            $number = $this->sequenceService->nextNumber($locked->branch_id, $locked->type, $period->fiscalYear);

            $locked->forceFill([
                'fiscal_year_id' => $period->fiscal_year_id,
                'fiscal_period_id' => $period->id,
                'number' => $number,
                'status' => Voucher::STATUS_POSTED,
                'total_debit_paisa' => $totalDebit,
                'total_credit_paisa' => $totalCredit,
                'posted_by' => $actor?->id,
                'posted_at' => now(),
            ])->save();

            $locked->load('lines.account');
            $this->cacheService->invalidateTenant($this->currentTenant->id());

            AuditLog::record(
                action: 'accounting.voucher.posted',
                description: "Posted voucher {$locked->number} ({$locked->type}, ".MoneyPaisa::formatBdt($totalDebit).').',
                subject: $locked,
                metadata: [
                    'entity' => 'voucher',
                    'entity_id' => $locked->id,
                    'before' => $before,
                    'after' => $this->snapshot($locked),
                ],
                userId: $actor?->id,
            );

            return $locked;
        });
    }

    /**
     * Second-user approval for vouchers above threshold amount -> posts atomically and audit-logs.
     *
     * @throws AuthorizationException
     */
    public function approve(Voucher $voucher, User $approver): Voucher
    {
        $this->accessService->authorize($approver, 'accounting.voucher.approve', 'You do not have permission to approve vouchers.');

        return DB::transaction(function () use ($voucher, $approver): Voucher {
            /** @var Voucher $locked */
            $locked = Voucher::query()->with('lines', 'fiscalPeriod.fiscalYear')->lockForUpdate()->findOrFail($voucher->id);

            if ($locked->status !== Voucher::STATUS_PENDING_APPROVAL) {
                throw new DomainException("Only pending-approval vouchers can be approved (current status: {$locked->status}).");
            }

            if ($locked->created_by !== null && (int) $locked->created_by === (int) $approver->id) {
                throw new DomainException('A second user must approve vouchers above the approval threshold.');
            }

            $period = $this->fiscalPeriodService->resolveForDate($locked->date->toDateString());
            $this->fiscalPeriodService->assertOpenForPosting($period);

            $totalDebit = (int) $locked->lines->sum('debit_paisa');
            $totalCredit = (int) $locked->lines->sum('credit_paisa');
            if ($totalDebit <= 0 || $totalDebit !== $totalCredit) {
                throw new DomainException('Voucher is unbalanced and cannot be approved.');
            }

            $before = $this->snapshot($locked);
            $number = $this->sequenceService->nextNumber($locked->branch_id, $locked->type, $period->fiscalYear);

            $locked->forceFill([
                'fiscal_year_id' => $period->fiscal_year_id,
                'fiscal_period_id' => $period->id,
                'number' => $number,
                'status' => Voucher::STATUS_POSTED,
                'total_debit_paisa' => $totalDebit,
                'total_credit_paisa' => $totalCredit,
                'approved_by' => $approver->id,
                'posted_by' => $approver->id,
                'posted_at' => now(),
            ])->save();

            $locked->load('lines.account');
            $this->cacheService->invalidateTenant($this->currentTenant->id());

            AuditLog::record(
                action: 'accounting.voucher.approved',
                description: "Approved and posted voucher {$locked->number} (".MoneyPaisa::formatBdt($totalDebit).').',
                subject: $locked,
                metadata: [
                    'entity' => 'voucher',
                    'entity_id' => $locked->id,
                    'before' => $before,
                    'after' => $this->snapshot($locked),
                ],
                userId: $approver->id,
            );

            return $locked;
        });
    }

    /**
     * Reverse a posted voucher by generating an equal-and-opposite posted voucher linked to the original.
     */
    public function reverse(Voucher $voucher, User $actor, string $reason, ?string $reversalDate = null): Voucher
    {
        $cleanReason = trim($reason);
        if ($cleanReason === '') {
            throw new DomainException('A reason is required to reverse a posted voucher.');
        }

        return DB::transaction(function () use ($voucher, $actor, $cleanReason, $reversalDate): Voucher {
            /** @var Voucher $original */
            $original = Voucher::query()->with('lines')->lockForUpdate()->findOrFail($voucher->id);

            if ($original->status !== Voucher::STATUS_POSTED) {
                throw new DomainException("Only posted vouchers can be reversed (current status: {$original->status}).");
            }

            if ($original->reversed_voucher_id !== null) {
                throw new DomainException("Voucher {$original->number} has already been reversed.");
            }

            $date = CarbonImmutable::parse($reversalDate ?: now()->toDateString());
            $period = $this->fiscalPeriodService->resolveForDate($date);
            $this->fiscalPeriodService->assertOpenForPosting($period);

            $beforeOriginal = $this->snapshot($original);
            $reversalNumber = $this->sequenceService->nextNumber($original->branch_id, $original->type, $period->fiscalYear);

            $reversal = Voucher::query()->create([
                'branch_id' => $original->branch_id,
                'fiscal_year_id' => $period->fiscal_year_id,
                'fiscal_period_id' => $period->id,
                'type' => $original->type,
                'number' => $reversalNumber,
                'date' => $date->toDateString(),
                'status' => Voucher::STATUS_POSTED,
                'narration' => "Reversal of {$original->number}: {$cleanReason}",
                'total_debit_paisa' => $original->total_credit_paisa,
                'total_credit_paisa' => $original->total_debit_paisa,
                'source_module' => $original->source_module,
                'source_id' => null,
                'source_event' => null,
                'reversal_of_voucher_id' => $original->id,
                'created_by' => $actor->id,
                'posted_by' => $actor->id,
                'posted_at' => now(),
            ]);

            foreach ($original->lines as $line) {
                VoucherLine::query()->create([
                    'voucher_id' => $reversal->id,
                    'account_id' => $line->account_id,
                    'party_id' => $line->party_id,
                    'date' => $date->toDateString(),
                    'debit_paisa' => (int) $line->credit_paisa,
                    'credit_paisa' => (int) $line->debit_paisa,
                    'narration' => "Reversal: ".($line->narration ?: $original->number),
                ]);
            }

            // Link original -> reversal using the controlled internal flag
            $original->allowReversalLinkUpdate = true;
            $original->status = Voucher::STATUS_REVERSED;
            $original->reversed_voucher_id = $reversal->id;
            $original->save();
            $original->allowReversalLinkUpdate = false;

            $reversal->load('lines.account');
            $this->cacheService->invalidateTenant($this->currentTenant->id());

            AuditLog::record(
                action: 'accounting.voucher.reversed',
                description: "Reversed voucher {$original->number} via {$reversal->number}. Reason: {$cleanReason}",
                subject: $original,
                metadata: [
                    'entity' => 'voucher',
                    'entity_id' => $original->id,
                    'reason' => $cleanReason,
                    'reversal_voucher_id' => $reversal->id,
                    'reversal_voucher_number' => $reversal->number,
                    'before' => $beforeOriginal,
                    'after' => $this->snapshot($original),
                ],
                userId: $actor->id,
            );

            return $reversal;
        });
    }

    /**
     * @param  array<int, array<string, mixed>>  $rawLines
     * @return array<int, array{account_id: int, party_id: int|null, debit_paisa: int, credit_paisa: int, narration: string|null}>
     */
    private function validateAndNormalizeLines(array $rawLines): array
    {
        if (count($rawLines) < 2) {
            throw new DomainException('A voucher must contain at least two lines.');
        }

        $tenantId = $this->currentTenant->id();
        $accountIds = array_values(array_unique(array_map(fn ($l) => (int) ($l['account_id'] ?? 0), $rawLines)));
        $validAccounts = Account::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('id', $accountIds)
            ->where('is_active', true)
            ->pluck('id')
            ->all();

        $normalized = [];
        foreach ($rawLines as $idx => $line) {
            $accountId = (int) ($line['account_id'] ?? 0);
            if (! in_array($accountId, $validAccounts, true)) {
                throw new DomainException("Voucher line #".($idx + 1)." references an inactive or invalid account.");
            }

            $debit = (int) ($line['debit_paisa'] ?? 0);
            $credit = (int) ($line['credit_paisa'] ?? 0);

            if ($debit < 0 || $credit < 0) {
                throw new DomainException('Voucher line amounts cannot be negative.');
            }
            if ($debit > 0 && $credit > 0) {
                throw new DomainException('A voucher line must have either debit or credit, never both.');
            }
            if ($debit === 0 && $credit === 0) {
                throw new DomainException('Every voucher line must have a non-zero debit or credit amount.');
            }

            $normalized[] = [
                'account_id' => $accountId,
                'party_id' => isset($line['party_id']) && $line['party_id'] !== null ? (int) $line['party_id'] : null,
                'vat_type' => isset($line['vat_type']) ? (string) $line['vat_type'] : null,
                'vat_rate_bps' => (int) ($line['vat_rate_bps'] ?? 0),
                'vat_amount_paisa' => (int) ($line['vat_amount_paisa'] ?? 0),
                'debit_paisa' => $debit,
                'credit_paisa' => $credit,
                'narration' => isset($line['narration']) ? trim((string) $line['narration']) : null,
            ];
        }

        return $normalized;
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(Voucher $voucher): array
    {
        return [
            'id' => $voucher->id,
            'number' => $voucher->number,
            'type' => $voucher->type,
            'date' => $voucher->date?->toDateString(),
            'status' => $voucher->status,
            'branch_id' => $voucher->branch_id,
            'total_debit_paisa' => (int) $voucher->total_debit_paisa,
            'total_credit_paisa' => (int) $voucher->total_credit_paisa,
            'reversed_voucher_id' => $voucher->reversed_voucher_id,
            'reversal_of_voucher_id' => $voucher->reversal_of_voucher_id,
        ];
    }
}

