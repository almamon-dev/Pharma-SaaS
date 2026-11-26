<?php

namespace App\Modules\Billing\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LimitReachedException extends Exception
{
    public function __construct(
        public readonly string $featureKey,
        public readonly int $limit,
        public readonly int $used,
        string $message = '',
        public readonly string $upgradeUrl = '/billing/plans',
        int $code = 403,
        ?Exception $previous = null
    ) {
        $msg = $message ?: "Usage limit of {$limit} reached for '{$featureKey}' (currently using {$used}).";
        parent::__construct($msg, $code, $previous);
    }

    public function render(Request $request): Response
    {
        return response()->json([
            'error' => 'limit_reached',
            'feature' => $this->featureKey,
            'limit' => $this->limit,
            'used' => $this->used,
            'message' => $this->getMessage(),
            'upgrade_url' => $this->upgradeUrl,
        ], 403);
    }
}
