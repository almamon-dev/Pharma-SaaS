<?php

declare(strict_types=1);

namespace PharmaCore\Foundation\Infrastructure;

use DateTimeImmutable;
use DateTimeZone;
use PharmaCore\Foundation\Application\Clock;

final class SystemClock implements Clock
{
    public function __construct(
        private readonly string $timezone = 'UTC',
    ) {}

    public function now(): DateTimeImmutable
    {
        return new DateTimeImmutable('now', new DateTimeZone($this->timezone));
    }
}

