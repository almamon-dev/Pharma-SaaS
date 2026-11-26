<?php

declare(strict_types=1);

namespace App\Modules\CRM\Providers;

use App\Modules\CRM\Application\CrmWorkflow;
use App\Modules\CRM\Application\Ports\CustomerRepository;
use App\Modules\CRM\Application\Ports\SupplierRepository;
use App\Modules\CRM\Infrastructure\Persistence\EloquentCustomerRepository;
use App\Modules\CRM\Infrastructure\Persistence\EloquentSupplierRepository;
use App\Modules\Foundation\Application\Ports\AuditLogger;
use Illuminate\Support\ServiceProvider;

final class CrmServiceProvider extends ServiceProvider
{
    /** @var array<class-string, class-string> */
    public array $bindings = [
        CustomerRepository::class => EloquentCustomerRepository::class,
        SupplierRepository::class => EloquentSupplierRepository::class,
    ];

    public function register(): void
    {
        $this->app->singleton(
            CrmWorkflow::class,
            static fn ($app): CrmWorkflow => new CrmWorkflow(
                customers: $app->make(CustomerRepository::class),
                suppliers: $app->make(SupplierRepository::class),
                auditLogger: $app->make(AuditLogger::class),
            )
        );
    }
}

