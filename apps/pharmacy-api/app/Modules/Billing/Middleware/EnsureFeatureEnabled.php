<?php

namespace App\Modules\Billing\Middleware;

use App\Modules\Billing\Exceptions\FeatureLockedException;
use App\Modules\Billing\Services\FeatureManager;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureFeatureEnabled
{
    public function __construct(
        protected FeatureManager $featureManager
    ) {}

    /**
     * Handle an incoming request.
     *
     * Usage in routes:
     *   ->middleware('feature:batch_expiry')
     *   ->middleware('feature:accounts_level,full')
     */
    public function handle(Request $request, Closure $next, string $featureKey, ?string $requiredLevel = null): Response
    {
        $user = $request->user();

        // Platform Super Admin bypasses tenant plan gating
        if ($user?->isSuperAdmin()) {
            return $next($request);
        }

        $tenant = app(\App\Support\TenantContext::class)->tenant();
        $hasPhase2Sub = $tenant ? \App\Modules\Billing\Models\Subscription::withoutGlobalScopes()->where('tenant_id', $tenant->id)->exists() : false;

        // In Phase 2 plans, team and branches are core features gated by quantitative limits (max_users, max_branches)
        if ($hasPhase2Sub && in_array($featureKey, ['team_rbac', 'branches'], true)) {
            return $next($request);
        }

        // If level check
        if ($requiredLevel !== null) {
            $currentLevel = $this->featureManager->level($featureKey);

            $levelHierarchy = [
                'report_level' => ['basic' => 1, 'detailed' => 2, 'advanced' => 3],
                'accounts_level' => ['basic' => 1, 'full' => 2],
            ];

            $hierarchy = $levelHierarchy[$featureKey] ?? null;
            if ($hierarchy) {
                $requiredRank = $hierarchy[$requiredLevel] ?? 1;
                $currentRank = $hierarchy[$currentLevel ?? 'basic'] ?? 0;

                if ($currentRank < $requiredRank) {
                    throw new FeatureLockedException(
                        $featureKey,
                        "This section requires '{$requiredLevel}' level access for '{$featureKey}' (current: {$currentLevel})."
                    );
                }
            } elseif ($currentLevel !== $requiredLevel) {
                throw new FeatureLockedException($featureKey);
            }

            return $next($request);
        }

        // Boolean feature check
        if (! $this->featureManager->can($featureKey)) {
            throw new FeatureLockedException($featureKey);
        }

        return $next($request);
    }
}
