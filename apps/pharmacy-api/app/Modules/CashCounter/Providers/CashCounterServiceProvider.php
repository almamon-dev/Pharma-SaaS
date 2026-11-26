<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Providers;

use App\Modules\CashCounter\Application\CashCounterShiftWorkflow;
use App\Modules\CashCounter\Application\Ports\CounterRepository;
use App\Modules\CashCounter\Application\Ports\ShiftSessionRepository;
use App\Modules\CashCounter\Application\Ports\UnassignedOrderDispatcher;
use App\Modules\CashCounter\Infrastructure\Persistence\CounterAssignmentOrderDispatcher;
use App\Modules\CashCounter\Infrastructure\Persistence\EloquentCounterRepository;
use App\Modules\CashCounter\Infrastructure\Persistence\EloquentShiftSessionRepository;
use App\Modules\Foundation\Application\Ports\AuditLogger;
use App\Modules\Foundation\Application\Ports\SequenceNumberGenerator;
use Illuminate\Support\ServiceProvider;
use PharmaCore\Foundation\Application\Clock;
use PharmaCore\Foundation\Application\TransactionManager;

final class CashCounterServiceProvider extends ServiceProvider
{
    /** @var array<class-string, class-string> */
    public array $bindings = [
        CounterRepository::class => EloquentCounterRepository::class,
        ShiftSessionRepository::class => EloquentShiftSessionRepository::class,
        UnassignedOrderDispatcher::class => CounterAssignmentOrderDispatcher::class,
    ];

    public function register(): void
    {
        $this->app->singleton(
            CashCounterShiftWorkflow::class,
            static fn ($app): CashCounterShiftWorkflow => new CashCounterShiftWorkflow(
                counters: $app->make(CounterRepository::class),
                sessions: $app->make(ShiftSessionRepository::class),
                orderDispatcher: $app->make(UnassignedOrderDispatcher::class),
                transactions: $app->make(TransactionManager::class),
                auditLogger: $app->make(AuditLogger::class),
                sequenceGenerator: $app->make(SequenceNumberGenerator::class),
                clock: $app->make(Clock::class),
            )
        );
    }
}

