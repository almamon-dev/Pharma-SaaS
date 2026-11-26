<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Parties (Customers & Suppliers unified for accounting ledgers, ageing & credit limits)
        Schema::create('parties', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('type', 16); // customer, supplier, both
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->string('code', 40)->nullable();
            $table->string('name', 160);
            $table->string('phone', 40)->nullable();
            $table->string('email', 160)->nullable();
            $table->string('address', 255)->nullable();
            $table->bigInteger('credit_limit_paisa')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'customer_id'], 'parties_tenant_customer_unique');
            $table->unique(['tenant_id', 'supplier_id'], 'parties_tenant_supplier_unique');
            $table->index(['tenant_id', 'type', 'is_active']);
        });

        // 2. Auto-Posting Errors Queue (captures failed postings for retry without blocking source transactions)
        Schema::create('posting_errors', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('source_module', 40);
            $table->string('source_id', 80);
            $table->string('source_event', 40);
            $table->json('payload');
            $table->text('error');
            $table->unsignedInteger('retry_count')->default(0);
            $table->string('status', 20)->default('pending'); // pending, resolved, ignored
            $table->foreignId('resolved_voucher_id')->nullable()->constrained('vouchers')->nullOnDelete();
            $table->timestamp('last_retried_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status', 'created_at']);
            $table->index(['tenant_id', 'source_module', 'source_id']);
        });

        // 3. Add VAT tracking columns to voucher_lines
        Schema::table('voucher_lines', function (Blueprint $table): void {
            $table->string('vat_type', 16)->nullable()->after('party_id'); // input, output
            $table->unsignedInteger('vat_rate_bps')->default(0)->after('vat_type');
            $table->bigInteger('vat_amount_paisa')->default(0)->after('vat_rate_bps');
        });

        if (DB::getDriverName() === 'pgsql') {
            foreach (['parties', 'posting_errors'] as $tbl) {
                DB::statement("ALTER TABLE \"{$tbl}\" ENABLE ROW LEVEL SECURITY");
                DB::statement("ALTER TABLE \"{$tbl}\" FORCE ROW LEVEL SECURITY");
                DB::statement("DROP POLICY IF EXISTS tenant_isolation_policy ON \"{$tbl}\"");
                DB::statement("
                    CREATE POLICY tenant_isolation_policy ON \"{$tbl}\"
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
        Schema::table('voucher_lines', function (Blueprint $table): void {
            $table->dropColumn(['vat_type', 'vat_rate_bps', 'vat_amount_paisa']);
        });
        Schema::dropIfExists('posting_errors');
        Schema::dropIfExists('parties');
    }
};

