<?php

namespace App\Modules\Catalog\Jobs;

use App\Models\Tenant;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Services\ProductSearchIndexer;
use App\Tenancy\CurrentTenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class RefreshProductSearchText implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public int $tenantId,
        public string $masterType, // 'company', 'generic', 'category'
        public string $masterId
    ) {}

    public function handle(CurrentTenant $currentTenant): void
    {
        $tenant = Tenant::withoutGlobalScopes()->find($this->tenantId);
        if (! $tenant) {
            return;
        }

        $currentTenant->run($tenant, function () {
            $column = match ($this->masterType) {
                'company' => 'company_id',
                'generic' => 'generic_id',
                'category' => 'category_id',
                default => null,
            };

            if (! $column) {
                return;
            }

            $products = Product::withoutGlobalScopes()
                ->where('tenant_id', $this->tenantId)
                ->where($column, $this->masterId)
                ->whereNull('deleted_at')
                ->with(['generic', 'company', 'category'])
                ->get();

            foreach ($products as $product) {
                $product->search_text = ProductSearchIndexer::build($product);
                $product->saveQuietly();
            }
        });
    }
}

