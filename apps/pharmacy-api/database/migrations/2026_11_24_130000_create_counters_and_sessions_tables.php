<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('counters', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->string('code', 32);
            $table->string('name', 120);
            $table->string('type', 32)->default('hybrid'); // 'dispensing', 'cashier', 'hybrid', 'emergency', 'ipd'
            $table->string('zone', 64)->default('General');
            $table->string('status', 20)->default('closed'); // 'active', 'on_break', 'closed'
            $table->string('current_break_reason', 60)->nullable();
            $table->timestamp('break_started_at')->nullable();
            $table->foreignId('current_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('printer_ip', 64)->nullable();
            $table->string('terminal_device_id', 128)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['branch_id', 'code']);
            $table->index(['tenant_id', 'branch_id', 'status']);
        });

        Schema::create('counter_sessions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('counter_id')->constrained('counters')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('status', 20)->default('open'); // 'open', 'closed'
            $table->timestamp('opened_at')->useCurrent();
            $table->timestamp('closed_at')->nullable();
            $table->decimal('opening_float', 12, 2)->default(0);
            $table->decimal('closing_cash_counted', 12, 2)->nullable();
            $table->decimal('system_expected_cash', 12, 2)->default(0);
            $table->decimal('discrepancy', 12, 2)->default(0);
            $table->decimal('total_sales_amount', 12, 2)->default(0);
            $table->integer('total_transactions')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'counter_id', 'status']);
            $table->index(['tenant_id', 'user_id', 'status']);
        });

        Schema::create('counter_break_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('counter_id')->constrained('counters')->cascadeOnDelete();
            $table->foreignId('counter_session_id')->nullable()->constrained('counter_sessions')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('break_type', 32)->default('tea'); // 'lunch', 'prayer', 'tea', 'tally', 'other'
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('ended_at')->nullable();
            $table->integer('duration_minutes')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'counter_id', 'started_at']);
        });

        Schema::table('sales', function (Blueprint $table): void {
            $table->foreignId('counter_id')->nullable()->after('branch_id')->constrained('counters')->nullOnDelete();
            $table->foreignId('counter_session_id')->nullable()->after('counter_id')->constrained('counter_sessions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table): void {
            $table->dropForeign(['counter_session_id']);
            $table->dropForeign(['counter_id']);
            $table->dropColumn(['counter_session_id', 'counter_id']);
        });

        Schema::dropIfExists('counter_break_logs');
        Schema::dropIfExists('counter_sessions');
        Schema::dropIfExists('counters');
    }
};

