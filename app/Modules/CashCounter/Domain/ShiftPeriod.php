<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Domain;

enum ShiftPeriod: string
{
    case MORNING = 'morning';
    case EVENING = 'evening';
    case NIGHT = 'night';

    public static function detectFromHour(int $hour): self
    {
        if ($hour < 14) {
            return self::MORNING;
        }

        if ($hour < 21) {
            return self::EVENING;
        }

        return self::NIGHT;
    }
}

