<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            if (! Schema::hasColumn('customers', 'branch_id')) {
                $table->foreignId('branch_id')->nullable()->after('tenant_id')->constrained('branches')->nullOnDelete();
            }
            if (! Schema::hasColumn('customers', 'segment')) {
                $table->string('segment', 30)->default('regular')->after('customer_type');
            }
            if (! Schema::hasColumn('customers', 'credit_limit')) {
                $table->decimal('credit_limit', 12, 2)->default(0)->after('loyalty_points');
            }
            if (! Schema::hasColumn('customers', 'doctor_name')) {
                $table->string('doctor_name', 150)->nullable()->after('allergies');
            }
            if (! Schema::hasColumn('customers', 'notes')) {
                $table->text('notes')->nullable()->after('doctor_name');
            }
            if (! Schema::hasColumn('customers', 'last_contacted_at')) {
                $table->timestamp('last_contacted_at')->nullable()->after('notes');
            }
        });

        if (! Schema::hasTable('crm_followups')) {
            Schema::create('crm_followups', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
                $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
                $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
                $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('followup_type', 30)->default('refill_reminder');
                $table->string('title', 180);
                $table->string('medicines_summary', 300)->nullable();
                $table->date('due_date');
                $table->string('channel', 20)->default('phone');
                $table->string('status', 20)->default('pending');
                $table->text('notes')->nullable();
                $table->text('outcome_notes')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();

                $table->index(['tenant_id', 'branch_id', 'status', 'due_date']);
                $table->index(['tenant_id', 'customer_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_followups');

        Schema::table('customers', function (Blueprint $table): void {
            foreach (['last_contacted_at', 'notes', 'doctor_name', 'credit_limit', 'segment'] as $col) {
                if (Schema::hasColumn('customers', $col)) {
                    $table->dropColumn($col);
                }
            }
            if (Schema::hasColumn('customers', 'branch_id')) {
                $table->dropConstrainedForeignId('branch_id');
            }
        });
    }
};

