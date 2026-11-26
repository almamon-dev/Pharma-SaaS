<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('saas_plans', function (Blueprint $table): void {
            $table->string('name_bn')->nullable()->after('name');
            $table->text('description_bn')->nullable()->after('description');
            $table->jsonb('features_bn')->nullable()->after('features');
        });
    }

    public function down(): void
    {
        Schema::table('saas_plans', function (Blueprint $table): void {
            $table->dropColumn(['name_bn', 'description_bn', 'features_bn']);
        });
    }
};

