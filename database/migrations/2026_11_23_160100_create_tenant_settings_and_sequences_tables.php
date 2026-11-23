<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tenant_settings')) {
            Schema::create('tenant_settings', function (Blueprint $table) {
                $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
                $table->string('key', 100);
                $table->jsonb('value');
                $table->timestamps();

                $table->primary(['tenant_id', 'key']);
            });
        }

        if (! Schema::hasTable('document_sequences')) {
            Schema::create('document_sequences', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
                $table->foreignId('branch_id')->nullable()->constrained('branches')->cascadeOnDelete();
                $table->string('doc_type', 50);
                $table->string('prefix', 30)->nullable();
                $table->unsignedBigInteger('next_number')->default(1);
                $table->timestamps();

                $table->unique(['tenant_id', 'branch_id', 'doc_type'], 'doc_sequences_tenant_branch_type_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('document_sequences');
        Schema::dropIfExists('tenant_settings');
    }
};

