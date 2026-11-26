<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add customer_type and customer_code to customers
        Schema::table('customers', function (Blueprint $table): void {
            if (! Schema::hasColumn('customers', 'customer_code')) {
                $table->string('customer_code', 64)->nullable()->after('id');
            }
            if (! Schema::hasColumn('customers', 'customer_type')) {
                $table->string('customer_type', 32)->default('registered')->after('phone'); // 'walk_in', 'registered', 'patient', 'corporate'
                $table->index(['tenant_id', 'customer_type']);
            }
        });

        // 2. Add discount approval, internal notes, and prescription reference to sales
        Schema::table('sales', function (Blueprint $table): void {
            if (! Schema::hasColumn('sales', 'prescription_reference')) {
                $table->string('prescription_reference', 100)->nullable()->after('prescription_file');
            }
            if (! Schema::hasColumn('sales', 'discount_percentage')) {
                $table->decimal('discount_percentage', 5, 2)->default(0)->after('discount_amount');
            }
            if (! Schema::hasColumn('sales', 'discount_status')) {
                $table->string('discount_status', 32)->default('none')->after('discount_percentage'); // 'none', 'approved', 'pending_approval', 'rejected'
            }
            if (! Schema::hasColumn('sales', 'discount_requested_by')) {
                $table->foreignId('discount_requested_by')->nullable()->after('discount_status')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('sales', 'discount_approved_by')) {
                $table->foreignId('discount_approved_by')->nullable()->after('discount_requested_by')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('sales', 'discount_approved_at')) {
                $table->timestamp('discount_approved_at')->nullable()->after('discount_approved_by');
            }
            if (! Schema::hasColumn('sales', 'discount_rejection_reason')) {
                $table->string('discount_rejection_reason', 255)->nullable()->after('discount_approved_at');
            }
            if (! Schema::hasColumn('sales', 'internal_notes')) {
                $table->text('internal_notes')->nullable()->after('notes');
            }

            $table->index(['tenant_id', 'discount_status']);
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table): void {
            $table->dropIndex(['tenant_id', 'discount_status']);
            $table->dropForeign(['discount_requested_by']);
            $table->dropForeign(['discount_approved_by']);
            $table->dropColumn([
                'prescription_reference',
                'discount_percentage',
                'discount_status',
                'discount_requested_by',
                'discount_approved_by',
                'discount_approved_at',
                'discount_rejection_reason',
                'internal_notes',
            ]);
        });

        Schema::table('customers', function (Blueprint $table): void {
            $table->dropIndex(['tenant_id', 'customer_type']);
            $table->dropColumn([
                'customer_code',
                'customer_type',
            ]);
        });
    }
};
