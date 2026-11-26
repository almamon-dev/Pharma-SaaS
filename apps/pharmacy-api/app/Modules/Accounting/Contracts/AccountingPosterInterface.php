<?php

namespace App\Modules\Accounting\Contracts;

use App\Models\User;
use App\Modules\Accounting\Models\PostingError;
use App\Modules\Accounting\Models\Voucher;

/**
 * Clean internal interface for other modules (Sales, Purchasing, Inventory, HR)
 * to post accounting entries without knowing Chart of Accounts or debit/credit rules.
 *
 * Every method is idempotent per (tenant_id, source_module, source_id, source_event)
 * and captures failures into posting_errors so source transactions never fail.
 */
interface AccountingPosterInterface
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function postCashSale(string $sourceId, array $payload, ?User $actor = null): ?Voucher;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function postCreditSale(string $sourceId, array $payload, ?User $actor = null): ?Voucher;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function postCreditPurchase(string $sourceId, array $payload, ?User $actor = null): ?Voucher;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function postCustomerPayment(string $sourceId, array $payload, ?User $actor = null): ?Voucher;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function postSupplierPayment(string $sourceId, array $payload, ?User $actor = null): ?Voucher;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function postSalesReturn(string $sourceId, array $payload, ?User $actor = null): ?Voucher;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function postPurchaseReturn(string $sourceId, array $payload, ?User $actor = null): ?Voucher;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function postExpiredOrDamagedWriteOff(string $sourceId, array $payload, ?User $actor = null): ?Voucher;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function postPayroll(string $sourceId, array $payload, ?User $actor = null): ?Voucher;

    public function reverseBySource(
        string $sourceModule,
        string $sourceId,
        string $sourceEvent,
        User $actor,
        string $reason,
        ?string $reversalDate = null,
    ): ?Voucher;

    public function retryPostingError(PostingError $error, User $actor): ?Voucher;
}

