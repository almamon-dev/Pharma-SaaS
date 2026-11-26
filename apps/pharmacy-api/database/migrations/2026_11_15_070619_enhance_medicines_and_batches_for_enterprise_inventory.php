<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicines', function (Blueprint $table): void {
            $table->text('description')->nullable()->after('strength');

            $table->index(['tenant_id', 'barcode'], 'medicines_tenant_barcode_index');
            $table->index(['tenant_id', 'is_active', 'deleted_at'], 'medicines_tenant_active_deleted_index');
        });

        Schema::table('medicine_batches', function (Blueprint $table): void {
            $table->timestamp('disposed_at')->nullable()->after('status');
            $table->string('disposal_reason', 255)->nullable()->after('disposed_at');
            $table->foreignId('disposed_by')->nullable()->after('disposal_reason')->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable()->after('disposed_by');

            $table->index(['tenant_id', 'branch_id', 'status', 'expiry_date'], 'batches_tenant_branch_status_expiry_index');
            $table->index(['tenant_id', 'branch_id', 'medicine_id', 'status'], 'batches_tenant_branch_med_status_index');
        });
    }

    public function down(): void
    {
        Schema::table('medicine_batches', function (Blueprint $table): void {
            $table->dropIndex('batches_tenant_branch_status_expiry_index');
            $table->dropIndex('batches_tenant_branch_med_status_index');
            $table->dropConstrainedForeignId('disposed_by');
            $table->dropColumn(['disposed_at', 'disposal_reason', 'notes']);
        });

        Schema::table('medicines', function (Blueprint $table): void {
            $table->dropIndex('medicines_tenant_barcode_index');
            $table->dropIndex('medicines_tenant_active_deleted_index');
            $table->dropColumn('description');
        });
    }
};
