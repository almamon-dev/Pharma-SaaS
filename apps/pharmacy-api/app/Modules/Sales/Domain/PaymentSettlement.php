<?php

declare(strict_types=1);

namespace App\Modules\Sales\Domain;

use PharmaCore\Foundation\Domain\Money;

/**
 * Pure domain settlement calculator using exact integer minor units (Money VO).
 */
final readonly class PaymentSettlement
{
    /**
     * @param  list<array{method: string, amount: float, reference_number: ?string}>  $normalizedLines
     */
    private function __construct(
        public array $normalizedLines,
        public Money $totalAmount,
        public Money $totalPaid,
        public Money $dueAmount,
        public Money $changeAmount,
        public Money $netCashForDrawer,
        public string $paymentStatus,
        public string $primaryMethodLabel,
        public int $loyaltyPointsEarned,
    ) {}

    /**
     * @param  list<array{method: string, amount: string|int|float, reference_number?: ?string}>  $lines
     */
    public static function settle(
        string|int|float $orderTotal,
        array $lines,
        string $currency = 'BDT',
    ): self {
        $totalMoney = Money::fromDecimal($orderTotal, $currency);
        $normalized = [];
        $totalPaid = Money::zero($currency);
        $cashTendered = Money::zero($currency);
        $methods = [];

        foreach ($lines as $line) {
            $amt = Money::fromDecimal($line['amount'] ?? 0, $currency);
            if (! $amt->isPositive()) {
                continue;
            }

            $method = strtolower(trim((string) ($line['method'] ?? 'cash')));
            $ref = isset($line['reference_number']) && trim((string) $line['reference_number']) !== ''
                ? trim((string) $line['reference_number'])
                : null;

            $normalized[] = [
                'method' => $method,
                'amount' => $amt->toFloat(),
                'reference_number' => $ref,
            ];

            $totalPaid = $totalPaid->add($amt);
            if ($method === 'cash') {
                $cashTendered = $cashTendered->add($amt);
            }
            $methods[] = ucfirst($method);
        }

        if ($normalized === []) {
            throw SalesProblem::missingPayments();
        }

        $dueMinor = max(0, $totalMoney->minorUnits - $totalPaid->minorUnits);
        $changeMinor = max(0, $totalPaid->minorUnits - $totalMoney->minorUnits);
        $netCashMinor = max(0, $cashTendered->minorUnits - $changeMinor);

        $dueMoney = Money::fromMinorUnits($dueMinor, $currency);
        $changeMoney = Money::fromMinorUnits($changeMinor, $currency);
        $netCashMoney = Money::fromMinorUnits($netCashMinor, $currency);

        $status = $dueMinor <= 0 ? 'paid' : ($totalPaid->isPositive() ? 'partially_paid' : 'due');
        $primaryMethod = implode(' + ', array_unique($methods));
        $loyaltyPoints = (int) intdiv(max(0, $totalMoney->minorUnits), 10000); // 1 point per 100.00

        return new self(
            normalizedLines: $normalized,
            totalAmount: $totalMoney,
            totalPaid: $totalPaid,
            dueAmount: $dueMoney,
            changeAmount: $changeMoney,
            netCashForDrawer: $netCashMoney,
            paymentStatus: $status,
            primaryMethodLabel: $primaryMethod,
            loyaltyPointsEarned: $loyaltyPoints,
        );
    }
}

