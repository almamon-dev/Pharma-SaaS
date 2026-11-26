<?php

declare(strict_types=1);

namespace App\Modules\Sales\Domain;

/**
 * Pure domain policy determining role discount ceilings and approval status.
 */
final class DiscountApprovalPolicy
{
    /**
     * @param  list<string>  $roles
     * @param  array<string, mixed>  $configuredLimits
     */
    public function permittedLimitPercent(
        bool $isOwnerOrAdmin,
        array $roles,
        array $configuredLimits = [],
    ): float {
        if ($isOwnerOrAdmin || in_array('admin', $roles, true)) {
            return 100.0;
        }

        if (in_array('manager', $roles, true)) {
            return (float) ($configuredLimits['manager'] ?? 15.0);
        }

        if (in_array('senior_salesman', $roles, true)) {
            return (float) ($configuredLimits['senior_salesman'] ?? 5.0);
        }

        return (float) ($configuredLimits['salesman'] ?? 2.0);
    }

    /**
     * Determine whether a requested discount requires manager approval.
     *
     * @param  list<string>  $roles
     */
    public function resolveDiscountStatus(
        float $discountAmount,
        float $effectivePercentage,
        float $permittedLimitPercent,
        bool $isOwnerOrAdmin,
        array $roles,
    ): string {
        if ($discountAmount <= 0.0) {
            return 'none';
        }

        $isManagerOrAdmin = $isOwnerOrAdmin
            || in_array('admin', $roles, true)
            || in_array('manager', $roles, true);

        if ($effectivePercentage <= ($permittedLimitPercent + 0.01) || $isManagerOrAdmin) {
            return 'approved';
        }

        return 'pending_approval';
    }
}

