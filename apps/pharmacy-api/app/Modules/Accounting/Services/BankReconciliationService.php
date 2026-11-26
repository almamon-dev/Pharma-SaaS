<?php

namespace App\Modules\Accounting\Services;

use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\BankStatement;
use App\Modules\Accounting\Models\BankStatementLine;
use App\Modules\Accounting\Models\Voucher;
use App\Modules\Accounting\Models\VoucherLine;
use App\Tenancy\CurrentTenant;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Support\Facades\DB;

class BankReconciliationService
{
    public function __construct(
        private readonly CurrentTenant $currentTenant,
        private readonly AccountingCacheService $cacheService,
    ) {}

    /**
     * Import a bank statement CSV and automatically match lines against posted bank ledger lines (±3 days, exact paisa).
     *
     * Supported CSV columns (header row optional):
     * - date,reference,description,debit,credit
     * - date,description,debit,credit
     * - date,description,amount  (positive = deposit/credit on statement, negative = withdrawal/debit)
     *
     * @return array{statement: BankStatement, total_lines: int, auto_matched: int, unmatched: int}
     */
    public function importCsv(
        int $accountId,
        ?int $branchId,
        string $statementDate,
        string $filename,
        string $csvContent,
        int $openingBalancePaisa,
        int $closingBalancePaisa,
        User $actor,
    ): array {
        $account = Account::query()
            ->where('is_active', true)
            ->where('report_group', 'bank')
            ->findOrFail($accountId);

        $parsed = $this->parseCsvRows($csvContent);
        if (empty($parsed)) {
            throw new DomainException('No valid transaction rows found in the uploaded CSV.');
        }

        return DB::transaction(function () use (
            $account,
            $branchId,
            $statementDate,
            $filename,
            $parsed,
            $openingBalancePaisa,
            $closingBalancePaisa,
            $actor
        ): array {
            $statement = BankStatement::query()->create([
                'branch_id' => $branchId,
                'account_id' => $account->id,
                'statement_date' => CarbonImmutable::parse($statementDate)->toDateString(),
                'filename' => $filename,
                'opening_balance_paisa' => $openingBalancePaisa,
                'closing_balance_paisa' => $closingBalancePaisa,
                'status' => BankStatement::STATUS_IN_PROGRESS,
                'uploaded_by' => $actor->id,
            ]);

            $tenantId = $this->currentTenant->id();

            // Fetch already-matched voucher line IDs so we never double-match a ledger line
            $usedVoucherLineIds = BankStatementLine::query()
                ->where('tenant_id', $tenantId)
                ->whereNotNull('matched_voucher_line_id')
                ->pluck('matched_voucher_line_id')
                ->all();

            $candidates = DB::table('voucher_lines as vl')
                ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
                ->where('v.tenant_id', $tenantId)
                ->where('vl.tenant_id', $tenantId)
                ->where('vl.account_id', $account->id)
                ->where('v.status', Voucher::STATUS_POSTED)
                ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
                ->when(! empty($usedVoucherLineIds), fn ($q) => $q->whereNotIn('vl.id', $usedVoucherLineIds))
                ->orderBy('v.date')
                ->orderBy('vl.id')
                ->select(['vl.id', 'v.date', 'vl.debit_paisa', 'vl.credit_paisa'])
                ->get();

            $claimedIds = [];
            $autoMatched = 0;

            foreach ($parsed as $row) {
                $lineDate = CarbonImmutable::parse($row['date']);
                $stmtDebit = $row['debit_paisa'];   // Bank withdrawal -> matches Ledger CREDIT
                $stmtCredit = $row['credit_paisa']; // Bank deposit    -> matches Ledger DEBIT

                $matchedVlId = null;
                foreach ($candidates as $cand) {
                    if (in_array((int) $cand->id, $claimedIds, true)) {
                        continue;
                    }
                    $candDate = CarbonImmutable::parse((string) $cand->date);
                    if (abs($lineDate->diffInDays($candDate, false)) > 3) {
                        continue;
                    }
                    // Bank statement deposit (credit) === Book deposit (debit)
                    // Bank statement withdrawal (debit) === Book withdrawal (credit)
                    $amountMatches = ($stmtCredit > 0 && (int) $cand->debit_paisa === $stmtCredit)
                        || ($stmtDebit > 0 && (int) $cand->credit_paisa === $stmtDebit);

                    if ($amountMatches) {
                        $matchedVlId = (int) $cand->id;
                        $claimedIds[] = $matchedVlId;
                        break;
                    }
                }

                BankStatementLine::query()->create([
                    'bank_statement_id' => $statement->id,
                    'line_date' => $lineDate->toDateString(),
                    'reference' => $row['reference'],
                    'description' => $row['description'],
                    'debit_paisa' => $stmtDebit,
                    'credit_paisa' => $stmtCredit,
                    'status' => $matchedVlId ? BankStatementLine::STATUS_MATCHED : BankStatementLine::STATUS_UNMATCHED,
                    'matched_voucher_line_id' => $matchedVlId,
                    'match_method' => $matchedVlId ? 'auto' : null,
                    'matched_at' => $matchedVlId ? now() : null,
                    'matched_by' => $matchedVlId ? $actor->id : null,
                ]);

                if ($matchedVlId) {
                    $autoMatched++;
                }
            }

            $unmatched = count($parsed) - $autoMatched;
            if ($unmatched === 0) {
                $statement->forceFill([
                    'status' => BankStatement::STATUS_RECONCILED,
                    'reconciled_at' => now(),
                ])->save();
            }

            $this->cacheService->invalidateTenant($tenantId);

            AuditLog::record(
                action: 'accounting.bank_statement.imported',
                description: "Imported bank statement '{$filename}' for {$account->name_en} ({$autoMatched}/".count($parsed).' auto-matched).',
                subject: $statement,
                metadata: [
                    'entity' => 'bank_statement',
                    'entity_id' => $statement->id,
                    'total_lines' => count($parsed),
                    'auto_matched' => $autoMatched,
                    'unmatched' => $unmatched,
                ],
                userId: $actor->id,
            );

            return [
                'statement' => $statement->fresh('lines'),
                'total_lines' => count($parsed),
                'auto_matched' => $autoMatched,
                'unmatched' => $unmatched,
            ];
        });
    }

    /**
     * Manually match a bank statement line to a posted bank voucher line.
     */
    public function manualMatch(BankStatementLine $line, VoucherLine $voucherLine, User $actor): BankStatementLine
    {
        $statement = $line->statement()->firstOrFail();
        $voucher = $voucherLine->voucher()->firstOrFail();

        if ($voucher->status !== Voucher::STATUS_POSTED) {
            throw new DomainException('Bank statement lines can only be matched against posted vouchers.');
        }

        if ((int) $voucherLine->account_id !== (int) $statement->account_id) {
            throw new DomainException('Selected ledger line belongs to a different account.');
        }

        $alreadyUsed = BankStatementLine::query()
            ->where('matched_voucher_line_id', $voucherLine->id)
            ->where('id', '!=', $line->id)
            ->exists();
        if ($alreadyUsed) {
            throw new DomainException('That ledger entry is already matched to another bank statement line.');
        }

        $expectedOk = ($line->credit_paisa > 0 && (int) $voucherLine->debit_paisa === (int) $line->credit_paisa)
            || ($line->debit_paisa > 0 && (int) $voucherLine->credit_paisa === (int) $line->debit_paisa);
        if (! $expectedOk) {
            throw new DomainException('Amount and direction must match between bank statement line and ledger entry.');
        }

        $line->forceFill([
            'status' => BankStatementLine::STATUS_MATCHED,
            'matched_voucher_line_id' => $voucherLine->id,
            'match_method' => 'manual',
            'matched_at' => now(),
            'matched_by' => $actor->id,
        ])->save();

        $this->refreshStatementStatus($statement);
        $this->cacheService->invalidateTenant($this->currentTenant->id());

        AuditLog::record(
            action: 'accounting.bank_line.matched',
            description: "Manually matched bank statement line #{$line->id} to voucher {$voucher->number}.",
            subject: $line,
            metadata: ['voucher_line_id' => $voucherLine->id, 'voucher_number' => $voucher->number],
            userId: $actor->id,
        );

        return $line->fresh();
    }

    public function unmatch(BankStatementLine $line, User $actor): BankStatementLine
    {
        $statement = $line->statement()->firstOrFail();
        $prevVl = $line->matched_voucher_line_id;

        $line->forceFill([
            'status' => BankStatementLine::STATUS_UNMATCHED,
            'matched_voucher_line_id' => null,
            'match_method' => null,
            'matched_at' => null,
            'matched_by' => null,
        ])->save();

        $this->refreshStatementStatus($statement);
        $this->cacheService->invalidateTenant($this->currentTenant->id());

        AuditLog::record(
            action: 'accounting.bank_line.unmatched',
            description: "Unmatched bank statement line #{$line->id}.",
            subject: $line,
            metadata: ['previous_voucher_line_id' => $prevVl],
            userId: $actor->id,
        );

        return $line->fresh();
    }

    public function ignoreLine(BankStatementLine $line, User $actor): BankStatementLine
    {
        $statement = $line->statement()->firstOrFail();

        $line->forceFill([
            'status' => BankStatementLine::STATUS_IGNORED,
            'matched_voucher_line_id' => null,
            'match_method' => null,
            'matched_at' => now(),
            'matched_by' => $actor->id,
        ])->save();

        $this->refreshStatementStatus($statement);
        $this->cacheService->invalidateTenant($this->currentTenant->id());

        AuditLog::record(
            action: 'accounting.bank_line.ignored',
            description: "Marked bank statement line #{$line->id} as ignored.",
            subject: $line,
            userId: $actor->id,
        );

        return $line->fresh();
    }

    /**
     * Build full Bank Reconciliation summary, statement lines, and unmatched book candidates.
     *
     * @return array<string, mixed>
     */
    public function summary(int $tenantId, ?int $branchId, int $accountId, ?int $statementId = null): array
    {
        $statements = BankStatement::query()
            ->where('tenant_id', $tenantId)
            ->where('account_id', $accountId)
            ->orderByDesc('statement_date')
            ->orderByDesc('id')
            ->limit(20)
            ->get();

        /** @var BankStatement|null $active */
        $active = $statementId
            ? $statements->firstWhere('id', $statementId)
            : $statements->first();

        $asOf = $active ? $active->statement_date->toDateString() : CarbonImmutable::today()->toDateString();

        // Book balance of this bank account as of statement_date
        $bookBalancePaisa = (int) DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->where('vl.account_id', $accountId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereDate('v.date', '<=', $asOf)
            ->selectRaw('COALESCE(SUM(vl.debit_paisa - vl.credit_paisa), 0) as bal')
            ->value('bal');

        $matchedVlIds = BankStatementLine::query()
            ->where('tenant_id', $tenantId)
            ->whereNotNull('matched_voucher_line_id')
            ->pluck('matched_voucher_line_id')
            ->all();

        // Unmatched ledger entries in our books (deposits in transit / outstanding cheques)
        $unmatchedBookLines = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->where('vl.account_id', $accountId)
            ->where('v.status', Voucher::STATUS_POSTED)
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->when(! empty($matchedVlIds), fn ($q) => $q->whereNotIn('vl.id', $matchedVlIds))
            ->whereDate('v.date', '<=', $asOf)
            ->orderByDesc('v.date')
            ->limit(100)
            ->select(['vl.id', 'v.number as voucher_number', 'v.type as voucher_type', 'v.date', 'v.narration', 'vl.debit_paisa', 'vl.credit_paisa'])
            ->get()
            ->map(fn ($r) => [
                'id' => (int) $r->id,
                'voucher_number' => $r->voucher_number,
                'voucher_type' => $r->voucher_type,
                'date' => (string) $r->date,
                'narration' => $r->narration,
                'debit_paisa' => (int) $r->debit_paisa,
                'credit_paisa' => (int) $r->credit_paisa,
            ])->values()->all();

        $lines = [];
        $matchedCount = 0;
        $unmatchedCount = 0;
        $unmatchedBankNet = 0;

        if ($active) {
            $active->load(['lines.matchedVoucherLine.voucher']);
            foreach ($active->lines as $l) {
                if ($l->status === BankStatementLine::STATUS_MATCHED) {
                    $matchedCount++;
                } elseif ($l->status === BankStatementLine::STATUS_UNMATCHED) {
                    $unmatchedCount++;
                    $unmatchedBankNet += ((int) $l->credit_paisa - (int) $l->debit_paisa);
                }

                $lines[] = [
                    'id' => $l->id,
                    'line_date' => $l->line_date->toDateString(),
                    'reference' => $l->reference,
                    'description' => $l->description,
                    'debit_paisa' => (int) $l->debit_paisa,
                    'credit_paisa' => (int) $l->credit_paisa,
                    'status' => $l->status,
                    'match_method' => $l->match_method,
                    'matched_voucher_line_id' => $l->matched_voucher_line_id,
                    'matched_voucher_number' => $l->matchedVoucherLine?->voucher?->number,
                ];
            }
        }

        $statementClosing = $active ? (int) $active->closing_balance_paisa : 0;
        $unmatchedBookNet = array_sum(array_map(fn (array $b) => $b['debit_paisa'] - $b['credit_paisa'], $unmatchedBookLines));
        // Difference between Statement Balance and Book Balance (raw + adjusted)
        $rawDifference = $active ? ($statementClosing - $bookBalancePaisa) : 0;

        return [
            'account_id' => $accountId,
            'statements' => $statements->map(fn (BankStatement $s) => [
                'id' => $s->id,
                'statement_date' => $s->statement_date->toDateString(),
                'filename' => $s->filename,
                'opening_balance_paisa' => (int) $s->opening_balance_paisa,
                'closing_balance_paisa' => (int) $s->closing_balance_paisa,
                'status' => $s->status,
            ])->values()->all(),
            'active_statement' => $active ? [
                'id' => $active->id,
                'statement_date' => $active->statement_date->toDateString(),
                'filename' => $active->filename,
                'opening_balance_paisa' => (int) $active->opening_balance_paisa,
                'closing_balance_paisa' => $statementClosing,
                'status' => $active->status,
            ] : null,
            'metrics' => [
                'statement_closing_paisa' => $statementClosing,
                'book_balance_paisa' => $bookBalancePaisa,
                'raw_difference_paisa' => $rawDifference,
                'unmatched_bank_net_paisa' => $unmatchedBankNet,
                'unmatched_book_net_paisa' => $unmatchedBookNet,
                'matched_count' => $matchedCount,
                'unmatched_count' => $unmatchedCount,
            ],
            'lines' => $lines,
            'unmatched_book_lines' => $unmatchedBookLines,
        ];
    }

    private function refreshStatementStatus(BankStatement $statement): void
    {
        $hasUnmatched = $statement->lines()
            ->where('status', BankStatementLine::STATUS_UNMATCHED)
            ->exists();

        $statement->forceFill([
            'status' => $hasUnmatched ? BankStatement::STATUS_IN_PROGRESS : BankStatement::STATUS_RECONCILED,
            'reconciled_at' => $hasUnmatched ? null : now(),
        ])->save();
    }

    /**
     * @return array<int, array{date: string, reference: string|null, description: string|null, debit_paisa: int, credit_paisa: int}>
     */
    private function parseCsvRows(string $csvContent): array
    {
        $rawLines = preg_split('/\r\n|\r|\n/', trim($csvContent)) ?: [];
        $parsed = [];
        $headerMap = null;

        foreach ($rawLines as $idx => $raw) {
            if (trim($raw) === '') {
                continue;
            }
            $cols = array_map(fn ($v) => trim((string) $v), str_getcsv($raw));
            if ($idx === 0 && ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $cols[0] ?? '') && ! preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $cols[0] ?? '')) {
                $headerMap = array_map('strtolower', $cols);
                continue;
            }

            if ($headerMap !== null) {
                $assoc = [];
                foreach ($headerMap as $i => $key) {
                    $assoc[$key] = $cols[$i] ?? '';
                }
                $dateStr = $assoc['date'] ?? $assoc['transaction_date'] ?? ($cols[0] ?? '');
                $ref = $assoc['reference'] ?? $assoc['ref'] ?? null;
                $desc = $assoc['description'] ?? $assoc['narration'] ?? $assoc['particulars'] ?? null;

                if (isset($assoc['amount']) && $assoc['amount'] !== '') {
                    $amtRaw = str_replace([',', '৳', ' '], '', $assoc['amount']);
                    $isNeg = str_starts_with($amtRaw, '-');
                    $absPaisa = MoneyPaisa::fromBdt(ltrim($amtRaw, '+-'));
                    $debitPaisa = $isNeg ? $absPaisa : 0;
                    $creditPaisa = $isNeg ? 0 : $absPaisa;
                } else {
                    $debitStr = str_replace([',', '৳', ' '], '', (string) ($assoc['debit'] ?? $assoc['withdrawal'] ?? '0'));
                    $creditStr = str_replace([',', '৳', ' '], '', (string) ($assoc['credit'] ?? $assoc['deposit'] ?? '0'));
                    $debitPaisa = $debitStr !== '' && $debitStr !== '0' ? MoneyPaisa::fromBdt($debitStr) : 0;
                    $creditPaisa = $creditStr !== '' && $creditStr !== '0' ? MoneyPaisa::fromBdt($creditStr) : 0;
                }
            } else {
                // Fallback positional: date, reference, description, debit, credit
                $dateStr = $cols[0] ?? '';
                $ref = count($cols) >= 5 ? ($cols[1] ?: null) : null;
                $desc = count($cols) >= 5 ? ($cols[2] ?: null) : ($cols[1] ?? null);
                $dIdx = count($cols) >= 5 ? 3 : 2;
                $cIdx = count($cols) >= 5 ? 4 : 3;
                $debitStr = str_replace([',', '৳', ' '], '', (string) ($cols[$dIdx] ?? '0'));
                $creditStr = str_replace([',', '৳', ' '], '', (string) ($cols[$cIdx] ?? '0'));
                $debitPaisa = $debitStr !== '' && $debitStr !== '0' ? MoneyPaisa::fromBdt($debitStr) : 0;
                $creditPaisa = $creditStr !== '' && $creditStr !== '0' ? MoneyPaisa::fromBdt($creditStr) : 0;
            }

            if ($dateStr === '' || ($debitPaisa === 0 && $creditPaisa === 0)) {
                continue;
            }

            $parsed[] = [
                'date' => CarbonImmutable::parse($dateStr)->toDateString(),
                'reference' => $ref ?: null,
                'description' => $desc ?: null,
                'debit_paisa' => $debitPaisa,
                'credit_paisa' => $creditPaisa,
            ];
        }

        return $parsed;
    }
}

