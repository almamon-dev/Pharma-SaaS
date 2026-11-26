<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medicines', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('medicine_categories')->nullOnDelete();
            $table->string('name');
            $table->string('generic_name')->nullable();
            $table->string('manufacturer')->nullable();
            $table->string('sku', 64);
            $table->string('barcode', 100)->nullable();
            $table->string('dosage_form', 50)->default('Tablet');
            $table->string('strength', 64)->nullable();
            $table->string('unit', 32)->default('Pcs');
            $table->integer('reorder_level')->default(20);
            $table->boolean('requires_prescription')->default(false);
            $table->decimal('default_purchase_price', 12, 2)->default(0);
            $table->decimal('default_selling_price', 12, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'sku']);
            $table->index(['tenant_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medicines');
    }
};

