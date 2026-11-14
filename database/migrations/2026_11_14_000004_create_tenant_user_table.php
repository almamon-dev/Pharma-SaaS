<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_user', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->boolean('is_owner')->default(false);
            $table->string('role', 50)->default('staff');
            $table->jsonb('roles')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'user_id']);
            $table->index(['user_id', 'is_active']);
            $table->foreign(['branch_id', 'tenant_id'], 'tenant_user_branch_tenant_foreign')
                ->references(['id', 'tenant_id'])
                ->on('branches');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_user');
    }
};

