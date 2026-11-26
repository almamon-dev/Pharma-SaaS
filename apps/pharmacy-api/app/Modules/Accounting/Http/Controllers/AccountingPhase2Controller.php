<?php

namespace App\Modules\Accounting\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Modules\Accounting\Contracts\AccountingPosterInterface;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\AccountingSetting;
use App\Modules\Accounting\Models\Party;
use App\Modules\Accounting\Models\PostingError;
use App\Modules\Accounting\Models\Voucher;
use App\Modules\Accounting\Services\AccountingAccessService;
use App\Modules\Accounting\Services\AccountingBootstrapService;
use App\Modules\Accounting\Services\MoneyPaisa;
use App\Modules\Accounting\Services\PartyService;
use App\Modules\Accounting\Services\SimpleAccountingService;
use App\Modules\Accounting\Services\VatService;
use App\Modules\Accounting\Services\VoucherService;
use App\Support\TenantContext;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AccountingPhase2Controller extends Controller
{
    public function __construct(
        private readonly TenantContext $tenantContext,
        private readonly AccountingBootstrapService $bootstrapService,
        private readonly AccountingAccessService $accessService,
        private readonly VoucherService $voucherService,
        private readonly PartyService $partyService,
        private readonly VatService $vatService,
        private readonly SimpleAccountingService $simpleService,
        private readonly AccountingPosterInterface $poster,
    ) {}

    /**
     * Receipt, Payment & Contra Vouchers screen (available in BOTH Simple & Advanced Modes).
     */
    public function vouchers(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.view');

        $settings = $this->ensureBootstrapped();
        $this->partyService->syncFromCrm();

        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);
        $type = $request->filled('type') ? (string) $request->input('type') : null;
        $statusFilter = $request->filled('status') ? (string) $request->input('status') : null;
        $from = (string) ($request->input('from') ?: CarbonImmutable::today()->startOfMonth()->toDateString());
        $to = (string) ($request->input('to') ?: CarbonImmutable::today()->toDateString());

        $vouchers = Voucher::query()
            ->with(['branch:id,name,code', 'lines.account:id,code,name_en,name_bn,report_group', 'lines.party:id,name', 'creator:id,name', 'approver:id,name'])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->when($type !== null, fn ($q) => $q->where('type', $type))
            ->when($statusFilter !== null, fn ($q) => $q->where('status', $statusFilter))
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->limit(150)
            ->get()
            ->map(fn (Voucher $v) => [
                'id' => $v->id,
                'number' => $v->number,
                'type' => $v->type,
                'date' => $v->date->toDateString(),
                'status' => $v->status,
                'narration' => $v->narration,
                'total_debit_paisa' => (int) $v->total_debit_paisa,
                'branch_name' => $v->branch?->name ?? 'Branch',
                'created_by' => $v->creator?->name ?? 'System',
                'created_by_id' => $v->created_by,
                'approved_by' => $v->approver?->name,
                'is_reversal' => $v->reversal_of_voucher_id !== null,
                'lines' => $v->lines->map(fn ($l) => [
                    'id' => $l->id,
                    'account_code' => $l->account?->code,
                    'account_name_en' => $l->account?->name_en,
                    'account_name_bn' => $l->account?->name_bn,
                    'party_name' => $l->party?->name,
                    'debit_paisa' => (int) $l->debit_paisa,
                    'credit_paisa' => (int) $l->credit_paisa,
                    'vat_type' => $l->vat_type,
                ])->values(),
            ]);

        $accounts = Account::query()
            ->where('is_active', true)
            ->orderBy('code')
            ->get(['id', 'code', 'name_en', 'name_bn', 'type', 'report_group']);

        $parties = Party::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'type', 'code', 'name', 'phone']);

        return Inertia::render('Accounting/Vouchers', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'currentUserId' => $user->id,
            'filters' => ['from' => $from, 'to' => $to, 'type' => $type ?? '', 'status' => $statusFilter ?? ''],
            'vouchers' => $vouchers,
            'accounts' => $accounts,
            'parties' => $parties,
        ]);
    }

    /**
     * Create & Post a Receipt, Payment, or Contra voucher (works in both Simple & Advanced Mode).
     */
    public function storeRpcVoucher(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.voucher.create', 'You do not have permission to create vouchers.');

        $settings = $this->ensureBootstrapped();

        $validated = $request->validate([
            'type' => ['required', 'in:receipt,payment,contra'],
            'date' => ['required', 'date'],
            'branch_id' => ['nullable', 'integer'],
            'cash_bank_account_id' => ['required', 'integer'],
            'counter_account_id' => ['required', 'integer', 'different:cash_bank_account_id'],
            'party_id' => ['nullable', 'integer'],
            'amount' => ['required', 'string', 'regex:/^\d+(?:,\d{3})*(?:\.\d{1,2})?$/'],
            'include_vat' => ['nullable', 'boolean'],
            'vat_rate_percent' => ['nullable', 'numeric', 'min:0', 'max:50'],
            'narration' => ['required', 'string', 'min:3', 'max:300'],
        ]);

        try {
            $branchId = $this->accessService->resolveWriteBranchId(
                $user,
                isset($validated['branch_id']) ? (int) $validated['branch_id'] : null
            );

            $basePaisa = MoneyPaisa::fromBdt($validated['amount']);
            if ($basePaisa <= 0) {
                throw new DomainException('Voucher amount must be greater than zero.');
            }

            $cashBankAcc = Account::query()->where('is_active', true)->findOrFail($validated['cash_bank_account_id']);
            $counterAcc = Account::query()->where('is_active', true)->findOrFail($validated['counter_account_id']);
            $partyId = isset($validated['party_id']) && $validated['party_id'] ? (int) $validated['party_id'] : null;

            $includeVat = (bool) ($validated['include_vat'] ?? false) && $validated['type'] !== 'contra';
            $vatBps = $includeVat
                ? (int) round(((float) ($validated['vat_rate_percent'] ?? ($settings->vat_rate_bps / 100))) * 100)
                : 0;
            $vatPaisa = $includeVat ? VatService::calculateVatPaisa($basePaisa, $vatBps) : 0;
            $grossPaisa = $basePaisa + $vatPaisa;

            $lines = [];
            if ($validated['type'] === 'receipt') {
                // Dr Cash/Bank (gross), Cr Counter/Receivable/Income (base) + Cr VAT Output (vat)
                $lines[] = [
                    'account_id' => $cashBankAcc->id,
                    'debit_paisa' => $grossPaisa,
                    'credit_paisa' => 0,
                    'narration' => $validated['narration'],
                ];
                $lines[] = [
                    'account_id' => $counterAcc->id,
                    'party_id' => $partyId,
                    'debit_paisa' => 0,
                    'credit_paisa' => $basePaisa,
                    'narration' => $validated['narration'],
                ];
                if ($vatPaisa > 0) {
                    $vatOutId = $settings->default_vat_output_account_id
                        ?? Account::query()->where('code', '2100')->value('id');
                    $lines[] = [
                        'account_id' => (int) $vatOutId,
                        'debit_paisa' => 0,
                        'credit_paisa' => $vatPaisa,
                        'vat_type' => 'output',
                        'vat_rate_bps' => $vatBps,
                        'vat_amount_paisa' => $vatPaisa,
                        'narration' => 'Output VAT',
                    ];
                }
            } elseif ($validated['type'] === 'payment') {
                // Dr Counter/Payable/Expense (base) + Dr VAT Input (vat), Cr Cash/Bank (gross)
                $lines[] = [
                    'account_id' => $counterAcc->id,
                    'party_id' => $partyId,
                    'debit_paisa' => $basePaisa,
                    'credit_paisa' => 0,
                    'narration' => $validated['narration'],
                ];
                if ($vatPaisa > 0) {
                    $vatInId = $settings->default_vat_input_account_id
                        ?? Account::query()->where('code', '1300')->value('id');
                    $lines[] = [
                        'account_id' => (int) $vatInId,
                        'debit_paisa' => $vatPaisa,
                        'credit_paisa' => 0,
                        'vat_type' => 'input',
                        'vat_rate_bps' => $vatBps,
                        'vat_amount_paisa' => $vatPaisa,
                        'narration' => 'Input VAT',
                    ];
                }
                $lines[] = [
                    'account_id' => $cashBankAcc->id,
                    'debit_paisa' => 0,
                    'credit_paisa' => $grossPaisa,
                    'narration' => $validated['narration'],
                ];
            } else {
                // Contra (Cash <-> Bank): Dr Destination ($counterAcc), Cr Source ($cashBankAcc)
                if (! in_array($cashBankAcc->report_group, ['cash', 'bank'], true)
                    || ! in_array($counterAcc->report_group, ['cash', 'bank'], true)) {
                    throw new DomainException('Contra transfers must be strictly between Cash and Bank/Wallet accounts.');
                }
                $lines = [
                    ['account_id' => $counterAcc->id, 'debit_paisa' => $basePaisa, 'credit_paisa' => 0, 'narration' => $validated['narration']],
                    ['account_id' => $cashBankAcc->id, 'debit_paisa' => 0, 'credit_paisa' => $basePaisa, 'narration' => $validated['narration']],
                ];
            }

            $canPost = $this->accessService->hasPermission($user, 'accounting.voucher.post');

            $voucher = $this->voucherService->create([
                'branch_id' => $branchId,
                'type' => $validated['type'],
                'date' => $validated['date'],
                'narration' => $validated['narration'],
                'source_module' => 'manual',
                'post_immediately' => $canPost,
                'lines' => $lines,
            ], $user);

            return back()->with('success', "Voucher {$voucher->number} saved (".MoneyPaisa::formatBdt($grossPaisa).').');
        } catch (DomainException|\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    /**
     * Parties Directory & Ageing (0-30, 31-60, 61-90, 90+ days).
     */
    public function parties(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.reports.view');

        $settings = $this->ensureBootstrapped();
        $this->partyService->syncFromCrm();

        $tenantId = $this->tenantContext->id();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);
        $partyType = in_array($request->input('type'), ['customer', 'supplier'], true)
            ? (string) $request->input('type')
            : 'customer';
        $asOf = (string) ($request->input('as_of') ?: CarbonImmutable::today()->toDateString());

        $ageingRows = $this->partyService->partyAgeing($tenantId, $branchId, $partyType, $asOf);

        $totals = [
            'b0_30' => array_sum(array_column($ageingRows, 'bucket_0_30_paisa')),
            'b31_60' => array_sum(array_column($ageingRows, 'bucket_31_60_paisa')),
            'b61_90' => array_sum(array_column($ageingRows, 'bucket_61_90_paisa')),
            'b90_plus' => array_sum(array_column($ageingRows, 'bucket_90_plus_paisa')),
            'total' => array_sum(array_column($ageingRows, 'total_outstanding_paisa')),
        ];

        return Inertia::render('Accounting/Parties', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'filters' => ['type' => $partyType, 'as_of' => $asOf],
            'totals' => $totals,
            'parties' => $ageingRows,
        ]);
    }

    public function storeParty(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.voucher.create');

        $validated = $request->validate([
            'type' => ['required', 'in:customer,supplier,both'],
            'name' => ['required', 'string', 'max:160'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:160'],
            'address' => ['nullable', 'string', 'max:255'],
            'credit_limit_bdt' => ['nullable', 'string', 'regex:/^\d+(?:,\d{3})*(?:\.\d{1,2})?$/'],
        ]);

        $limitPaisa = ! empty($validated['credit_limit_bdt'])
            ? MoneyPaisa::fromBdt($validated['credit_limit_bdt'])
            : 0;

        $prefix = $validated['type'] === 'supplier' ? 'SUP' : 'CUS';
        $party = Party::query()->create([
            'type' => $validated['type'],
            'code' => $prefix.'-'.str_pad((string) (Party::query()->count() + 1), 4, '0', STR_PAD_LEFT),
            'name' => trim($validated['name']),
            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? null,
            'address' => $validated['address'] ?? null,
            'credit_limit_paisa' => $limitPaisa,
            'is_active' => true,
        ]);

        AuditLog::record(
            action: 'accounting.party.created',
            description: "Created accounting party {$party->name} ({$party->type}, credit limit ".MoneyPaisa::formatBdt($limitPaisa).').',
            subject: $party,
            metadata: ['entity' => 'party', 'entity_id' => $party->id, 'after' => $party->toArray()],
            userId: $user->id,
        );

        return back()->with('success', "Party '{$party->name}' created.");
    }

    public function updatePartyCreditLimit(Request $request, Party $party): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.settings.manage');

        $validated = $request->validate([
            'credit_limit_bdt' => ['required', 'string', 'regex:/^\d+(?:,\d{3})*(?:\.\d{1,2})?$/'],
        ]);

        $this->partyService->updateCreditLimit($party, MoneyPaisa::fromBdt($validated['credit_limit_bdt']), $user);

        return back()->with('success', "Updated credit limit for {$party->name}.");
    }

    public function partyLedger(Request $request, Party $party): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.reports.view');

        $settings = $this->ensureBootstrapped();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);
        $from = (string) ($request->input('from') ?: CarbonImmutable::today()->subMonths(3)->startOfMonth()->toDateString());
        $to = (string) ($request->input('to') ?: CarbonImmutable::today()->toDateString());

        $ledger = $this->partyService->partyLedger($party, $branchId, $from, $to);

        return Inertia::render('Accounting/PartyLedger', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'party' => [
                'id' => $party->id,
                'code' => $party->code,
                'type' => $party->type,
                'name' => $party->name,
                'phone' => $party->phone,
                'credit_limit_paisa' => (int) $party->credit_limit_paisa,
            ],
            'ledger' => $ledger,
        ]);
    }

    /**
     * Dedicated Bank & Mobile Wallet Book (report_group = 'bank').
     */
    public function bankBook(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.reports.view');

        $settings = $this->ensureBootstrapped();
        $tenantId = $this->tenantContext->id();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);
        $from = (string) ($request->input('from') ?: CarbonImmutable::today()->startOfMonth()->toDateString());
        $to = (string) ($request->input('to') ?: CarbonImmutable::today()->toDateString());

        $bankAccounts = Account::query()
            ->where('report_group', 'bank')
            ->where('is_active', true)
            ->orderBy('code')
            ->get(['id', 'code', 'name_en', 'name_bn', 'report_group']);

        $selectedAccountId = $request->filled('account_id')
            ? (int) $request->input('account_id')
            : ($bankAccounts->first()?->id ?? null);

        $book = $this->simpleService->cashAndBankBook($tenantId, $branchId, $from, $to, $selectedAccountId);
        // Restrict cards strictly to Bank & Wallet accounts (exclude Cash in Hand)
        $book['accounts'] = array_values(array_filter(
            $book['accounts'],
            fn (array $a): bool => $a['report_group'] === 'bank'
        ));

        return Inertia::render('Accounting/BankBook', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'book' => $book,
        ]);
    }

    /**
     * VAT Summary Report (Output VAT, Input VAT, Net VAT Payable/Refundable).
     */
    public function vatSummary(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.reports.view');

        $settings = $this->ensureBootstrapped();
        $tenantId = $this->tenantContext->id();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);
        $from = (string) ($request->input('from') ?: CarbonImmutable::today()->startOfMonth()->toDateString());
        $to = (string) ($request->input('to') ?: CarbonImmutable::today()->toDateString());

        $summary = $this->vatService->summary($tenantId, $branchId, $from, $to);

        return Inertia::render('Accounting/VatSummary', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'summary' => $summary,
        ]);
    }

    /**
     * Auto-Posting Errors Queue & Retry screen.
     */
    public function postingErrors(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.voucher.post');

        $settings = $this->ensureBootstrapped();
        $status = (string) ($request->input('status') ?: 'pending');

        $errors = PostingError::query()
            ->with(['branch:id,name,code', 'resolvedVoucher:id,number'])
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->latest('id')
            ->limit(100)
            ->get()
            ->map(fn (PostingError $e) => [
                'id' => $e->id,
                'source_module' => $e->source_module,
                'source_id' => $e->source_id,
                'source_event' => $e->source_event,
                'branch_name' => $e->branch?->name ?? '—',
                'error' => $e->error,
                'retry_count' => $e->retry_count,
                'status' => $e->status,
                'resolved_voucher_number' => $e->resolvedVoucher?->number,
                'created_at' => $e->created_at?->format('d M Y, h:i A'),
                'last_retried_at' => $e->last_retried_at?->format('d M Y, h:i A'),
            ]);

        return Inertia::render('Accounting/PostingErrors', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'statusFilter' => $status,
            'errorsList' => $errors,
        ]);
    }

    public function retryPostingError(Request $request, PostingError $postingError): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.voucher.post');

        $voucher = $this->poster->retryPostingError($postingError, $user);

        if (! $voucher) {
            return back()->with('error', "Retry failed again: {$postingError->fresh()->error}");
        }

        return back()->with('success', "Auto-posting succeeded -> Voucher {$voucher->number}.");
    }

    public function ignorePostingError(Request $request, PostingError $postingError): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.voucher.post');

        $postingError->forceFill(['status' => PostingError::STATUS_IGNORED])->save();

        AuditLog::record(
            action: 'accounting.posting_error.ignored',
            description: "Marked auto-posting error #{$postingError->id} ({$postingError->source_module}:{$postingError->source_id}) as ignored.",
            subject: $postingError,
            userId: $user->id,
        );

        return back()->with('success', "Posting error #{$postingError->id} marked as ignored.");
    }

    private function ensureBootstrapped(): AccountingSetting
    {
        return AccountingSetting::query()->first()
            ?? $this->bootstrapService->bootstrapForTenant($this->tenantContext->tenant());
    }

    /**
     * @return array<string, mixed>
     */
    private function formatSettings(AccountingSetting $s): array
    {
        return [
            'mode' => $s->mode,
            'coa_template' => $s->coa_template,
            'fiscal_year_start_month' => $s->fiscal_year_start_month,
            'default_currency' => $s->default_currency,
            'vat_enabled' => $s->vat_enabled,
            'vat_rate_bps' => $s->vat_rate_bps,
            'vat_rate_percent' => round($s->vat_rate_bps / 100, 2),
            'approval_threshold_paisa' => (int) $s->approval_threshold_paisa,
            'approval_threshold_bdt' => MoneyPaisa::toDecimalString((int) $s->approval_threshold_paisa),
            'default_cash_account_id' => $s->default_cash_account_id,
            'default_bank_account_id' => $s->default_bank_account_id,
            'default_wallet_account_id' => $s->default_wallet_account_id,
            'default_receivable_account_id' => $s->default_receivable_account_id,
            'default_payable_account_id' => $s->default_payable_account_id,
            'default_inventory_account_id' => $s->default_inventory_account_id,
            'default_cogs_account_id' => $s->default_cogs_account_id,
            'default_sales_account_id' => $s->default_sales_account_id,
            'default_vat_input_account_id' => $s->default_vat_input_account_id,
            'default_vat_output_account_id' => $s->default_vat_output_account_id,
        ];
    }

    /**
     * @return array<string, bool>
     */
    private function permissionFlags($user): array
    {
        return [
            'view' => $this->accessService->hasPermission($user, 'accounting.view'),
            'expense_create' => $this->accessService->hasPermission($user, 'accounting.expense.create'),
            'voucher_create' => $this->accessService->hasPermission($user, 'accounting.voucher.create'),
            'voucher_post' => $this->accessService->hasPermission($user, 'accounting.voucher.post'),
            'voucher_approve' => $this->accessService->hasPermission($user, 'accounting.voucher.approve'),
            'voucher_reverse' => $this->accessService->hasPermission($user, 'accounting.voucher.reverse'),
            'journal_create' => $this->accessService->hasPermission($user, 'accounting.journal.create'),
            'coa_manage' => $this->accessService->hasPermission($user, 'accounting.coa.manage'),
            'period_close' => $this->accessService->hasPermission($user, 'accounting.period.close'),
            'period_reopen' => $this->accessService->hasPermission($user, 'accounting.period.reopen'),
            'reports_view' => $this->accessService->hasPermission($user, 'accounting.reports.view'),
            'settings_manage' => $this->accessService->hasPermission($user, 'accounting.settings.manage'),
            'cost_and_profit_view' => $this->accessService->hasPermission($user, 'accounting.cost_and_profit.view'),
            'all_branches' => $this->accessService->canViewAllBranches($user),
        ];
    }

    /**
     * @return array<int, array{id: int, name: string, code: string}>
     */
    private function availableBranches($user): array
    {
        if ($this->accessService->canViewAllBranches($user)) {
            return Branch::query()
                ->where('is_active', true)
                ->orderByDesc('is_head_office')
                ->orderBy('name')
                ->get(['id', 'name', 'code'])
                ->map(fn (Branch $b) => ['id' => $b->id, 'name' => $b->name, 'code' => $b->code])
                ->all();
        }

        $branchId = $this->accessService->resolveScopedBranchId($user, null);
        $branch = $branchId ? Branch::query()->find($branchId) : null;

        return $branch ? [['id' => $branch->id, 'name' => $branch->name, 'code' => $branch->code]] : [];
    }
}
