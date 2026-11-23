<?php

namespace App\Modules\Billing\Middleware;

use App\Modules\Billing\Exceptions\SubscriptionReadOnlyException;
use App\Modules\Billing\Models\Subscription;
use App\Modules\Billing\Support\SubscriptionState;
use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class EnsureSubscriptionWritable
{
    public function __construct(
        protected TenantContext $tenantContext
    ) {}

    /**
     * Handle an incoming request.
     * Rejects non-GET/HEAD/OPTIONS operations if tenant subscription is in read-only mode.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Safe read methods are always allowed
        if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return $next($request);
        }

        $user = $request->user();
        if ($user?->isSuperAdmin()) {
            return $next($request);
        }

        // Allow-listed route patterns (auth, billing, plan browse, profile password, exports)
        $allowlist = config('billing.readonly_allowlist_routes', []);
        foreach ($allowlist as $pattern) {
            if ($request->routeIs($pattern)) {
                return $next($request);
            }
        }

        $tenant = $this->tenantContext->tenant();
        if (! $tenant) {
            return $next($request);
        }

        // Find latest/current subscription for tenant
        $subscription = Subscription::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->orderByDesc('ends_at')
            ->first();

        if ($subscription) {
            if (! SubscriptionState::isWritable($subscription)) {
                throw new SubscriptionReadOnlyException(
                    message: 'This workspace is currently in read-only mode. Upgrade or renew your subscription to make changes.'
                );
            }

            return $next($request);
        }

        // Fallback for legacy subscriptions (pre-Phase 2 schema)
        $legacySub = $tenant->subscriberSubscription();
        if ($legacySub) {
            if (! $legacySub->isUsable()) {
                throw new SubscriptionReadOnlyException(
                    message: 'This workspace is currently in read-only mode. Upgrade or renew your subscription to make changes.'
                );
            }

            return $next($request);
        }

        // If tenant is marked active or on trial, permit writes
        if ($tenant->status === 'active' || $tenant->isOnTrial()) {
            return $next($request);
        }

        throw new SubscriptionReadOnlyException(
            message: 'This workspace is currently in read-only mode. Upgrade or renew your subscription to make changes.'
        );

        return $next($request);
    }
}
