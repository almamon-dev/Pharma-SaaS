<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Create View tenant_effective_features
        $viewSql = <<<SQL
CREATE VIEW tenant_effective_features AS
WITH ranked_subscriptions AS (
    SELECT 
        s.id AS subscription_id,
        s.tenant_id,
        s.plan_id,
        s.billing_cycle,
        s.status AS subscription_status,
        s.starts_at,
        s.ends_at,
        s.trial_ends_at,
        s.grace_until,
        s.read_only_since,
        ROW_NUMBER() OVER (
            PARTITION BY s.tenant_id 
            ORDER BY s.ends_at DESC, s.id DESC
        ) AS rn
    FROM subscriptions s
),
current_subscriptions AS (
    SELECT * FROM ranked_subscriptions WHERE rn = 1
),
active_addons AS (
    SELECT 
        ta.tenant_id,
        a.feature_key,
        SUM(ta.quantity * a.extra_limit) AS extra_limit
    FROM tenant_addons ta
    JOIN addons a ON a.id = ta.addon_id
    WHERE a.is_active = true
      AND (ta.ends_at IS NULL OR ta.ends_at > CURRENT_TIMESTAMP)
    GROUP BY ta.tenant_id, a.feature_key
)
SELECT 
    cs.tenant_id,
    cs.subscription_id,
    cs.plan_id,
    p.code AS plan_code,
    p.name AS plan_name,
    cs.subscription_status,
    cs.billing_cycle,
    cs.starts_at AS subscription_starts_at,
    cs.ends_at AS subscription_ends_at,
    f.key AS feature_key,
    f.type AS feature_type,
    f.group_name,
    COALESCE(ov.bool_value, pf.bool_value, false) AS bool_value,
    CASE 
        WHEN ov.limit_value IS NOT NULL THEN (ov.limit_value + COALESCE(aa.extra_limit, 0))
        WHEN pf.limit_value IS NOT NULL THEN (pf.limit_value + COALESCE(aa.extra_limit, 0))
        ELSE NULL 
    END AS limit_value,
    COALESCE(ov.level_value, pf.level_value) AS level_value,
    (CASE WHEN ov.feature_key IS NOT NULL THEN true ELSE false END) AS is_overridden,
    ov.expires_at AS override_expires_at,
    ov.note AS override_note,
    COALESCE(aa.extra_limit, 0) AS addon_extra_limit
FROM current_subscriptions cs
JOIN plans p ON p.id = cs.plan_id
JOIN plan_features pf ON pf.plan_id = cs.plan_id
JOIN features f ON f.key = pf.feature_key
LEFT JOIN tenant_overrides ov ON ov.tenant_id = cs.tenant_id 
    AND ov.feature_key = f.key 
    AND (ov.expires_at IS NULL OR ov.expires_at > CURRENT_TIMESTAMP)
LEFT JOIN active_addons aa ON aa.tenant_id = cs.tenant_id 
    AND aa.feature_key = f.key;
SQL;

        DB::statement($viewSql);

        // 2. PostgreSQL RLS on Tenant-owned Tables
        if (DB::getDriverName() === 'pgsql') {
            $tenantTables = [
                'subscriptions',
                'subscription_events',
                'tenant_overrides',
                'tenant_addons',
                'usage_counters',
            ];

            foreach ($tenantTables as $table) {
                DB::statement("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY;");
                DB::statement("ALTER TABLE {$table} FORCE ROW LEVEL SECURITY;");
                DB::statement("
                    CREATE POLICY {$table}_tenant_isolation ON {$table}
                    FOR ALL
                    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::bigint);
                ");
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            $tenantTables = [
                'subscriptions',
                'subscription_events',
                'tenant_overrides',
                'tenant_addons',
                'usage_counters',
            ];

            foreach ($tenantTables as $table) {
                DB::statement("DROP POLICY IF EXISTS {$table}_tenant_isolation ON {$table};");
                DB::statement("ALTER TABLE {$table} NO FORCE ROW LEVEL SECURITY;");
                DB::statement("ALTER TABLE {$table} DISABLE ROW LEVEL SECURITY;");
            }
        }

        DB::statement('DROP VIEW IF EXISTS tenant_effective_features;');
    }
};

