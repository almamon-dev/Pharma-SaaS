<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Upgrade counter_sessions with exact cash drawer totals, denominations & Z-Report snapshot
        Schema::table('counter_sessions', function (Blueprint $table): void {
            if (! Schema::hasColumn('counter_sessions', 'z_report_number')) {
                $table->string('z_report_number', 40)->nullable()->after('shift');
            }
            if (! Schema::hasColumn('counter_sessions', 'cash_sales_total')) {
                $table->decimal('cash_sales_total', 12, 2)->default(0)->after('opening_float');
            }
            if (! Schema::hasColumn('counter_sessions', 'card_sales_total')) {
                $table->decimal('card_sales_total', 12, 2)->default(0)->after('cash_sales_total');
            }
            if (! Schema::hasColumn('counter_sessions', 'mobile_sales_total')) {
                $table->decimal('mobile_sales_total', 12, 2)->default(0)->after('card_sales_total');
            }
            if (! Schema::hasColumn('counter_sessions', 'cash_in_total')) {
                $table->decimal('cash_in_total', 12, 2)->default(0)->after('mobile_sales_total');
            }
            if (! Schema::hasColumn('counter_sessions', 'cash_out_total')) {
                $table->decimal('cash_out_total', 12, 2)->default(0)->after('cash_in_total');
            }
            if (! Schema::hasColumn('counter_sessions', 'cash_refunds_total')) {
                $table->decimal('cash_refunds_total', 12, 2)->default(0)->after('cash_out_total');
            }
            if (! Schema::hasColumn('counter_sessions', 'closing_denominations')) {
                $table->jsonb('closing_denominations')->nullable()->after('closing_cash_counted');
            }
            if (! Schema::hasColumn('counter_sessions', 'z_report_snapshot')) {
                $table->jsonb('z_report_snapshot')->nullable()->after('notes');
            }
            if (! Schema::hasColumn('counter_sessions', 'closed_by')) {
                $table->foreignId('closed_by')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
            }

            $table->unique(['tenant_id', 'z_report_number'], 'counter_sessions_tenant_z_report_unique');
        });

        // 2. Create counter_cash_movements table (Cash In / Cash Out / Safe Drop / Cash Refund ledger)
        if (! Schema::hasTable('counter_cash_movements')) {
            Schema::create('counter_cash_movements', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
                $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
                $table->foreignId('counter_id')->constrained('counters')->cascadeOnDelete();
                $table->foreignId('counter_session_id')->constrained('counter_sessions')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
                $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('type', 32); // 'cash_in', 'cash_out', 'safe_drop', 'cash_refund'
                $table->decimal('amount', 12, 2);
                $table->string('reason', 255);
                $table->string('reference_number', 100)->nullable();
                $table->text('notes')->nullable();
                $table->timestamp('occurred_at')->useCurrent();
                $table->timestamps();

                $table->index(['tenant_id', 'counter_session_id', 'type'], 'ccm_tenant_session_type_idx');
                $table->index(['tenant_id', 'counter_id', 'occurred_at'], 'ccm_tenant_counter_time_idx');
            });
        }

        // 3. PostgreSQL Partial Unique Indexes & RLS Policies for strict concurrency + tenant isolation
        if (DB::getDriverName() === 'pgsql') {
            // Enforce at DB level: max 1 open shift per cashier per tenant
            DB::statement("
                CREATE UNIQUE INDEX IF NOT EXISTS counter_sessions_one_open_per_user_unique
                ON counter_sessions (tenant_id, user_id)
                WHERE status = 'open'
            ");

            // Enforce at DB level: max 1 open shift per counter per tenant
            DB::statement("
                CREATE UNIQUE INDEX IF NOT EXISTS counter_sessions_one_open_per_counter_unique
                ON counter_sessions (tenant_id, counter_id)
                WHERE status = 'open'
            ");

            // Enable PostgreSQL RLS on counter tables
            $counterTables = [
                'counters',
                'counter_sessions',
                'counter_break_logs',
                'counter_cashiers',
                'counter_cash_movements',
            ];

            foreach ($counterTables as $table) {
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
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS counter_sessions_one_open_per_user_unique');
            DB::statement('DROP INDEX IF EXISTS counter_sessions_one_open_per_counter_unique');

            $counterTables = [
                'counter_cash_movements',
                'counter_cashiers',
                'counter_break_logs',
                'counter_sessions',
                'counters',
            ];

            foreach ($counterTables as $table) {
                if (Schema::hasTable($table)) {
                    DB::statement("DROP POLICY IF EXISTS tenant_isolation_policy ON \"{$table}\"");
                    DB::statement("ALTER TABLE \"{$table}\" NO FORCE ROW LEVEL SECURITY");
                    DB::statement("ALTER TABLE \"{$table}\" DISABLE ROW LEVEL SECURITY");
                }
            }
        }

        Schema::dropIfExists('counter_cash_movements');

        Schema::table('counter_sessions', function (Blueprint $table): void {
            $table->dropUnique('counter_sessions_tenant_z_report_unique');
            if (Schema::hasColumn('counter_sessions', 'closed_by')) {
                $table->dropForeign(['closed_by']);
                $table->dropColumn('closed_by');
            }
            $columns = [
                'z_report_number',
                'cash_sales_total',
                'card_sales_total',
                'mobile_sales_total',
                'cash_in_total',
                'cash_out_total',
                'cash_refunds_total',
                'closing_denominations',
                'z_report_snapshot',
            ];
            $existing = array_filter($columns, fn (string $col) => Schema::hasColumn('counter_sessions', $col));
            if (! empty($existing)) {
                $table->dropColumn($existing);
            }
        });
    }
};

