<?php

declare(strict_types=1);

namespace PharmaCore\Foundation\Domain;

use InvalidArgumentException;

final readonly class OpaqueId
{
    public function __construct(
        public string $value,
    ) {
        if (trim($value) === '') {
            throw new InvalidArgumentException('Identifier cannot be empty.');
        }
    }

    public static function fromInt(int $id): self
    {
        if ($id <= 0) {
            throw new InvalidArgumentException('Numeric identifier must be positive.');
        }

        return new self((string) $id);
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}

