<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Read-Only Mode Allowed Routes
    |--------------------------------------------------------------------------
    |
    | When a pharmacy's subscription status is 'read_only', 'archived',
    | 'pending_delete', or 'cancelled', non-GET requests are rejected by
    | EnsureSubscriptionWritable unless the route name matches this pattern.
    |
    */
    'readonly_allowlist_routes' => [
        'login',
        'logout',
        'password.*',
        'billing.*',
        'plans.*',
        'subscription.*',
        'settings.profile*',
        'export.*',
        'catalog.exports.*',
        'catalog.exports',
        'payments.*',
        'demo_roles.*',
    ],

    /*
    |--------------------------------------------------------------------------
    | Resource Mapping & Limit Counters
    |--------------------------------------------------------------------------
    |
    | Define whether each resource is a total count (queried live from tables)
    | or a monthly counter (tracked in usage_counters table).
    |
    */
    'resources' => [
        'max_users' => [
            'type' => 'total',
            'model' => \App\Models\User::class,
            'feature' => 'max_users',
        ],
        'max_branches' => [
            'type' => 'total',
            'model' => \App\Models\Branch::class,
            'feature' => 'max_branches',
        ],
        'max_products' => [
            'type' => 'total',
            'model' => \App\Models\Medicine::class,
            'feature' => 'max_products',
        ],
        'max_bills_month' => [
            'type' => 'monthly',
            'feature' => 'max_bills_month',
        ],
        'sms_quota_month' => [
            'type' => 'monthly',
            'feature' => 'sms_quota_month',
        ],
    ],
];

