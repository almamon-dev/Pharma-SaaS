<?php

declare(strict_types=1);

namespace PharmaCore\Foundation\Domain;

use RuntimeException;

/**
 * Framework-free domain problem exception carrying machine code, HTTP status hint, and field key.
 */
class DomainProblem extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $statusCode = 422,
        public readonly string $field = 'domain',
    ) {
        parent::__construct($message, $statusCode);
    }
}

