<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            if (! Schema::hasColumn('products', 'mrp')) {
                $table->decimal('mrp', 12, 2)->default(0)->after('base_unit');
            }
            if (! Schema::hasColumn('products', 'selling_price')) {
                $table->decimal('selling_price', 12, 2)->default(0)->after('mrp');
            }
            if (! Schema::hasColumn('products', 'purchase_price')) {
                $table->decimal('purchase_price', 12, 2)->default(0)->after('selling_price');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $columns = [];
            foreach (['mrp', 'selling_price', 'purchase_price'] as $col) {
                if (Schema::hasColumn('products', $col)) {
                    $columns[] = $col;
                }
            }
            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};

