<?php

namespace App\Enums;

enum BatchStatus: string
{
    case ACTIVE = 'active';
    case DEPLETED = 'depleted';
    case EXPIRED = 'expired';
    case DAMAGED = 'damaged';
    case DISPOSED = 'disposed';

    public function label(): string
    {
        return match ($this) {
            self::ACTIVE => 'Active',
            self::DEPLETED => 'Depleted',
            self::EXPIRED => 'Expired',
            self::DAMAGED => 'Damaged',
            self::DISPOSED => 'Disposed',
        };
    }

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $case) => $case->value, self::cases());
    }
}

