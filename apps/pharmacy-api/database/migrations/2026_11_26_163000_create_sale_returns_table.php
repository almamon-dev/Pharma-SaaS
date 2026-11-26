<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('sale_returns')) {
            return;
        }

        Schema::create('sale_returns', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('return_number', 40)->unique();
            $table->string('credit_note_number', 40)->nullable()->unique();
            $table->decimal('return_amount', 12, 2);
            $table->string('reason', 255);
            $table->text('notes')->nullable();
            $table->string('status', 24)->default('pending'); // pending, approved, rejected
            $table->string('credit_note_status', 24)->default('pending'); // pending, issued, applied, void
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'branch_id', 'status']);
            $table->index(['tenant_id', 'requested_by']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE sale_returns ENABLE ROW LEVEL SECURITY');
            DB::statement('ALTER TABLE sale_returns FORCE ROW LEVEL SECURITY');
            DB::statement("DROP POLICY IF EXISTS tenant_isolation_policy ON sale_returns");
            DB::statement("
                CREATE POLICY tenant_isolation_policy ON sale_returns
                USING (
                    current_setting('app.tenant_id', true) IS NULL
                    OR current_setting('app.tenant_id', true) = ''
                    OR tenant_id = current_setting('app.tenant_id', true)::bigint
                )
            ");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_returns');
    }
};

