<?php

namespace App\Modules\Billing\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SubscriptionReadOnlyException extends Exception
{
    public function __construct(
        string $message = '',
        public readonly string $billingUrl = '/billing',
        int $code = 403,
        ?Exception $previous = null
    ) {
        $msg = $message ?: 'Your workspace subscription is in read-only mode. Renew or upgrade to modify data.';
        parent::__construct($msg, $code, $previous);
    }

    public function render(Request $request): Response
    {
        return response()->json([
            'error' => 'subscription_read_only',
            'message' => $this->getMessage(),
            'billing_url' => $this->billingUrl,
        ], 403);
    }
}
