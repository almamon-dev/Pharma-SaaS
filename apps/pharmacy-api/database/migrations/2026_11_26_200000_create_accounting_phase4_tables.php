<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_statements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('account_id')->constrained('accounts')->restrictOnDelete();
            $table->date('statement_date');
            $table->string('filename', 255);
            $table->bigInteger('opening_balance_paisa')->default(0);
            $table->bigInteger('closing_balance_paisa')->default(0);
            $table->string('status', 24)->default('in_progress'); // in_progress, reconciled
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reconciled_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'account_id', 'statement_date']);
        });

        Schema::create('bank_statement_lines', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('bank_statement_id')->constrained('bank_statements')->cascadeOnDelete();
            $table->date('line_date');
            $table->string('reference', 120)->nullable();
            $table->string('description', 300)->nullable();
            // Bank statement convention: debit = withdrawal/outflow, credit = deposit/inflow (integer paisa)
            $table->bigInteger('debit_paisa')->default(0);
            $table->bigInteger('credit_paisa')->default(0);
            $table->string('status', 20)->default('unmatched'); // unmatched, matched, ignored
            $table->foreignId('matched_voucher_line_id')->nullable()->constrained('voucher_lines')->nullOnDelete();
            $table->string('match_method', 16)->nullable(); // auto, manual
            $table->timestamp('matched_at')->nullable();
            $table->foreignId('matched_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'bank_statement_id', 'status']);
            $table->index(['tenant_id', 'matched_voucher_line_id']);
        });

        if (DB::getDriverName() === 'pgsql') {
            foreach (['bank_statements', 'bank_statement_lines'] as $table) {
                DB::statement("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY");
                DB::statement("ALTER TABLE {$table} FORCE ROW LEVEL SECURITY");
                DB::statement("DROP POLICY IF EXISTS tenant_isolation ON {$table}");
                DB::statement("
                    CREATE POLICY tenant_isolation ON {$table}
                    USING (
                        current_setting('app.bypass_rls', true) = 'on'
                        OR (
                            NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
                            AND tenant_id::text = current_setting('app.tenant_id', true)
                        )
                    )
                    WITH CHECK (
                        current_setting('app.bypass_rls', true) = 'on'
                        OR (
                            NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
                            AND tenant_id::text = current_setting('app.tenant_id', true)
                        )
                    )
                ");
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_statement_lines');
        Schema::dropIfExists('bank_statements');
    }
};

