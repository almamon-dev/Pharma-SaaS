<?php

declare(strict_types=1);

namespace PharmaCore\Foundation\Application;

interface TransactionManager
{
    /**
     * Execute the given callback atomically within a database transaction.
     *
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function run(callable $callback): mixed;
}

