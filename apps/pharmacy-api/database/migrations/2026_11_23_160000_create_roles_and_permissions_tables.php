<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Enhance permissions table
        Schema::table('permissions', function (Blueprint $table) {
            $table->string('key', 100)->nullable()->unique();
            $table->string('module', 50)->nullable()->index();
            $table->string('action', 50)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_sensitive')->default(false);
            $table->string('requires_feature', 100)->nullable();
            $table->boolean('supports_scope')->default(false);
        });

        // Populate key from name for existing rows if any
        DB::statement("UPDATE permissions SET key = name WHERE key IS NULL");

        // 2. Enhance roles table
        Schema::table('roles', function (Blueprint $table) {
            $table->boolean('is_locked')->default(false);
            $table->integer('sort')->default(0);
        });

        // 3. Create role_permissions table with scope support ('own', 'branch', 'all')
        if (! Schema::hasTable('role_permissions')) {
            Schema::create('role_permissions', function (Blueprint $table) {
                $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
                $table->string('permission_key', 100);
                $table->string('scope', 20)->default('all'); // 'own', 'branch', 'all'
                $table->timestamps();

                $table->primary(['role_id', 'permission_key']);
            });
        }

        // 4. Create role_limits table
        if (! Schema::hasTable('role_limits')) {
            Schema::create('role_limits', function (Blueprint $table) {
                $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
                $table->string('limit_key', 60);
                $table->decimal('value', 14, 2)->nullable(); // null = unlimited, 0 = not allowed
                $table->timestamps();

                $table->primary(['role_id', 'limit_key']);
            });
        }

        // 5. Enhance users table for security, PIN, branch access, permission versioning
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('role_id')->nullable()->constrained('roles')->nullOnDelete();
            $table->string('manager_pin_hash')->nullable();
            $table->unsignedInteger('permission_version')->default(1);
            $table->boolean('access_all_branches')->default(false);
            $table->foreignId('default_branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->boolean('must_change_password')->default(false);
        });

        // 6. Create user_branches table (branch scoping)
        if (! Schema::hasTable('user_branches')) {
            Schema::create('user_branches', function (Blueprint $table) {
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
                $table->timestamps();

                $table->primary(['user_id', 'branch_id']);
            });
        }

        // 7. Create user_permission_overrides table
        if (! Schema::hasTable('user_permission_overrides')) {
            Schema::create('user_permission_overrides', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('permission_key', 100);
                $table->string('effect', 10); // 'allow' or 'deny'
                $table->string('scope', 20)->nullable(); // 'own', 'branch', 'all'
                $table->timestamp('expires_at')->nullable();
                $table->text('reason')->nullable();
                $table->foreignId('granted_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->unique(['user_id', 'permission_key']);
                $table->index(['tenant_id', 'user_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_permission_overrides');
        Schema::dropIfExists('user_branches');

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['default_branch_id']);
            $table->dropForeign(['role_id']);
            $table->dropColumn([
                'role_id',
                'manager_pin_hash',
                'permission_version',
                'access_all_branches',
                'default_branch_id',
                'must_change_password',
            ]);
        });

        Schema::dropIfExists('role_limits');
        Schema::dropIfExists('role_permissions');

        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn(['is_locked', 'sort']);
        });

        Schema::table('permissions', function (Blueprint $table) {
            $table->dropColumn([
                'key',
                'module',
                'action',
                'description',
                'is_sensitive',
                'requires_feature',
                'supports_scope',
            ]);
        });
    }
};
