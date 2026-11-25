<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('counter_sessions', function (Blueprint $table): void {
            if (! Schema::hasColumn('counter_sessions', 'opening_denominations')) {
                $table->jsonb('opening_denominations')->nullable()->after('opening_float');
            }
            if (! Schema::hasColumn('counter_sessions', 'is_force_closed')) {
                $table->boolean('is_force_closed')->default(false)->after('closed_by');
            }
            if (! Schema::hasColumn('counter_sessions', 'force_close_reason')) {
                $table->text('force_close_reason')->nullable()->after('is_force_closed');
            }
        });
    }

    public function down(): void
    {
        Schema::table('counter_sessions', function (Blueprint $table): void {
            $columns = array_filter(
                ['opening_denominations', 'is_force_closed', 'force_close_reason'],
                fn (string $col) => Schema::hasColumn('counter_sessions', $col)
            );
            if (! empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
};
