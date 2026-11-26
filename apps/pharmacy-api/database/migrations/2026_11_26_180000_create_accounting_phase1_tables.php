<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Chart of Accounts
        Schema::create('accounts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->string('code', 32);
            $table->string('name_en', 160);
            $table->string('name_bn', 160);
            $table->string('type', 24); // asset, liability, equity, income, expense
            $table->string('report_group', 40); // cash, bank, receivable, inventory, other_current_asset, fixed_asset, payable, vat_input, vat_output, other_liability, equity, revenue, other_income, cogs, operating_expense
            $table->boolean('is_contra')->default(false);
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'code']);
            $table->index(['tenant_id', 'type', 'is_active']);
            $table->index(['tenant_id', 'report_group']);
        });

        // 2. Fiscal Years
        Schema::create('fiscal_years', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name', 40); // e.g. FY 2026-2027
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status', 16)->default('open'); // open, closed
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'name']);
            $table->index(['tenant_id', 'start_date', 'end_date']);
        });

        // 3. Fiscal Periods (Monthly)
        Schema::create('fiscal_periods', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fiscal_year_id')->constrained('fiscal_years')->cascadeOnDelete();
            $table->string('name', 40); // e.g. Nov 2026
            $table->unsignedTinyInteger('period_number'); // 1..12
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status', 16)->default('open'); // open, closed
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reopened_at')->nullable();
            $table->foreignId('reopened_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'fiscal_year_id', 'period_number']);
            $table->index(['tenant_id', 'start_date', 'end_date']);
            $table->index(['tenant_id', 'status']);
        });

        // 4. Vouchers (Single double-entry engine for all voucher types)
        Schema::create('vouchers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fiscal_year_id')->constrained('fiscal_years')->restrictOnDelete();
            $table->foreignId('fiscal_period_id')->constrained('fiscal_periods')->restrictOnDelete();
            $table->string('type', 32); // receipt, payment, journal, contra, sales, purchase, sales_return, purchase_return, opening_balance, stock_adjustment, payroll
            $table->string('number', 64)->nullable(); // assigned sequentially on post (or draft ref if null)
            $table->date('date');
            $table->string('status', 24)->default('draft'); // draft, pending_approval, posted, reversed
            $table->text('narration')->nullable();
            $table->bigInteger('total_debit_paisa')->default(0);
            $table->bigInteger('total_credit_paisa')->default(0);
            $table->string('source_module', 40)->nullable();
            $table->string('source_id', 80)->nullable();
            $table->string('source_event', 40)->nullable();
            $table->foreignId('reversed_voucher_id')->nullable()->constrained('vouchers')->nullOnDelete();
            $table->foreignId('reversal_of_voucher_id')->nullable()->constrained('vouchers')->nullOnDelete();
            $table->json('attachments')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('posted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'number']);
            $table->unique(['tenant_id', 'source_module', 'source_id', 'source_event'], 'vouchers_idempotency_unique');
            $table->index(['tenant_id', 'branch_id', 'date']);
            $table->index(['tenant_id', 'status', 'date']);
            $table->index(['tenant_id', 'type', 'date']);
        });

        // 5. Voucher Lines (Integer paisa only — single-sided debit OR credit)
        Schema::create('voucher_lines', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('voucher_id')->constrained('vouchers')->cascadeOnDelete();
            $table->foreignId('account_id')->constrained('accounts')->restrictOnDelete();
            $table->unsignedBigInteger('party_id')->nullable(); // Phase 2 parties link
            $table->date('date');
            $table->bigInteger('debit_paisa')->default(0);
            $table->bigInteger('credit_paisa')->default(0);
            $table->string('narration', 255)->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'account_id', 'date']);
            $table->index(['tenant_id', 'voucher_id']);
            $table->index(['tenant_id', 'party_id']);
        });

        // 6. Voucher Sequences (Concurrency-safe sequential numbering per tenant + branch + type + fiscal_year)
        Schema::create('voucher_sequences', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32);
            $table->foreignId('fiscal_year_id')->constrained('fiscal_years')->cascadeOnDelete();
            $table->bigInteger('last_number')->default(0);
            $table->timestamps();

            $table->unique(['tenant_id', 'branch_id', 'type', 'fiscal_year_id'], 'voucher_seq_unique');
        });

        // 7. Simple Mode Categories (Maps plain-language categories to double-entry accounts)
        Schema::create('simple_categories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 16); // income, expense
            $table->string('code', 40);
            $table->string('name_en', 120);
            $table->string('name_bn', 120);
            $table->foreignId('debit_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('credit_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'kind', 'code']);
            $table->index(['tenant_id', 'kind', 'is_active']);
        });

        // 8. Accounting Settings (Per tenant)
        Schema::create('accounting_settings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('mode', 16)->default('simple'); // simple, advanced
            $table->string('coa_template', 32)->default('pharmacy'); // pharmacy, distributor, hospital_pharmacy
            $table->unsignedTinyInteger('fiscal_year_start_month')->default(7); // July (Bangladesh standard FY)
            $table->string('default_currency', 8)->default('BDT');
            $table->boolean('vat_enabled')->default(false);
            $table->unsignedInteger('vat_rate_bps')->default(0); // basis points: 500 = 5.00%
            $table->bigInteger('approval_threshold_paisa')->default(0); // 0 = disabled
            $table->foreignId('default_cash_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('default_bank_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('default_wallet_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('default_receivable_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('default_payable_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('default_inventory_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('default_cogs_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('default_sales_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('default_sales_return_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('default_vat_input_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('default_vat_output_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('default_retained_earnings_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->timestamps();
        });

        if (DB::getDriverName() === 'pgsql') {
            // DB-level check: each voucher line must have strictly one positive side (debit OR credit, never both, never negative)
            DB::statement('
                ALTER TABLE voucher_lines
                ADD CONSTRAINT chk_voucher_lines_single_side
                CHECK (
                    debit_paisa >= 0
                    AND credit_paisa >= 0
                    AND NOT (debit_paisa > 0 AND credit_paisa > 0)
                    AND (debit_paisa > 0 OR credit_paisa > 0)
                )
            ');

            // Enable and force PostgreSQL Row-Level Security on all accounting tables
            $tables = [
                'accounts',
                'fiscal_years',
                'fiscal_periods',
                'vouchers',
                'voucher_lines',
                'voucher_sequences',
                'simple_categories',
                'accounting_settings',
            ];

            foreach ($tables as $tbl) {
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
        Schema::dropIfExists('accounting_settings');
        Schema::dropIfExists('simple_categories');
        Schema::dropIfExists('voucher_sequences');
        Schema::dropIfExists('voucher_lines');
        Schema::dropIfExists('vouchers');
        Schema::dropIfExists('fiscal_periods');
        Schema::dropIfExists('fiscal_years');
        Schema::dropIfExists('accounts');
    }
};

