<?php

namespace App\Modules\Billing\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class FeatureLockedException extends Exception
{
    public function __construct(
        public readonly string $featureKey,
        string $message = '',
        public readonly string $upgradeUrl = '/billing/plans',
        int $code = 403,
        ?Exception $previous = null
    ) {
        $msg = $message ?: "The feature '{$featureKey}' is not available on your current plan.";
        parent::__construct($msg, $code, $previous);
    }

    public function render(Request $request): Response
    {
        return response()->json([
            'error' => 'feature_locked',
            'feature' => $this->featureKey,
            'message' => $this->getMessage(),
            'upgrade_url' => $this->upgradeUrl,
        ], 403);
    }
}
