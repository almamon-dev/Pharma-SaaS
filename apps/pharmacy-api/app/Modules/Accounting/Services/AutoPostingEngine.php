<?php

namespace App\Modules\Accounting\Services;

use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Accounting\Contracts\AccountingPosterInterface;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\AccountingSetting;
use App\Modules\Accounting\Models\PostingError;
use App\Modules\Accounting\Models\Voucher;
use App\Tenancy\CurrentTenant;
use DomainException;
use Throwable;

class AutoPostingEngine implements AccountingPosterInterface
{
    public function __construct(
        private readonly CurrentTenant $currentTenant,
        private readonly VoucherService $voucherService,
    ) {}

    public function postCashSale(string $sourceId, array $payload, ?User $actor = null): ?Voucher
    {
        return $this->executeIdempotent('sales', $sourceId, 'cash_sale', $payload, $actor, function (AccountingSetting $s, array $p): array {
            $netSales = (int) ($p['net_sales_paisa'] ?? 0);
            $vat = (int) ($p['vat_paisa'] ?? 0);
            $gross = $netSales + $vat;
            $cogs = (int) ($p['cogs_paisa'] ?? 0);
            $channel = (string) ($p['payment_channel'] ?? 'cash');

            $lines = [
                ['account_id' => $this->paymentAccountId($s, $channel), 'debit_paisa' => $gross, 'credit_paisa' => 0, 'narration' => $p['narration'] ?? "Cash sale #{$p['reference']}"],
                ['account_id' => $this->reqAccount($s->default_sales_account_id, '4010'), 'debit_paisa' => 0, 'credit_paisa' => $netSales, 'narration' => 'Medicine sales revenue'],
            ];

            if ($vat > 0) {
                $lines[] = [
                    'account_id' => $this->reqAccount($s->default_vat_output_account_id, '2100'),
                    'debit_paisa' => 0,
                    'credit_paisa' => $vat,
                    'vat_type' => 'output',
                    'vat_rate_bps' => (int) ($p['vat_rate_bps'] ?? $s->vat_rate_bps),
                    'vat_amount_paisa' => $vat,
                    'narration' => 'Output VAT on sale',
                ];
            }

            if ($cogs > 0) {
                $lines[] = ['account_id' => $this->reqAccount($s->default_cogs_account_id, '5010'), 'debit_paisa' => $cogs, 'credit_paisa' => 0, 'narration' => 'Cost of goods sold'];
                $lines[] = ['account_id' => $this->reqAccount($s->default_inventory_account_id, '1200'), 'debit_paisa' => 0, 'credit_paisa' => $cogs, 'narration' => 'Inventory reduction'];
            }

            return [
                'type' => 'sales',
                'narration' => $p['narration'] ?? "Cash sale ({$p['reference']})",
                'lines' => $lines,
            ];
        });
    }

    public function postCreditSale(string $sourceId, array $payload, ?User $actor = null): ?Voucher
    {
        return $this->executeIdempotent('sales', $sourceId, 'credit_sale', $payload, $actor, function (AccountingSetting $s, array $p): array {
            $netSales = (int) ($p['net_sales_paisa'] ?? 0);
            $vat = (int) ($p['vat_paisa'] ?? 0);
            $gross = $netSales + $vat;
            $cogs = (int) ($p['cogs_paisa'] ?? 0);
            $partyId = isset($p['party_id']) ? (int) $p['party_id'] : null;

            $lines = [
                ['account_id' => $this->reqAccount($s->default_receivable_account_id, '1100'), 'party_id' => $partyId, 'debit_paisa' => $gross, 'credit_paisa' => 0, 'narration' => $p['narration'] ?? 'Credit sale receivable'],
                ['account_id' => $this->reqAccount($s->default_sales_account_id, '4010'), 'debit_paisa' => 0, 'credit_paisa' => $netSales, 'narration' => 'Credit sales revenue'],
            ];

            if ($vat > 0) {
                $lines[] = [
                    'account_id' => $this->reqAccount($s->default_vat_output_account_id, '2100'),
                    'debit_paisa' => 0,
                    'credit_paisa' => $vat,
                    'vat_type' => 'output',
                    'vat_rate_bps' => (int) ($p['vat_rate_bps'] ?? $s->vat_rate_bps),
                    'vat_amount_paisa' => $vat,
                    'narration' => 'Output VAT on credit sale',
                ];
            }

            if ($cogs > 0) {
                $lines[] = ['account_id' => $this->reqAccount($s->default_cogs_account_id, '5010'), 'debit_paisa' => $cogs, 'credit_paisa' => 0, 'narration' => 'Cost of goods sold'];
                $lines[] = ['account_id' => $this->reqAccount($s->default_inventory_account_id, '1200'), 'debit_paisa' => 0, 'credit_paisa' => $cogs, 'narration' => 'Inventory reduction'];
            }

            return [
                'type' => 'sales',
                'narration' => $p['narration'] ?? "Credit sale ({$p['reference']})",
                'lines' => $lines,
            ];
        });
    }

    public function postCreditPurchase(string $sourceId, array $payload, ?User $actor = null): ?Voucher
    {
        return $this->executeIdempotent('purchasing', $sourceId, 'credit_purchase', $payload, $actor, function (AccountingSetting $s, array $p): array {
            $inventory = (int) ($p['inventory_paisa'] ?? 0);
            $vat = (int) ($p['vat_paisa'] ?? 0);
            $payable = $inventory + $vat;
            $partyId = isset($p['party_id']) ? (int) $p['party_id'] : null;

            $lines = [
                ['account_id' => $this->reqAccount($s->default_inventory_account_id, '1200'), 'debit_paisa' => $inventory, 'credit_paisa' => 0, 'narration' => 'Medicine stock purchase'],
            ];

            if ($vat > 0) {
                $lines[] = [
                    'account_id' => $this->reqAccount($s->default_vat_input_account_id, '1300'),
                    'debit_paisa' => $vat,
                    'credit_paisa' => 0,
                    'vat_type' => 'input',
                    'vat_rate_bps' => (int) ($p['vat_rate_bps'] ?? $s->vat_rate_bps),
                    'vat_amount_paisa' => $vat,
                    'narration' => 'Input VAT on purchase',
                ];
            }

            $lines[] = [
                'account_id' => $this->reqAccount($s->default_payable_account_id, '2010'),
                'party_id' => $partyId,
                'debit_paisa' => 0,
                'credit_paisa' => $payable,
                'narration' => $p['narration'] ?? 'Supplier payable',
            ];

            return [
                'type' => 'purchase',
                'narration' => $p['narration'] ?? "Credit purchase ({$p['reference']})",
                'lines' => $lines,
            ];
        });
    }

    public function postCustomerPayment(string $sourceId, array $payload, ?User $actor = null): ?Voucher
    {
        return $this->executeIdempotent('sales', $sourceId, 'customer_payment', $payload, $actor, function (AccountingSetting $s, array $p): array {
            $amount = (int) ($p['amount_paisa'] ?? 0);
            $channel = (string) ($p['payment_channel'] ?? 'cash');
            $partyId = isset($p['party_id']) ? (int) $p['party_id'] : null;

            return [
                'type' => 'receipt',
                'narration' => $p['narration'] ?? "Customer payment ({$p['reference']})",
                'lines' => [
                    ['account_id' => $this->paymentAccountId($s, $channel), 'debit_paisa' => $amount, 'credit_paisa' => 0, 'narration' => 'Customer collection'],
                    ['account_id' => $this->reqAccount($s->default_receivable_account_id, '1100'), 'party_id' => $partyId, 'debit_paisa' => 0, 'credit_paisa' => $amount, 'narration' => 'Receivable settled'],
                ],
            ];
        });
    }

    public function postSupplierPayment(string $sourceId, array $payload, ?User $actor = null): ?Voucher
    {
        return $this->executeIdempotent('purchasing', $sourceId, 'supplier_payment', $payload, $actor, function (AccountingSetting $s, array $p): array {
            $amount = (int) ($p['amount_paisa'] ?? 0);
            $channel = (string) ($p['payment_channel'] ?? 'bank');
            $partyId = isset($p['party_id']) ? (int) $p['party_id'] : null;

            return [
                'type' => 'payment',
                'narration' => $p['narration'] ?? "Supplier payment ({$p['reference']})",
                'lines' => [
                    ['account_id' => $this->reqAccount($s->default_payable_account_id, '2010'), 'party_id' => $partyId, 'debit_paisa' => $amount, 'credit_paisa' => 0, 'narration' => 'Supplier payable settled'],
                    ['account_id' => $this->paymentAccountId($s, $channel), 'debit_paisa' => 0, 'credit_paisa' => $amount, 'narration' => 'Payment to supplier'],
                ],
            ];
        });
    }

    public function postSalesReturn(string $sourceId, array $payload, ?User $actor = null): ?Voucher
    {
        return $this->executeIdempotent('sales', $sourceId, 'sales_return', $payload, $actor, function (AccountingSetting $s, array $p): array {
            $netReturn = (int) ($p['net_return_paisa'] ?? 0);
            $vat = (int) ($p['vat_paisa'] ?? 0);
            $gross = $netReturn + $vat;
            $cogs = (int) ($p['cogs_paisa'] ?? 0);
            $partyId = isset($p['party_id']) ? (int) $p['party_id'] : null;
            $creditAccount = $partyId
                ? $this->reqAccount($s->default_receivable_account_id, '1100')
                : $this->paymentAccountId($s, (string) ($p['payment_channel'] ?? 'cash'));

            $lines = [
                ['account_id' => $this->reqAccount($s->default_sales_return_account_id, '4030'), 'debit_paisa' => $netReturn, 'credit_paisa' => 0, 'narration' => 'Sales return (contra revenue)'],
            ];

            if ($vat > 0) {
                $lines[] = [
                    'account_id' => $this->reqAccount($s->default_vat_output_account_id, '2100'),
                    'debit_paisa' => $vat,
                    'credit_paisa' => 0,
                    'vat_type' => 'output',
                    'vat_rate_bps' => (int) ($p['vat_rate_bps'] ?? $s->vat_rate_bps),
                    'vat_amount_paisa' => $vat,
                    'narration' => 'Output VAT reversed on return',
                ];
            }

            $lines[] = ['account_id' => $creditAccount, 'party_id' => $partyId, 'debit_paisa' => 0, 'credit_paisa' => $gross, 'narration' => 'Customer credit note / refund'];

            if ($cogs > 0) {
                $lines[] = ['account_id' => $this->reqAccount($s->default_inventory_account_id, '1200'), 'debit_paisa' => $cogs, 'credit_paisa' => 0, 'narration' => 'Returned stock restored'];
                $lines[] = ['account_id' => $this->reqAccount($s->default_cogs_account_id, '5010'), 'debit_paisa' => 0, 'credit_paisa' => $cogs, 'narration' => 'COGS reversed on sales return'];
            }

            return [
                'type' => 'sales_return',
                'narration' => $p['narration'] ?? "Sales return ({$p['reference']})",
                'lines' => $lines,
            ];
        });
    }

    public function postPurchaseReturn(string $sourceId, array $payload, ?User $actor = null): ?Voucher
    {
        return $this->executeIdempotent('purchasing', $sourceId, 'purchase_return', $payload, $actor, function (AccountingSetting $s, array $p): array {
            $inventory = (int) ($p['inventory_paisa'] ?? 0);
            $vat = (int) ($p['vat_paisa'] ?? 0);
            $gross = $inventory + $vat;
            $partyId = isset($p['party_id']) ? (int) $p['party_id'] : null;

            $lines = [
                ['account_id' => $this->reqAccount($s->default_payable_account_id, '2010'), 'party_id' => $partyId, 'debit_paisa' => $gross, 'credit_paisa' => 0, 'narration' => 'Supplier debit note'],
                ['account_id' => $this->reqAccount($s->default_inventory_account_id, '1200'), 'debit_paisa' => 0, 'credit_paisa' => $inventory, 'narration' => 'Inventory returned to supplier'],
            ];

            if ($vat > 0) {
                $lines[] = [
                    'account_id' => $this->reqAccount($s->default_vat_input_account_id, '1300'),
                    'debit_paisa' => 0,
                    'credit_paisa' => $vat,
                    'vat_type' => 'input',
                    'vat_rate_bps' => (int) ($p['vat_rate_bps'] ?? $s->vat_rate_bps),
                    'vat_amount_paisa' => $vat,
                    'narration' => 'Input VAT reversed on purchase return',
                ];
            }

            return [
                'type' => 'purchase_return',
                'narration' => $p['narration'] ?? "Purchase return ({$p['reference']})",
                'lines' => $lines,
            ];
        });
    }

    public function postExpiredOrDamagedWriteOff(string $sourceId, array $payload, ?User $actor = null): ?Voucher
    {
        return $this->executeIdempotent('inventory', $sourceId, 'expired_writeoff', $payload, $actor, function (AccountingSetting $s, array $p): array {
            $cost = (int) ($p['cost_paisa'] ?? 0);

            return [
                'type' => 'stock_adjustment',
                'narration' => $p['narration'] ?? "Expired/damaged stock write-off ({$p['reference']})",
                'lines' => [
                    ['account_id' => $this->reqAccount(null, '5020'), 'debit_paisa' => $cost, 'credit_paisa' => 0, 'narration' => 'Expired & damaged stock loss'],
                    ['account_id' => $this->reqAccount($s->default_inventory_account_id, '1200'), 'debit_paisa' => 0, 'credit_paisa' => $cost, 'narration' => 'Inventory write-off'],
                ],
            ];
        });
    }

    public function postPayroll(string $sourceId, array $payload, ?User $actor = null): ?Voucher
    {
        return $this->executeIdempotent('hr', $sourceId, 'payroll', $payload, $actor, function (AccountingSetting $s, array $p): array {
            $grossSalary = (int) ($p['gross_salary_paisa'] ?? 0);
            $paidNow = (int) ($p['paid_now_paisa'] ?? $grossSalary);
            $payable = $grossSalary - $paidNow;
            $channel = (string) ($p['payment_channel'] ?? 'bank');

            $lines = [
                ['account_id' => $this->reqAccount(null, '6010'), 'debit_paisa' => $grossSalary, 'credit_paisa' => 0, 'narration' => 'Monthly staff salary expense'],
            ];

            if ($paidNow > 0) {
                $lines[] = ['account_id' => $this->paymentAccountId($s, $channel), 'debit_paisa' => 0, 'credit_paisa' => $paidNow, 'narration' => 'Salary disbursed'];
            }
            if ($payable > 0) {
                $lines[] = ['account_id' => $this->reqAccount(null, '2200'), 'debit_paisa' => 0, 'credit_paisa' => $payable, 'narration' => 'Salary payable liability'];
            }

            return [
                'type' => 'payroll',
                'narration' => $p['narration'] ?? "Payroll ({$p['reference']})",
                'lines' => $lines,
            ];
        });
    }

    public function reverseBySource(
        string $sourceModule,
        string $sourceId,
        string $sourceEvent,
        User $actor,
        string $reason,
        ?string $reversalDate = null,
    ): ?Voucher {
        $existing = Voucher::query()
            ->where('source_module', $sourceModule)
            ->where('source_id', $sourceId)
            ->where('source_event', $sourceEvent)
            ->where('status', Voucher::STATUS_POSTED)
            ->first();

        if (! $existing) {
            return null;
        }

        return $this->voucherService->reverse($existing, $actor, $reason, $reversalDate);
    }

    public function retryPostingError(PostingError $error, User $actor): ?Voucher
    {
        $error->forceFill([
            'retry_count' => $error->retry_count + 1,
            'last_retried_at' => now(),
        ])->save();

        $voucher = match ($error->source_event) {
            'cash_sale' => $this->postCashSale($error->source_id, $error->payload, $actor),
            'credit_sale' => $this->postCreditSale($error->source_id, $error->payload, $actor),
            'credit_purchase' => $this->postCreditPurchase($error->source_id, $error->payload, $actor),
            'customer_payment' => $this->postCustomerPayment($error->source_id, $error->payload, $actor),
            'supplier_payment' => $this->postSupplierPayment($error->source_id, $error->payload, $actor),
            'sales_return' => $this->postSalesReturn($error->source_id, $error->payload, $actor),
            'purchase_return' => $this->postPurchaseReturn($error->source_id, $error->payload, $actor),
            'expired_writeoff' => $this->postExpiredOrDamagedWriteOff($error->source_id, $error->payload, $actor),
            'payroll' => $this->postPayroll($error->source_id, $error->payload, $actor),
            default => throw new DomainException("Unknown auto-posting event '{$error->source_event}'."),
        };

        if ($voucher) {
            $error->forceFill([
                'status' => PostingError::STATUS_RESOLVED,
                'resolved_voucher_id' => $voucher->id,
                'resolved_at' => now(),
            ])->save();

            AuditLog::record(
                action: 'accounting.posting_error.resolved',
                description: "Retried and resolved failed auto-posting #{$error->id} ({$error->source_module}:{$error->source_id}) -> {$voucher->number}.",
                subject: $error,
                metadata: ['voucher_id' => $voucher->id, 'voucher_number' => $voucher->number],
                userId: $actor->id,
            );
        }

        return $voucher;
    }

    /**
     * @param  callable(AccountingSetting, array<string, mixed>): array{type: string, narration: string, lines: array<int, array<string, mixed>>}  $builder
     */
    private function executeIdempotent(
        string $sourceModule,
        string $sourceId,
        string $sourceEvent,
        array $payload,
        ?User $actor,
        callable $builder,
    ): ?Voucher {
        $tenantId = $this->currentTenant->id();

        // 1. Idempotency check: never post the same source twice
        $existing = Voucher::query()
            ->where('tenant_id', $tenantId)
            ->where('source_module', $sourceModule)
            ->where('source_id', $sourceId)
            ->where('source_event', $sourceEvent)
            ->first();

        if ($existing) {
            return $existing;
        }

        $payload = array_merge(['reference' => $sourceId], $payload);

        try {
            $settings = AccountingSetting::query()->first();
            if (! $settings) {
                throw new DomainException('Accounting settings are not initialized for this tenant.');
            }

            $spec = $builder($settings, $payload);

            return $this->voucherService->create([
                'branch_id' => (int) ($payload['branch_id'] ?? 0),
                'type' => $spec['type'],
                'date' => (string) ($payload['date'] ?? now()->toDateString()),
                'narration' => $spec['narration'],
                'source_module' => $sourceModule,
                'source_id' => $sourceId,
                'source_event' => $sourceEvent,
                'post_immediately' => true,
                'lines' => $spec['lines'],
            ], $actor);
        } catch (Throwable $e) {
            // Source transaction stays safe; failure is captured for retry in posting_errors
            PostingError::query()->updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'source_module' => $sourceModule,
                    'source_id' => $sourceId,
                    'source_event' => $sourceEvent,
                    'status' => PostingError::STATUS_PENDING,
                ],
                [
                    'branch_id' => isset($payload['branch_id']) ? (int) $payload['branch_id'] : null,
                    'payload' => $payload,
                    'error' => $e->getMessage(),
                ]
            );

            return null;
        }
    }

    private function paymentAccountId(AccountingSetting $settings, string $channel): int
    {
        $id = match ($channel) {
            'bank' => $settings->default_bank_account_id,
            'wallet', 'bkash', 'nagad' => $settings->default_wallet_account_id ?? $settings->default_bank_account_id,
            default => $settings->default_cash_account_id,
        };

        $fallbackCode = match ($channel) {
            'bank' => '1020',
            'wallet', 'bkash', 'nagad' => '1030',
            default => '1010',
        };

        return $this->reqAccount($id, $fallbackCode);
    }

    private function reqAccount(?int $preferredId, string $fallbackCode): int
    {
        if ($preferredId) {
            return $preferredId;
        }

        $id = Account::query()->where('code', $fallbackCode)->value('id');
        if (! $id) {
            throw new DomainException("Required accounting head '{$fallbackCode}' was not found.");
        }

        return (int) $id;
    }
}

