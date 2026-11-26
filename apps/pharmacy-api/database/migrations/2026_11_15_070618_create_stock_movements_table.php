<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('medicine_id')->constrained('medicines')->restrictOnDelete();
            $table->foreignId('medicine_batch_id')->nullable()->constrained('medicine_batches')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('movement_type', 40);
            $table->integer('quantity_change');
            $table->integer('balance_before')->default(0);
            $table->integer('balance_after')->default(0);
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->decimal('total_cost', 14, 2)->default(0);
            $table->string('reference_type', 120)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('reason', 255)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('occurred_at')->useCurrent();
            $table->timestamps();

            $table->index(['tenant_id', 'branch_id', 'occurred_at'], 'stock_movements_tenant_branch_occurred_idx');
            $table->index(['tenant_id', 'medicine_id', 'occurred_at'], 'stock_movements_tenant_med_occurred_idx');
            $table->index(['tenant_id', 'medicine_batch_id'], 'stock_movements_tenant_batch_idx');
            $table->index(['tenant_id', 'movement_type', 'occurred_at'], 'stock_movements_tenant_type_occurred_idx');
            $table->index(['reference_type', 'reference_id'], 'stock_movements_reference_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
