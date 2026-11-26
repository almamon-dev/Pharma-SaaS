<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('demo_roles', function (Blueprint $table): void {
            $table->id();
            $table->string('role_id', 50)->unique();
            $table->string('role_key', 50);
            $table->string('title_en', 120);
            $table->string('title_bn', 120)->nullable();
            $table->string('subtitle_en', 160);
            $table->string('subtitle_bn', 160)->nullable();
            $table->text('description_en')->nullable();
            $table->text('description_bn')->nullable();
            $table->string('email', 150);
            $table->json('tags_en')->nullable();
            $table->json('tags_bn')->nullable();
            $table->json('features_en')->nullable();
            $table->json('features_bn')->nullable();
            $table->json('restrictions_en')->nullable();
            $table->json('restrictions_bn')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('demo_roles');
    }
};

