<?php

declare(strict_types=1);

namespace App\Modules\Sales\Application\DTO;

final readonly class ProcessPaymentCommand
{
    /**
     * @param  list<array{method: string, amount: string|int|float, reference_number?: ?string}>  $paymentLines
     */
    public function __construct(
        public int $saleId,
        public int $cashierId,
        public string $cashierName,
        public int $counterId,
        public ?int $counterSessionId,
        public array $paymentLines,
        public string $invoiceNumber,
        public string $currencyCode = 'BDT',
    ) {}
}

