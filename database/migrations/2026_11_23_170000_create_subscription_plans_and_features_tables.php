<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Global Plans table
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_public')->default(true); // 'trial' is false
            $table->integer('sort')->default(0);
            $table->timestamps();
        });

        // 2. Plan Prices
        Schema::create('plan_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_id')->constrained('plans')->cascadeOnDelete();
            $table->string('billing_cycle'); // 'monthly', 'yearly'
            $table->decimal('amount', 12, 2);
            $table->string('currency', 10)->default('BDT');
            $table->timestamps();

            $table->unique(['plan_id', 'billing_cycle']);
        });

        // 3. Features Catalog
        Schema::create('features', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('type'); // 'boolean', 'limit', 'level'
            $table->string('group_name');
            $table->text('description')->nullable();
            $table->integer('sort')->default(0);
            $table->timestamps();
        });

        // 4. Plan Features Matrix
        Schema::create('plan_features', function (Blueprint $table) {
            $table->foreignId('plan_id')->constrained('plans')->cascadeOnDelete();
            $table->string('feature_key');
            $table->boolean('bool_value')->nullable();
            $table->integer('limit_value')->nullable(); // NULL = unlimited
            $table->string('level_value')->nullable();
            $table->timestamps();

            $table->primary(['plan_id', 'feature_key']);
            $table->foreign('feature_key')->references('key')->on('features')->cascadeOnDelete();
        });

        // 5. Addons
        Schema::create('addons', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('feature_key');
            $table->integer('extra_limit');
            $table->decimal('price', 12, 2);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('feature_key')->references('key')->on('features')->cascadeOnDelete();
        });

        // 6. Tenant Addons
        Schema::create('tenant_addons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('addon_id')->constrained('addons')->cascadeOnDelete();
            $table->integer('quantity')->default(1);
            $table->timestamp('starts_at');
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'addon_id']);
        });

        // 7. Subscriptions
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('plans')->cascadeOnDelete();
            $table->string('billing_cycle')->default('monthly'); // 'monthly', 'yearly'
            $table->string('status'); // 'trial','active','grace','read_only','archived','pending_delete','cancelled'
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('grace_until')->nullable();
            $table->timestamp('read_only_since')->nullable();
            $table->timestamp('archive_at')->nullable();
            $table->timestamp('data_delete_after')->nullable();
            $table->timestamp('converted_at')->nullable();
            $table->integer('trial_extended_count')->default(0);
            $table->boolean('auto_renew')->default(false);
            $table->timestamps();

            $table->index(['tenant_id', 'status', 'ends_at']);
        });

        // 8. Subscription Events
        Schema::create('subscription_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('subscription_id')->constrained('subscriptions')->cascadeOnDelete();
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->text('reason')->nullable();
            $table->string('actor_type')->nullable();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_id', 'subscription_id']);
        });

        // 9. Tenant Overrides
        Schema::create('tenant_overrides', function (Blueprint $table) {
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('feature_key');
            $table->boolean('bool_value')->nullable();
            $table->integer('limit_value')->nullable();
            $table->string('level_value')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->primary(['tenant_id', 'feature_key']);
            $table->foreign('feature_key')->references('key')->on('features')->cascadeOnDelete();
        });

        // 10. Usage Counters (monthly period counters: bills, SMS)
        Schema::create('usage_counters', function (Blueprint $table) {
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('feature_key');
            $table->string('period', 7); // 'YYYY-MM'
            $table->integer('used')->default(0);
            $table->timestamps();

            $table->primary(['tenant_id', 'feature_key', 'period']);
            $table->foreign('feature_key')->references('key')->on('features')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('usage_counters');
        Schema::dropIfExists('tenant_overrides');
        Schema::dropIfExists('subscription_events');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('tenant_addons');
        Schema::dropIfExists('addons');
        Schema::dropIfExists('plan_features');
        Schema::dropIfExists('features');
        Schema::dropIfExists('plan_prices');
        Schema::dropIfExists('plans');
    }
};

