<?php

use App\Modules\Billing\Providers\BillingServiceProvider;
use App\Modules\CashCounter\Providers\CashCounterServiceProvider;
use App\Modules\Catalog\Providers\CatalogServiceProvider;
use App\Modules\Core\Providers\CoreServiceProvider;
use App\Modules\CRM\Providers\CrmServiceProvider;
use App\Modules\Foundation\Providers\FoundationServiceProvider;
use App\Modules\Inventory\Providers\InventoryServiceProvider;
use App\Modules\Sales\Providers\SalesServiceProvider;
use App\Providers\AppServiceProvider;

return [
    AppServiceProvider::class,
    FoundationServiceProvider::class,
    CoreServiceProvider::class,
    BillingServiceProvider::class,
    CatalogServiceProvider::class,
    CrmServiceProvider::class,
    InventoryServiceProvider::class,
    CashCounterServiceProvider::class,
    SalesServiceProvider::class,
];
