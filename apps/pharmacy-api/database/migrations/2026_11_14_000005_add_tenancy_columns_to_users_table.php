<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('phone', 30)->nullable()->after('email');
            $table->string('account_type', 20)->default('staff')->index()->after('phone');
            $table->foreignId('subscriber_id')->nullable()->constrained('users')->nullOnDelete()->after('account_type');
            $table->boolean('is_super_admin')->default(false)->after('subscriber_id');
            $table->string('platform_compliance_role', 40)->nullable()->after('is_super_admin');
            $table->foreignId('current_tenant_id')->nullable()->constrained('tenants')->nullOnDelete()->after('platform_compliance_role');
            $table->string('status', 20)->default('active')->after('current_tenant_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('current_tenant_id');
            $table->dropConstrainedForeignId('subscriber_id');
            $table->dropColumn([
                'phone',
                'account_type',
                'is_super_admin',
                'platform_compliance_role',
                'status',
            ]);
        });
    }
};

