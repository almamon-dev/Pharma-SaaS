<?php

namespace App\Modules\Accounting\Services;

use Closure;
use Illuminate\Support\Facades\Cache;

class AccountingCacheService
{
    public const OVERVIEW_TTL_SECONDS = 60;

    public function versionKey(int $tenantId): string
    {
        return "accounting:overview:ver:t{$tenantId}";
    }

    public function currentVersion(int $tenantId): int
    {
        return (int) Cache::get($this->versionKey($tenantId), 1);
    }

    public function invalidateTenant(int $tenantId): void
    {
        $key = $this->versionKey($tenantId);
        $next = $this->currentVersion($tenantId) + 1;
        Cache::forever($key, $next);
    }

    /**
     * Cache overview payload for 60 seconds per tenant + filter signature + version.
     *
     * @template T
     * @param  Closure(): T  $resolver
     * @return T
     */
    public function rememberOverview(
        int $tenantId,
        ?int $branchId,
        string $from,
        string $to,
        bool $canViewProfit,
        Closure $resolver,
    ): mixed {
        $ver = $this->currentVersion($tenantId);
        $b = $branchId === null ? 'all' : (string) $branchId;
        $p = $canViewProfit ? '1' : '0';
        $cacheKey = "accounting:overview:t{$tenantId}:v{$ver}:b{$b}:{$from}:{$to}:p{$p}";

        return Cache::remember($cacheKey, self::OVERVIEW_TTL_SECONDS, $resolver);
    }
}

