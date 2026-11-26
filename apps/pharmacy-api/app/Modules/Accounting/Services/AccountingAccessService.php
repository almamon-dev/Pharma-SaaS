<?php

namespace App\Modules\Accounting\Services;

use App\Models\Branch;
use App\Models\User;
use App\Modules\Core\Services\AccessService;
use App\Support\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class AccountingAccessService
{
    public function __construct(
        private readonly AccessService $accessService,
        private readonly TenantContext $tenantContext,
    ) {}

    /**
     * Strictly evaluate dynamic permission keys — NEVER check hardcoded role names.
     */
    public function hasPermission(User $user, string $permissionKey): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        if ($this->tenantContext->isOwner()) {
            return true;
        }

        if ($this->accessService->hasPermission($user, $permissionKey)) {
            return true;
        }

        return $this->tenantContext->hasPermission($permissionKey);
    }

    /**
     * @throws AuthorizationException
     */
    public function authorize(User $user, string $permissionKey, string $message = 'You do not have permission for this accounting action.'): void
    {
        if (! $this->hasPermission($user, $permissionKey)) {
            throw new AuthorizationException($message);
        }
    }

    /**
     * Whether user can view/query across all branches of the current tenant.
     */
    public function canViewAllBranches(User $user): bool
    {
        if ($user->isSuperAdmin() || $this->tenantContext->isOwner() || (bool) $user->access_all_branches) {
            return true;
        }

        $tenant = $this->tenantContext->tenant();
        if ($tenant && $user->isOwnerOf($tenant)) {
            return true;
        }

        return $this->accessService->getEffectiveScope($user, 'accounting.view') === 'all'
            && $this->userPrimaryBranchId($user) === null;
    }

    /**
     * Resolve effective branch filter for queries.
     * Branch-scoped users ALWAYS stay locked to their own assigned branch even if they tamper with `?branch_id=`.
     *
     * @return int|null null means "all branches of current tenant" (only allowed for all-branch users)
     */
    public function resolveScopedBranchId(User $user, ?int $requestedBranchId = null): ?int
    {
        if ($this->canViewAllBranches($user)) {
            if ($requestedBranchId !== null) {
                $exists = Branch::query()->whereKey($requestedBranchId)->exists();
                if (! $exists) {
                    throw new AuthorizationException('Requested branch does not belong to your tenant.');
                }

                return $requestedBranchId;
            }

            return null;
        }

        $allowedBranchId = $this->userPrimaryBranchId($user) ?? $this->tenantContext->branchId();
        if ($allowedBranchId === null) {
            throw new AuthorizationException('No branch assignment found for your account.');
        }

        if ($requestedBranchId !== null && $requestedBranchId !== $allowedBranchId) {
            if (! $this->accessService->canAccessBranch($user, $requestedBranchId)) {
                throw new AuthorizationException('You cannot access accounting records of another branch.');
            }

            return $requestedBranchId;
        }

        return $allowedBranchId;
    }

    /**
     * Resolve target branch_id for writing a voucher.
     */
    public function resolveWriteBranchId(User $user, ?int $requestedBranchId = null): int
    {
        $scoped = $this->resolveScopedBranchId($user, $requestedBranchId);
        if ($scoped !== null) {
            return $scoped;
        }

        $fallback = $this->tenantContext->branchId()
            ?? Branch::query()->where('is_active', true)->orderByDesc('is_head_office')->value('id');

        if (! $fallback) {
            throw new AuthorizationException('No active branch found for this tenant.');
        }

        return (int) $fallback;
    }

    private function userPrimaryBranchId(User $user): ?int
    {
        $tenantId = $this->tenantContext->id() ?? $user->current_tenant_id;
        if (! $tenantId) {
            return null;
        }

        $branchId = DB::table('tenant_user')
            ->where('tenant_id', $tenantId)
            ->where('user_id', $user->id)
            ->value('branch_id');

        if ($branchId) {
            return (int) $branchId;
        }

        $assigned = DB::table('user_branches')
            ->where('user_id', $user->id)
            ->value('branch_id');

        return $assigned ? (int) $assigned : null;
    }
}

