<?php

namespace App\Modules\Accounting\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\AccountingSetting;
use App\Modules\Accounting\Models\FiscalPeriod;
use App\Modules\Accounting\Models\FiscalYear;
use App\Modules\Accounting\Models\SimpleCategory;
use App\Modules\Accounting\Models\Voucher;
use App\Modules\Accounting\Services\AccountingAccessService;
use App\Modules\Accounting\Services\AccountingBootstrapService;
use App\Modules\Accounting\Services\FiscalPeriodService;
use App\Modules\Accounting\Services\MoneyPaisa;
use App\Modules\Accounting\Services\SimpleAccountingService;
use App\Modules\Accounting\Services\VoucherService;
use App\Support\TenantContext;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class AccountingPhase1Controller extends Controller
{
    public function __construct(
        private readonly TenantContext $tenantContext,
        private readonly AccountingBootstrapService $bootstrapService,
        private readonly AccountingAccessService $accessService,
        private readonly SimpleAccountingService $simpleService,
        private readonly VoucherService $voucherService,
        private readonly FiscalPeriodService $fiscalPeriodService,
    ) {}

    public function dashboard(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.view');

        $settings = $this->ensureBootstrapped();
        if (
            $settings->mode === 'advanced'
            && ! $request->boolean('simple')
            && $this->accessService->hasPermission($user, 'accounting.reports.view')
        ) {
            return redirect()->route('accounting.overview', $request->only(['branch_id', 'from', 'to', 'period']));
        }

        $tenantId = $this->tenantContext->id();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);
        $canViewProfit = $this->accessService->hasPermission($user, 'accounting.cost_and_profit.view');

        $summary = $this->simpleService->dashboardSummary($tenantId, $branchId, $canViewProfit);

        $categories = SimpleCategory::query()
            ->where('is_active', true)
            ->orderBy('kind')
            ->orderBy('name_en')
            ->get(['id', 'kind', 'code', 'name_en', 'name_bn', 'debit_account_id', 'credit_account_id']);

        $recentVouchers = Voucher::query()
            ->with(['branch:id,name,code', 'lines.account:id,code,name_en,name_bn,type,report_group', 'creator:id,name'])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->whereIn('status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->latest('date')
            ->latest('id')
            ->limit(12)
            ->get()
            ->map(fn (Voucher $v) => $this->formatPlainVoucher($v));

        return Inertia::render('Accounting/SimpleDashboard', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'summary' => $summary,
            'categories' => $categories,
            'recentEntries' => $recentVouchers,
        ]);
    }

    public function storeSimpleEntry(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.expense.create', 'You do not have permission to record income or expense entries.');

        $this->ensureBootstrapped();

        $validated = $request->validate([
            'kind' => ['required', 'in:income,expense'],
            'category_id' => ['required', 'integer'],
            'amount' => ['required', 'string', 'regex:/^\d+(?:,\d{3})*(?:\.\d{1,2})?$/'],
            'payment_channel' => ['required', 'in:cash,bank,wallet'],
            'date' => ['required', 'date'],
            'branch_id' => ['nullable', 'integer'],
            'party_name' => ['nullable', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:300'],
            'receipt' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
        ]);

        try {
            $amountPaisa = MoneyPaisa::fromBdt($validated['amount']);
            $branchId = $this->accessService->resolveWriteBranchId(
                $user,
                isset($validated['branch_id']) ? (int) $validated['branch_id'] : null
            );

            $attachments = [];
            if ($request->hasFile('receipt')) {
                $path = $request->file('receipt')->store("tenants/{$this->tenantContext->id()}/accounting/receipts", 'public');
                $attachments[] = $path;
            }

            $voucher = $this->simpleService->recordSimpleEntry([
                'kind' => $validated['kind'],
                'category_id' => (int) $validated['category_id'],
                'amount_paisa' => $amountPaisa,
                'payment_channel' => $validated['payment_channel'],
                'branch_id' => $branchId,
                'date' => $validated['date'],
                'party_name' => $validated['party_name'] ?? null,
                'note' => $validated['note'] ?? null,
                'attachments' => $attachments ?: null,
            ], $user);

            return back()->with('success', "Saved {$voucher->number} (".MoneyPaisa::formatBdt($amountPaisa).').');
        } catch (DomainException|\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function storeSimpleCategory(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.coa.manage');
        $settings = $this->ensureBootstrapped();

        $validated = $request->validate([
            'kind' => ['required', 'in:income,expense'],
            'name_en' => ['required', 'string', 'max:120'],
            'name_bn' => ['required', 'string', 'max:120'],
            'account_id' => ['required', 'integer'],
        ]);

        $account = Account::query()->where('is_active', true)->findOrFail($validated['account_id']);
        $code = Str::slug($validated['name_en'], '_').'_'.substr((string) time(), -4);

        $cat = SimpleCategory::query()->create([
            'kind' => $validated['kind'],
            'code' => $code,
            'name_en' => trim($validated['name_en']),
            'name_bn' => trim($validated['name_bn']),
            'debit_account_id' => $validated['kind'] === 'expense' ? $account->id : $settings->default_cash_account_id,
            'credit_account_id' => $validated['kind'] === 'income' ? $account->id : $settings->default_cash_account_id,
            'is_system' => false,
            'is_active' => true,
        ]);

        AuditLog::record(
            action: 'accounting.category.created',
            description: "Added simple {$cat->kind} category '{$cat->name_en}' mapped to account {$account->code}.",
            subject: $cat,
            metadata: ['entity' => 'simple_category', 'entity_id' => $cat->id, 'after' => $cat->toArray()],
            userId: $user->id,
        );

        return back()->with('success', "Category '{$cat->name_en}' added.");
    }

    public function dayBook(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.reports.view');

        $settings = $this->ensureBootstrapped();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);

        $from = (string) ($request->input('from') ?: CarbonImmutable::today()->startOfMonth()->toDateString());
        $to = (string) ($request->input('to') ?: CarbonImmutable::today()->toDateString());
        $type = $request->filled('type') ? (string) $request->input('type') : null;

        $vouchers = Voucher::query()
            ->with(['branch:id,name,code', 'lines.account:id,code,name_en,name_bn,type,report_group', 'creator:id,name', 'reversedVoucher:id,number', 'reversalOf:id,number'])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->when($type !== null, fn ($q) => $q->where('type', $type))
            ->whereIn('status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        $totalIn = 0;
        $totalOut = 0;
        $formatted = $vouchers->map(function (Voucher $v) use (&$totalIn, &$totalOut): array {
            $item = $this->formatPlainVoucher($v);
            if ($v->status === Voucher::STATUS_POSTED) {
                if ($item['direction'] === 'in') {
                    $totalIn += $item['amount_paisa'];
                } elseif ($item['direction'] === 'out') {
                    $totalOut += $item['amount_paisa'];
                }
            }

            return $item;
        })->values();

        return Inertia::render('Accounting/DayBook', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'filters' => [
                'from' => $from,
                'to' => $to,
                'type' => $type ?? '',
            ],
            'totals' => [
                'in_paisa' => $totalIn,
                'out_paisa' => $totalOut,
                'net_paisa' => $totalIn - $totalOut,
                'count' => $formatted->count(),
            ],
            'entries' => $formatted,
        ]);
    }

    public function cashBook(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.reports.view');

        $settings = $this->ensureBootstrapped();
        $tenantId = $this->tenantContext->id();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);

        $from = (string) ($request->input('from') ?: CarbonImmutable::today()->startOfMonth()->toDateString());
        $to = (string) ($request->input('to') ?: CarbonImmutable::today()->toDateString());
        $accountId = $request->filled('account_id') ? (int) $request->input('account_id') : null;

        $book = $this->simpleService->cashAndBankBook($tenantId, $branchId, $from, $to, $accountId);

        return Inertia::render('Accounting/CashBook', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'book' => $book,
        ]);
    }

    public function simpleProfitAndLoss(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.reports.view');

        $settings = $this->ensureBootstrapped();
        $tenantId = $this->tenantContext->id();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);
        $canViewProfit = $this->accessService->hasPermission($user, 'accounting.cost_and_profit.view');

        $from = (string) ($request->input('from') ?: CarbonImmutable::today()->startOfMonth()->toDateString());
        $to = (string) ($request->input('to') ?: CarbonImmutable::today()->endOfMonth()->toDateString());

        $report = $this->simpleService->simpleProfitAndLoss($tenantId, $branchId, $from, $to, $canViewProfit);

        return Inertia::render('Accounting/SimpleProfitLoss', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'report' => $report,
        ]);
    }

    public function accounts(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.view');

        $settings = $this->ensureBootstrapped();

        $accounts = Account::query()
            ->withCount('voucherLines')
            ->orderBy('code')
            ->get()
            ->map(fn (Account $a) => [
                'id' => $a->id,
                'parent_id' => $a->parent_id,
                'code' => $a->code,
                'name_en' => $a->name_en,
                'name_bn' => $a->name_bn,
                'type' => $a->type,
                'report_group' => $a->report_group,
                'is_contra' => $a->is_contra,
                'is_system' => $a->is_system,
                'is_active' => $a->is_active,
                'has_entries' => $a->voucher_lines_count > 0,
            ]);

        return Inertia::render('Accounting/ChartOfAccounts', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'accounts' => $accounts,
            'reportGroups' => Account::REPORT_GROUPS,
        ]);
    }

    public function storeAccount(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.coa.manage');
        $this->ensureBootstrapped();

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:32'],
            'name_en' => ['required', 'string', 'max:160'],
            'name_bn' => ['required', 'string', 'max:160'],
            'type' => ['required', 'in:'.implode(',', Account::TYPES)],
            'report_group' => ['required', 'in:'.implode(',', Account::REPORT_GROUPS)],
            'parent_id' => ['nullable', 'integer'],
            'is_contra' => ['nullable', 'boolean'],
        ]);

        if (Account::query()->where('code', trim($validated['code']))->exists()) {
            return back()->with('error', "Account code '{$validated['code']}' already exists.");
        }

        $account = Account::query()->create([
            'parent_id' => $validated['parent_id'] ?? null,
            'code' => trim($validated['code']),
            'name_en' => trim($validated['name_en']),
            'name_bn' => trim($validated['name_bn']),
            'type' => $validated['type'],
            'report_group' => $validated['report_group'],
            'is_contra' => (bool) ($validated['is_contra'] ?? false),
            'is_system' => false,
            'is_active' => true,
        ]);

        AuditLog::record(
            action: 'accounting.account.created',
            description: "Created account {$account->code} - {$account->name_en} ({$account->report_group}).",
            subject: $account,
            metadata: ['entity' => 'account', 'entity_id' => $account->id, 'before' => null, 'after' => $account->toArray()],
            userId: $user->id,
        );

        return back()->with('success', "Account {$account->code} ({$account->name_en}) created.");
    }

    public function toggleAccount(Request $request, Account $account): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.coa.manage');

        if ($account->is_system && $account->is_active) {
            return back()->with('error', 'System accounts cannot be deactivated.');
        }

        $before = ['is_active' => $account->is_active];
        $account->forceFill(['is_active' => ! $account->is_active])->save();

        AuditLog::record(
            action: 'accounting.account.toggled',
            description: ($account->is_active ? 'Activated' : 'Deactivated')." account {$account->code} - {$account->name_en}.",
            subject: $account,
            metadata: ['entity' => 'account', 'entity_id' => $account->id, 'before' => $before, 'after' => ['is_active' => $account->is_active]],
            userId: $user->id,
        );

        return back()->with('success', "Account {$account->code} ".($account->is_active ? 'activated.' : 'deactivated.'));
    }

    public function destroyAccount(Request $request, Account $account): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.coa.manage');

        try {
            $snapshot = $account->toArray();
            $account->delete();

            AuditLog::record(
                action: 'accounting.account.deleted',
                description: "Deleted unused account {$snapshot['code']} - {$snapshot['name_en']}.",
                metadata: ['entity' => 'account', 'entity_id' => $snapshot['id'], 'before' => $snapshot, 'after' => null],
                userId: $user->id,
            );

            return back()->with('success', "Account {$snapshot['code']} deleted.");
        } catch (DomainException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function periods(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.view');

        $settings = $this->ensureBootstrapped();

        $fiscalYears = FiscalYear::query()
            ->with(['periods.closedByUser:id,name', 'periods.reopenedByUser:id,name'])
            ->orderByDesc('start_date')
            ->get()
            ->map(fn (FiscalYear $fy) => [
                'id' => $fy->id,
                'name' => $fy->name,
                'start_date' => $fy->start_date->toDateString(),
                'end_date' => $fy->end_date->toDateString(),
                'status' => $fy->status,
                'periods' => $fy->periods->map(fn (FiscalPeriod $p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'period_number' => $p->period_number,
                    'start_date' => $p->start_date->toDateString(),
                    'end_date' => $p->end_date->toDateString(),
                    'status' => $p->status,
                    'closed_at' => $p->closed_at?->format('d M Y, h:i A'),
                    'closed_by' => $p->closedByUser?->name,
                    'reopened_at' => $p->reopened_at?->format('d M Y, h:i A'),
                    'reopened_by' => $p->reopenedByUser?->name,
                ])->values(),
            ]);

        return Inertia::render('Accounting/FiscalPeriods', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'fiscalYears' => $fiscalYears,
        ]);
    }

    public function closePeriod(Request $request, FiscalPeriod $period): RedirectResponse
    {
        try {
            $this->fiscalPeriodService->closePeriod($period, $request->user());

            return back()->with('success', "Fiscal period {$period->name} closed.");
        } catch (DomainException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function reopenPeriod(Request $request, FiscalPeriod $period): RedirectResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:4', 'max:255'],
        ]);

        try {
            $this->fiscalPeriodService->reopenPeriod($period, $request->user(), $validated['reason']);

            return back()->with('success', "Fiscal period {$period->name} reopened and audit-logged.");
        } catch (DomainException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function reverseVoucher(Request $request, Voucher $voucher): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.voucher.reverse', 'You do not have permission to reverse vouchers.');

        // Enforce branch access before reversing
        $this->accessService->resolveScopedBranchId($user, (int) $voucher->branch_id);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:4', 'max:300'],
            'date' => ['nullable', 'date'],
        ]);

        try {
            $reversal = $this->voucherService->reverse(
                $voucher,
                $user,
                $validated['reason'],
                $validated['date'] ?? null
            );

            return back()->with('success', "Voucher {$voucher->number} reversed via {$reversal->number}.");
        } catch (DomainException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function settings(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.view');

        $settings = $this->ensureBootstrapped();
        $accounts = Account::query()
            ->where('is_active', true)
            ->orderBy('code')
            ->get(['id', 'code', 'name_en', 'name_bn', 'type', 'report_group']);

        return Inertia::render('Accounting/Settings', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'accounts' => $accounts,
        ]);
    }

    public function updateSettings(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.settings.manage', 'You do not have permission to update accounting settings.');

        $settings = $this->ensureBootstrapped();

        $validated = $request->validate([
            'mode' => ['required', 'in:simple,advanced'],
            'fiscal_year_start_month' => ['required', 'integer', 'min:1', 'max:12'],
            'vat_enabled' => ['required', 'boolean'],
            'vat_rate_percent' => ['nullable', 'numeric', 'min:0', 'max:50'],
            'approval_threshold_bdt' => ['nullable', 'string', 'regex:/^\d+(?:,\d{3})*(?:\.\d{1,2})?$/'],
            'default_cash_account_id' => ['nullable', 'integer'],
            'default_bank_account_id' => ['nullable', 'integer'],
            'default_wallet_account_id' => ['nullable', 'integer'],
            'default_receivable_account_id' => ['nullable', 'integer'],
            'default_payable_account_id' => ['nullable', 'integer'],
            'default_inventory_account_id' => ['nullable', 'integer'],
            'default_cogs_account_id' => ['nullable', 'integer'],
            'default_sales_account_id' => ['nullable', 'integer'],
            'default_vat_input_account_id' => ['nullable', 'integer'],
            'default_vat_output_account_id' => ['nullable', 'integer'],
        ]);

        $before = $this->formatSettings($settings);

        $vatRateBps = isset($validated['vat_rate_percent'])
            ? (int) round(((float) $validated['vat_rate_percent']) * 100)
            : $settings->vat_rate_bps;

        $thresholdPaisa = isset($validated['approval_threshold_bdt']) && $validated['approval_threshold_bdt'] !== ''
            ? MoneyPaisa::fromBdt($validated['approval_threshold_bdt'])
            : 0;

        $settings->forceFill([
            'mode' => $validated['mode'],
            'fiscal_year_start_month' => (int) $validated['fiscal_year_start_month'],
            'vat_enabled' => (bool) $validated['vat_enabled'],
            'vat_rate_bps' => $vatRateBps,
            'approval_threshold_paisa' => $thresholdPaisa,
            'default_cash_account_id' => $validated['default_cash_account_id'] ?? $settings->default_cash_account_id,
            'default_bank_account_id' => $validated['default_bank_account_id'] ?? $settings->default_bank_account_id,
            'default_wallet_account_id' => $validated['default_wallet_account_id'] ?? $settings->default_wallet_account_id,
            'default_receivable_account_id' => $validated['default_receivable_account_id'] ?? $settings->default_receivable_account_id,
            'default_payable_account_id' => $validated['default_payable_account_id'] ?? $settings->default_payable_account_id,
            'default_inventory_account_id' => $validated['default_inventory_account_id'] ?? $settings->default_inventory_account_id,
            'default_cogs_account_id' => $validated['default_cogs_account_id'] ?? $settings->default_cogs_account_id,
            'default_sales_account_id' => $validated['default_sales_account_id'] ?? $settings->default_sales_account_id,
            'default_vat_input_account_id' => $validated['default_vat_input_account_id'] ?? $settings->default_vat_input_account_id,
            'default_vat_output_account_id' => $validated['default_vat_output_account_id'] ?? $settings->default_vat_output_account_id,
        ])->save();

        AuditLog::record(
            action: 'accounting.settings.updated',
            description: "Updated accounting settings (mode: {$settings->mode}, VAT: ".($settings->vat_enabled ? ($settings->vat_rate_bps / 100).'%' : 'Off').').',
            subject: $settings,
            metadata: [
                'entity' => 'accounting_settings',
                'entity_id' => $settings->id,
                'before' => $before,
                'after' => $this->formatSettings($settings),
            ],
            userId: $user->id,
        );

        return back()->with('success', 'Accounting settings updated.');
    }

    private function ensureBootstrapped(): AccountingSetting
    {
        $existing = AccountingSetting::query()->first();
        if ($existing) {
            return $existing;
        }

        return $this->bootstrapService->bootstrapForTenant($this->tenantContext->tenant());
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

    /**
     * Format a voucher in plain language (for Simple Mode) while keeping structured double-entry lines for Advanced Mode.
     *
     * @return array<string, mixed>
     */
    private function formatPlainVoucher(Voucher $v): array
    {
        $direction = match ($v->type) {
            'receipt', 'sales' => 'in',
            'payment', 'purchase', 'payroll' => 'out',
            default => 'transfer',
        };

        $paymentChannel = 'Cash';
        $primaryCategoryEn = ucfirst(str_replace('_', ' ', $v->type));
        $primaryCategoryBn = $primaryCategoryEn;

        foreach ($v->lines as $line) {
            $acc = $line->account;
            if (! $acc) {
                continue;
            }
            if (in_array($acc->report_group, ['cash', 'bank'], true)) {
                $paymentChannel = $acc->name_en;
            } else {
                $primaryCategoryEn = $acc->name_en;
                $primaryCategoryBn = $acc->name_bn;
            }
        }

        return [
            'id' => $v->id,
            'number' => $v->number,
            'type' => $v->type,
            'date' => $v->date->toDateString(),
            'status' => $v->status,
            'direction' => $direction,
            'amount_paisa' => (int) $v->total_debit_paisa,
            'category_en' => $primaryCategoryEn,
            'category_bn' => $primaryCategoryBn,
            'payment_method' => $paymentChannel,
            'narration' => $v->narration,
            'branch_name' => $v->branch?->name ?? 'Branch',
            'branch_code' => $v->branch?->code ?? '',
            'created_by' => $v->creator?->name ?? 'System',
            'is_reversal' => $v->reversal_of_voucher_id !== null,
            'reversed_by_number' => $v->reversedVoucher?->number,
            'reversal_of_number' => $v->reversalOf?->number,
            'lines' => $v->lines->map(fn ($l) => [
                'id' => $l->id,
                'account_code' => $l->account?->code,
                'account_name_en' => $l->account?->name_en,
                'account_name_bn' => $l->account?->name_bn,
                'debit_paisa' => (int) $l->debit_paisa,
                'credit_paisa' => (int) $l->credit_paisa,
                'narration' => $l->narration,
            ])->values()->all(),
        ];
    }
}

