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
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $tables = [
            'categories',
            'companies',
            'generics',
            'products',
            'product_units',
            'product_barcodes',
            'product_branch_settings',
            'product_discount_rules',
            'import_jobs',
            'import_job_errors',
        ];

        foreach ($tables as $table) {
            DB::statement("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY;");
            DB::statement("ALTER TABLE {$table} FORCE ROW LEVEL SECURITY;");

            $policyName = "{$table}_tenant_isolation_policy";
            DB::statement("DROP POLICY IF EXISTS {$policyName} ON {$table};");
            DB::statement(<<<SQL
                CREATE POLICY {$policyName} ON {$table}
                AS PERMISSIVE
                FOR ALL
                TO PUBLIC
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR tenant_id::text = current_setting('app.tenant_id', true)
                )
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR tenant_id::text = current_setting('app.tenant_id', true)
                );
            SQL);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $tables = [
            'categories',
            'companies',
            'generics',
            'products',
            'product_units',
            'product_barcodes',
            'product_branch_settings',
            'product_discount_rules',
            'import_jobs',
            'import_job_errors',
        ];

        foreach ($tables as $table) {
            $policyName = "{$table}_tenant_isolation_policy";
            DB::statement("DROP POLICY IF EXISTS {$policyName} ON {$table};");
            DB::statement("ALTER TABLE {$table} NO FORCE ROW LEVEL SECURITY;");
            DB::statement("ALTER TABLE {$table} DISABLE ROW LEVEL SECURITY;");
        }
    }
};

