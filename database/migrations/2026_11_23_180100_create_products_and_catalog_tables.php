<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Categories
        Schema::create('categories', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->uuid('parent_id')->nullable()->index();
            $table->string('name');
            $table->string('name_bn')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('categories', function (Blueprint $table): void {
            $table->foreign('parent_id')->references('id')->on('categories')->nullOnDelete();
        });

        // 2. Companies / Manufacturers
        Schema::create('companies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('name');
            $table->string('name_bn')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 3. Generics
        Schema::create('generics', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 4. Products
        Schema::create('products', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('type')->default('medicine'); // 'medicine', 'non_medicine'
            $table->string('name');
            $table->string('name_bn')->nullable();
            $table->uuid('generic_id')->nullable()->index();
            $table->uuid('company_id')->nullable()->index();
            $table->uuid('category_id')->nullable()->index();
            $table->string('strength')->nullable();
            $table->string('dosage_form')->nullable();
            $table->string('sku')->nullable()->index();
            $table->text('description')->nullable();
            $table->string('base_unit')->default('pcs');
            $table->boolean('track_batch')->default(true);
            $table->boolean('is_controlled')->default(false);
            $table->string('default_discount_type')->nullable(); // 'percent', 'fixed'
            $table->decimal('default_discount_value', 12, 2)->default(0);
            $table->decimal('vat_rate', 5, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->uuid('import_job_id')->nullable()->index();
            $table->string('dedupe_key');
            $table->text('search_text');
            $table->softDeletes();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'sku']);
            $table->index(['tenant_id', 'name']);
            $table->index(['tenant_id', 'is_active']);

            $table->foreign('generic_id')->references('id')->on('generics')->nullOnDelete();
            $table->foreign('company_id')->references('id')->on('companies')->nullOnDelete();
            $table->foreign('category_id')->references('id')->on('categories')->nullOnDelete();
        });

        // 5. Product Units
        Schema::create('product_units', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->uuid('product_id')->index();
            $table->string('unit_name');
            $table->unsignedInteger('conversion_to_base')->default(1);
            $table->boolean('is_sale_unit')->default(true);
            $table->boolean('is_purchase_unit')->default(true);
            $table->boolean('is_default_sale')->default(false);
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });

        // 6. Product Barcodes
        Schema::create('product_barcodes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->uuid('product_id')->index();
            $table->string('barcode');
            $table->string('source')->default('manufacturer'); // 'manufacturer', 'internal'
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });

        // 7. Product Branch Settings
        Schema::create('product_branch_settings', function (Blueprint $table): void {
            $table->unsignedBigInteger('tenant_id')->index();
            $table->uuid('product_id');
            $table->unsignedBigInteger('branch_id');
            $table->integer('min_stock')->default(0);
            $table->integer('reorder_qty')->default(0);
            $table->string('shelf_location')->nullable();
            $table->timestamps();

            $table->primary(['product_id', 'branch_id']);
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            $table->foreign('branch_id')->references('id')->on('branches')->cascadeOnDelete();
        });

        // 8. Product Discount Rules
        Schema::create('product_discount_rules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('scope'); // 'product', 'category', 'company'
            $table->uuid('scope_id')->index();
            $table->string('type'); // 'percent', 'fixed'
            $table->decimal('value', 12, 2)->default(0);
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('note')->nullable();
            $table->timestamps();
        });

        // 9. Import Jobs
        Schema::create('import_jobs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('type')->default('products');
            $table->string('file_path');
            $table->string('original_name');
            $table->string('mode')->default('create_only'); // 'create_only', 'create_or_update'
            $table->string('status')->default('uploaded'); // 'uploaded', 'mapped', 'previewed', 'processing', 'done', 'failed', 'undone', 'cancelled'
            $table->jsonb('column_map')->nullable();
            $table->integer('total_rows')->default(0);
            $table->integer('ok_rows')->default(0);
            $table->integer('skipped_rows')->default(0);
            $table->integer('error_rows')->default(0);
            $table->integer('created_count')->default(0);
            $table->integer('updated_count')->default(0);
            $table->string('limit_note')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamp('undo_until')->nullable();
            $table->timestamp('undone_at')->nullable();
            $table->timestamps();
        });

        // 10. Import Job Errors
        Schema::create('import_job_errors', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->uuid('import_job_id')->index();
            $table->integer('row_no');
            $table->string('field')->nullable();
            $table->text('message');
            $table->jsonb('row_data')->nullable();
            $table->timestamps();

            $table->foreign('import_job_id')->references('id')->on('import_jobs')->cascadeOnDelete();
        });

        // Database specific indexes and constraints
        if (DB::getDriverName() === 'pgsql') {
            // Category case-insensitive unique constraints
            DB::statement('CREATE UNIQUE INDEX categories_tenant_root_name_uidx ON categories (tenant_id, lower(name)) WHERE parent_id IS NULL;');
            DB::statement('CREATE UNIQUE INDEX categories_tenant_parent_name_uidx ON categories (tenant_id, parent_id, lower(name)) WHERE parent_id IS NOT NULL;');

            // Company & Generic case-insensitive unique constraints
            DB::statement('CREATE UNIQUE INDEX companies_tenant_name_uidx ON companies (tenant_id, lower(name));');
            DB::statement('CREATE UNIQUE INDEX generics_tenant_name_uidx ON generics (tenant_id, lower(name));');

            // Product dedupe & SKU partial unique indexes
            DB::statement('CREATE UNIQUE INDEX products_tenant_dedupe_key_uidx ON products (tenant_id, dedupe_key) WHERE deleted_at IS NULL;');
            DB::statement('CREATE UNIQUE INDEX products_tenant_sku_uidx ON products (tenant_id, sku) WHERE sku IS NOT NULL AND deleted_at IS NULL;');

            // Product check constraints
            DB::statement("ALTER TABLE products ADD CONSTRAINT products_type_check CHECK (type IN ('medicine', 'non_medicine'));");
            DB::statement("ALTER TABLE products ADD CONSTRAINT products_discount_check CHECK (default_discount_value >= 0);");
            DB::statement("ALTER TABLE products ADD CONSTRAINT products_discount_percent_check CHECK (default_discount_type != 'percent' OR default_discount_value <= 100);");

            // Product units unique per product and conversion check
            DB::statement('CREATE UNIQUE INDEX product_units_product_unit_uidx ON product_units (product_id, lower(unit_name));');
            DB::statement('ALTER TABLE product_units ADD CONSTRAINT product_units_conversion_check CHECK (conversion_to_base > 0);');

            // Product barcode unique per tenant
            DB::statement('CREATE UNIQUE INDEX product_barcodes_tenant_barcode_uidx ON product_barcodes (tenant_id, barcode);');

            // Trigram GIN index for search_text with tenant isolation
            DB::statement('CREATE INDEX products_search_text_trgm_idx ON products USING gin (tenant_id, search_text gin_trgm_ops);');

            // Additional composite query indexes
            DB::statement('CREATE INDEX products_tenant_active_idx ON products (tenant_id, is_active);');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('import_job_errors');
        Schema::dropIfExists('import_jobs');
        Schema::dropIfExists('product_discount_rules');
        Schema::dropIfExists('product_branch_settings');
        Schema::dropIfExists('product_barcodes');
        Schema::dropIfExists('product_units');
        Schema::dropIfExists('products');
        Schema::dropIfExists('generics');
        Schema::dropIfExists('companies');
        Schema::dropIfExists('categories');
    }
};
