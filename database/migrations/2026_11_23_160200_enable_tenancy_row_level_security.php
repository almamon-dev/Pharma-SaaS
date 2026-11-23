<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tenant-owned business tables protected by PostgreSQL Row Level Security (RLS).
     */
    protected array $tables = [
        'branches',
        'roles',
        'tenant_settings',
        'document_sequences',
        'audit_logs',
        'customers',
        'suppliers',
        'medicine_categories',
        'medicines',
        'medicine_batches',
        'stock_movements',
        'sales',
        'sale_items',
        'sale_payments',
        'user_permission_overrides',
    ];

    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ($this->tables as $table) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'tenant_id')) {
                continue;
            }

            DB::statement("ALTER TABLE \"{$table}\" ENABLE ROW LEVEL SECURITY");
            DB::statement("ALTER TABLE \"{$table}\" FORCE ROW LEVEL SECURITY");
            DB::statement("DROP POLICY IF EXISTS tenant_isolation_policy ON \"{$table}\"");

            DB::statement("
                CREATE POLICY tenant_isolation_policy ON \"{$table}\"
                FOR ALL
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR (
                        nullif(current_setting('app.tenant_id', true), '') IS NOT NULL
                        AND tenant_id::text = current_setting('app.tenant_id', true)
                    )
                )
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR (
                        nullif(current_setting('app.tenant_id', true), '') IS NOT NULL
                        AND tenant_id::text = current_setting('app.tenant_id', true)
                    )
                )
            ");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ($this->tables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            DB::statement("DROP POLICY IF EXISTS tenant_isolation_policy ON \"{$table}\"");
            DB::statement("ALTER TABLE \"{$table}\" NO FORCE ROW LEVEL SECURITY");
            DB::statement("ALTER TABLE \"{$table}\" DISABLE ROW LEVEL SECURITY");
        }
    }
};

