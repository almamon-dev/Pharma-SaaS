<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Providers;

use App\Modules\Catalog\Commands\SeedCatalogLoadTestCommand;
use App\Modules\Catalog\Contracts\ProductReferenceChecker;
use App\Modules\Catalog\Contracts\StockInfoProvider;
use App\Modules\Catalog\Services\DefaultProductReferenceChecker;
use App\Modules\Catalog\Services\NullStockInfoProvider;
use Illuminate\Support\ServiceProvider;

final class CatalogServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ProductReferenceChecker::class, DefaultProductReferenceChecker::class);
        $this->app->singleton(StockInfoProvider::class, NullStockInfoProvider::class);
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([
                SeedCatalogLoadTestCommand::class,
            ]);
        }
    }
}

