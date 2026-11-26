<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Enhance counters table
        Schema::table('counters', function (Blueprint $table): void {
            $table->string('location', 120)->nullable()->after('zone');
            $table->unsignedInteger('max_queue_capacity')->default(20)->after('status');
            $table->boolean('auto_assignment_enabled')->default(true)->after('max_queue_capacity');
            $table->timestamp('last_assigned_at')->nullable()->after('auto_assignment_enabled');
        });

        // 2. Enhance counter_sessions table
        Schema::table('counter_sessions', function (Blueprint $table): void {
            $table->string('shift', 32)->default('morning')->after('status'); // 'morning', 'evening', 'night'
        });

        // 3. Create counter_cashiers table (Cashier Employee Assignment & Shift Schedules)
        Schema::create('counter_cashiers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('counter_id')->constrained('counters')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('shift', 32)->default('morning'); // 'morning', 'evening', 'night', 'any'
            $table->boolean('is_primary')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['counter_id', 'user_id', 'shift']);
            $table->index(['tenant_id', 'branch_id', 'counter_id']);
            $table->index(['tenant_id', 'user_id']);
        });

        // 4. Enhance sales table with order management & tracking fields
        Schema::table('sales', function (Blueprint $table): void {
            $table->string('order_number', 64)->nullable()->after('invoice_number');
            $table->string('order_status', 32)->default('completed')->after('payment_status');
            $table->foreignId('salesman_id')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
            $table->foreignId('cashier_id')->nullable()->after('salesman_id')->constrained('users')->nullOnDelete();
            $table->string('prescription_file', 255)->nullable()->after('prescription_notes');
            $table->boolean('requires_verification')->default(false)->after('prescription_file');
            $table->string('verification_status', 32)->default('not_required')->after('requires_verification');
            $table->foreignId('verified_by')->nullable()->after('verification_status')->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable()->after('sold_at');
            $table->timestamp('processing_started_at')->nullable()->after('assigned_at');
            $table->timestamp('completed_at')->nullable()->after('processing_started_at');
            $table->timestamp('cancelled_at')->nullable()->after('completed_at');
            $table->text('cancellation_reason')->nullable()->after('cancelled_at');

            $table->index(['tenant_id', 'branch_id', 'order_status']);
            $table->index(['tenant_id', 'order_number']);
            $table->index(['tenant_id', 'salesman_id']);
            $table->index(['tenant_id', 'cashier_id']);
        });

        // 5. Create counter_assignments table
        Schema::create('counter_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('counter_id')->constrained('counters')->cascadeOnDelete();
            $table->foreignId('cashier_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('assignment_type', 32)->default('automatic'); // 'automatic', 'manual', 'reassigned'
            $table->string('status', 32)->default('active'); // 'active', 'completed', 'cancelled', 'reassigned'
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamp('completed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'counter_id', 'status']);
            $table->index(['tenant_id', 'sale_id']);
            $table->index(['tenant_id', 'branch_id', 'status']);
        });

        // 6. Create sale_status_histories table
        Schema::create('sale_status_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('from_status', 32)->nullable();
            $table->string('to_status', 32);
            $table->text('reason')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_id', 'sale_id']);
            $table->index(['tenant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_status_histories');
        Schema::dropIfExists('counter_assignments');

        Schema::table('sales', function (Blueprint $table): void {
            $table->dropForeign(['salesman_id']);
            $table->dropForeign(['cashier_id']);
            $table->dropForeign(['verified_by']);
            $table->dropIndex(['tenant_id', 'branch_id', 'order_status']);
            $table->dropIndex(['tenant_id', 'order_number']);
            $table->dropIndex(['tenant_id', 'salesman_id']);
            $table->dropIndex(['tenant_id', 'cashier_id']);
            $table->dropColumn([
                'order_number',
                'order_status',
                'salesman_id',
                'cashier_id',
                'prescription_file',
                'requires_verification',
                'verification_status',
                'verified_by',
                'assigned_at',
                'processing_started_at',
                'completed_at',
                'cancelled_at',
                'cancellation_reason',
            ]);
        });

        Schema::dropIfExists('counter_cashiers');

        Schema::table('counter_sessions', function (Blueprint $table): void {
            $table->dropColumn(['shift']);
        });

        Schema::table('counters', function (Blueprint $table): void {
            $table->dropColumn([
                'location',
                'max_queue_capacity',
                'auto_assignment_enabled',
                'last_assigned_at',
            ]);
        });
    }
};

