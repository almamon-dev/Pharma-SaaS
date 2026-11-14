<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('saas_plan_modules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('saas_plan_id')->constrained('saas_plans')->cascadeOnDelete();
            $table->foreignId('module_id')->constrained('modules')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['saas_plan_id', 'module_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saas_plan_modules');
    }
};

