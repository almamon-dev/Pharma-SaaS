<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicines', function (Blueprint $table): void {
            $table->unsignedInteger('units_per_strip')->default(1)->after('unit');
            $table->unsignedInteger('units_per_box')->default(1)->after('units_per_strip');
            $table->decimal('box_purchase_price', 12, 2)->nullable()->after('default_purchase_price');
            $table->decimal('box_selling_price', 12, 2)->nullable()->after('default_selling_price');
        });

        Schema::table('sale_items', function (Blueprint $table): void {
            $table->string('sale_unit', 16)->default('piece')->after('medicine_batch_id');
            $table->unsignedInteger('pack_size')->default(1)->after('sale_unit');
            $table->unsignedInteger('pack_quantity')->nullable()->after('pack_size');
        });
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table): void {
            $table->dropColumn(['sale_unit', 'pack_size', 'pack_quantity']);
        });

        Schema::table('medicines', function (Blueprint $table): void {
            $table->dropColumn([
                'units_per_strip',
                'units_per_box',
                'box_purchase_price',
                'box_selling_price',
            ]);
        });
    }
};

