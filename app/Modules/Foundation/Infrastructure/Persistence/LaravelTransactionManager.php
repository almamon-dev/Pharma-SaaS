<?php

declare(strict_types=1);

namespace App\Modules\Foundation\Infrastructure\Persistence;

use Illuminate\Support\Facades\DB;
use PharmaCore\Foundation\Application\TransactionManager;

final class LaravelTransactionManager implements TransactionManager
{
    public function run(callable $callback): mixed
    {
        return DB::transaction($callback);
    }
}

