<?php

use App\Http\Middleware\EnsureActiveSubscription;
use App\Http\Middleware\EnsureSuperAdmin;
use App\Http\Middleware\EnsureTenantContext;
use App\Http\Middleware\EnsureTenantFeature;
use App\Http\Middleware\EnsureTenantRole;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\IdentifyTenantFromDomain;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
        $middleware->web(append: [
            IdentifyTenantFromDomain::class,
            HandleInertiaRequests::class,
        ]);

        $middleware->alias([
            'super_admin' => EnsureSuperAdmin::class,
            'subscription.active' => EnsureActiveSubscription::class,
            'tenant' => EnsureTenantContext::class,
            'tenant.role' => EnsureTenantRole::class,
            'feature' => EnsureTenantFeature::class,
        ]);

        $middleware->redirectGuestsTo(fn (Request $request): string => (
            $request->attributes->get(IdentifyTenantFromDomain::ADMIN_ATTRIBUTE)
            || $request->attributes->has(IdentifyTenantFromDomain::REQUEST_ATTRIBUTE)
        ) ? route('login') : route('welcome'));
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
