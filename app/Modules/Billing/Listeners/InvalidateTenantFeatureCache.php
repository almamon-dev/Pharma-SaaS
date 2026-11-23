<?php

namespace App\Modules\Billing\Listeners;

use App\Models\User;
use App\Modules\Billing\Events\AddonChanged;
use App\Modules\Billing\Events\OverrideChanged;
use App\Modules\Billing\Events\PlanChanged;
use App\Modules\Billing\Events\SubscriptionStatusChanged;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class InvalidateTenantFeatureCache
{
    public function handle(PlanChanged|OverrideChanged|AddonChanged|SubscriptionStatusChanged $event): void
    {
        $tenantId = $event->tenantId;

        // 1. Invalidate Redis / Cache keys
        Cache::forget("tenant:{$tenantId}:features");
        Cache::forget("tenant:{$tenantId}:usage_display");

        // 2. Bump permission_version for all tenant users to invalidate user RBAC sessions
        $userIds = DB::table('tenant_user')
            ->where('tenant_id', $tenantId)
            ->pluck('user_id');

        if ($userIds->isNotEmpty()) {
            User::whereIn('id', $userIds)->increment('permission_version');
        }
    }
}

