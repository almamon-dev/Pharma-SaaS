<?php

declare(strict_types=1);

namespace PharmaCore\Foundation\Application;

interface IdGenerator
{
    public function nextId(): string;
}

