<?php

declare(strict_types=1);

namespace App\Modules\Sales\Providers;

use App\Modules\Foundation\Application\Ports\AuditLogger;
use App\Modules\Sales\Application\Ports\CounterQueuePort;
use App\Modules\Sales\Application\Ports\CustomerLoyaltyPort;
use App\Modules\Sales\Application\Ports\SalesEventPublisher;
use App\Modules\Sales\Application\Ports\SalesOrderRepository;
use App\Modules\Sales\Application\Ports\StockAllocationPort;
use App\Modules\Sales\Application\SalesOrderWorkflow;
use App\Modules\Sales\Domain\DiscountApprovalPolicy;
use App\Modules\Sales\Domain\OrderStatusTransitionPolicy;
use App\Modules\Sales\Infrastructure\Events\LaravelSalesEventPublisher;
use App\Modules\Sales\Infrastructure\Persistence\EloquentCounterQueueAdapter;
use App\Modules\Sales\Infrastructure\Persistence\EloquentCustomerLoyaltyAdapter;
use App\Modules\Sales\Infrastructure\Persistence\EloquentSalesOrderRepository;
use App\Modules\Sales\Infrastructure\Persistence\FefoStockAllocationAdapter;
use Illuminate\Support\ServiceProvider;
use PharmaCore\Foundation\Application\Clock;
use PharmaCore\Foundation\Application\TransactionManager;

final class SalesServiceProvider extends ServiceProvider
{
    /** @var array<class-string, class-string> */
    public array $bindings = [
        SalesOrderRepository::class => EloquentSalesOrderRepository::class,
        StockAllocationPort::class => FefoStockAllocationAdapter::class,
        CounterQueuePort::class => EloquentCounterQueueAdapter::class,
        CustomerLoyaltyPort::class => EloquentCustomerLoyaltyAdapter::class,
        SalesEventPublisher::class => LaravelSalesEventPublisher::class,
    ];

    public function register(): void
    {
        $this->app->singleton(DiscountApprovalPolicy::class);
        $this->app->singleton(OrderStatusTransitionPolicy::class);
        $this->app->singleton(
            SalesOrderWorkflow::class,
            static fn ($app): SalesOrderWorkflow => new SalesOrderWorkflow(
                orders: $app->make(SalesOrderRepository::class),
                stockAllocation: $app->make(StockAllocationPort::class),
                counterQueue: $app->make(CounterQueuePort::class),
                customerLoyalty: $app->make(CustomerLoyaltyPort::class),
                events: $app->make(SalesEventPublisher::class),
                discountPolicy: $app->make(DiscountApprovalPolicy::class),
                statusPolicy: $app->make(OrderStatusTransitionPolicy::class),
                transactions: $app->make(TransactionManager::class),
                auditLogger: $app->make(AuditLogger::class),
                clock: $app->make(Clock::class),
            )
        );
    }
}

