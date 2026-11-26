<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Providers;

use App\Modules\Foundation\Application\Ports\AuditLogger;
use App\Modules\Inventory\Application\Ports\BatchRepository;
use App\Modules\Inventory\Application\Ports\MedicineBarcodeChecker;
use App\Modules\Inventory\Application\Ports\StockMovementWriter;
use App\Modules\Inventory\Application\StockControlWorkflow;
use App\Modules\Inventory\Domain\StockAdjustmentPolicy;
use App\Modules\Inventory\Domain\StockTransferPolicy;
use App\Modules\Inventory\Infrastructure\Persistence\EloquentBatchRepository;
use App\Modules\Inventory\Infrastructure\Persistence\EloquentMedicineBarcodeChecker;
use App\Modules\Inventory\Infrastructure\Persistence\EloquentStockMovementWriter;
use Illuminate\Support\ServiceProvider;
use PharmaCore\Foundation\Application\Clock;
use PharmaCore\Foundation\Application\TransactionManager;

final class InventoryServiceProvider extends ServiceProvider
{
    /** @var array<class-string, class-string> */
    public array $bindings = [
        BatchRepository::class => EloquentBatchRepository::class,
        StockMovementWriter::class => EloquentStockMovementWriter::class,
        MedicineBarcodeChecker::class => EloquentMedicineBarcodeChecker::class,
    ];

    public function register(): void
    {
        $this->app->singleton(StockAdjustmentPolicy::class);
        $this->app->singleton(StockTransferPolicy::class);
        $this->app->singleton(
            StockControlWorkflow::class,
            static fn ($app): StockControlWorkflow => new StockControlWorkflow(
                batches: $app->make(BatchRepository::class),
                movements: $app->make(StockMovementWriter::class),
                barcodeChecker: $app->make(MedicineBarcodeChecker::class),
                adjustmentPolicy: $app->make(StockAdjustmentPolicy::class),
                transferPolicy: $app->make(StockTransferPolicy::class),
                transactions: $app->make(TransactionManager::class),
                auditLogger: $app->make(AuditLogger::class),
                clock: $app->make(Clock::class),
            )
        );
    }
}

