<?php

declare(strict_types=1);

namespace App\Modules\Foundation\Providers;

use App\Models\Branch;
use App\Models\Counter;
use App\Models\CounterBreakLog;
use App\Models\CounterCashMovement;
use App\Models\CounterSession;
use App\Models\Customer;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Sale;
use App\Models\Supplier;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Foundation\Application\Ports\AuditLogger;
use App\Modules\Foundation\Application\Ports\SequenceNumberGenerator;
use App\Modules\Foundation\Application\Ports\TenantContextReader;
use App\Modules\Foundation\Infrastructure\Context\LaravelTenantContextReader;
use App\Modules\Foundation\Infrastructure\Persistence\EloquentAuditLogger;
use App\Modules\Foundation\Infrastructure\Persistence\EloquentSequenceNumberGenerator;
use App\Modules\Foundation\Infrastructure\Persistence\LaravelTransactionManager;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;
use PharmaCore\Foundation\Application\Clock;
use PharmaCore\Foundation\Application\IdGenerator;
use PharmaCore\Foundation\Application\TransactionManager;
use PharmaCore\Foundation\Infrastructure\RandomUuidGenerator;
use PharmaCore\Foundation\Infrastructure\SystemClock;

final class FoundationServiceProvider extends ServiceProvider
{
    /** @var array<class-string, class-string> */
    public array $bindings = [
        IdGenerator::class => RandomUuidGenerator::class,
        TransactionManager::class => LaravelTransactionManager::class,
        AuditLogger::class => EloquentAuditLogger::class,
        SequenceNumberGenerator::class => EloquentSequenceNumberGenerator::class,
        TenantContextReader::class => LaravelTenantContextReader::class,
    ];

    public function register(): void
    {
        $this->app->singleton(
            Clock::class,
            fn (): Clock => new SystemClock((string) config('app.timezone', 'UTC'))
        );
    }

    public function boot(): void
    {
        // Canonical morph map preserving backward compatibility with existing
        // audit_logs.auditable_type and stock_movements.reference_type rows
        // as models migrate into Clean Architecture modules.
        Relation::morphMap([
            'App\\Models\\Tenant' => Tenant::class,
            'App\\Models\\Branch' => Branch::class,
            'App\\Models\\User' => User::class,
            'App\\Models\\Customer' => Customer::class,
            'App\\Models\\Supplier' => Supplier::class,
            'App\\Models\\Medicine' => Medicine::class,
            'App\\Models\\MedicineBatch' => MedicineBatch::class,
            'App\\Models\\Sale' => Sale::class,
            'App\\Models\\Counter' => Counter::class,
            'App\\Models\\CounterSession' => CounterSession::class,
            'App\\Models\\CounterBreakLog' => CounterBreakLog::class,
            'App\\Models\\CounterCashMovement' => CounterCashMovement::class,
        ]);
    }
}

