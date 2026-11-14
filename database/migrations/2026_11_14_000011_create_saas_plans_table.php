<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('saas_plans', function (Blueprint $table): void {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->char('currency_code', 3)->default('USD');
            $table->decimal('monthly_price', 12, 2)->default(0);
            $table->decimal('annual_price', 12, 2)->default(0);
            $table->unsignedSmallInteger('trial_days')->default(14);
            $table->unsignedInteger('max_pharmacies')->default(1);
            $table->unsignedInteger('max_branches')->default(1);
            $table->unsignedInteger('max_users')->default(5);
            $table->unsignedInteger('max_medicines')->default(1000);
            $table->unsignedInteger('storage_limit_mb')->nullable();
            $table->jsonb('features')->nullable();
            $table->boolean('is_popular')->default(false);
            $table->boolean('is_active')->default(true)->index();
            $table->boolean('is_public')->default(true)->index();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saas_plans');
    }
};

