<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TenantDomain extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'domain',
        'type',
        'is_primary',
        'is_verified',
        'verified_at',
    ];

    protected function casts(): array
    {
        return [
            'is_primary' => 'boolean',
            'is_verified' => 'boolean',
            'verified_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public static function baseDomain(): string
    {
        $base = strtolower(ltrim(trim((string) config('tenancy.base_domain', 'localhost')), '.'));

        return $base !== '' ? $base : 'localhost';
    }

    public static function adminSubdomain(): string
    {
        $sub = strtolower(trim((string) config('tenancy.admin_subdomain', 'admin')));

        return $sub !== '' ? $sub : 'admin';
    }

    public static function adminDomain(): string
    {
        return static::adminSubdomain().'.'.static::baseDomain();
    }

    public static function isAdminHost(?string $host): bool
    {
        $normalized = static::stripPort($host);
        if ($normalized === '') {
            return false;
        }

        $configured = array_map(
            static fn (string $domain): string => strtolower(trim($domain)),
            (array) config('tenancy.admin_domains', [static::adminDomain()]),
        );

        return $normalized === static::adminDomain() || in_array($normalized, $configured, true);
    }

    public static function isReservedHost(?string $host): bool
    {
        return static::isCentralHost($host) || static::isAdminHost($host);
    }

    public static function stripPort(?string $host): string
    {
        return strtolower(trim((string) preg_replace('/:\d+$/', '', trim((string) $host))));
    }

    public static function isCentralHost(?string $host): bool
    {
        $normalized = static::stripPort($host);
        if ($normalized === '') {
            return true;
        }

        $central = array_map(
            static fn (string $domain): string => strtolower(trim($domain)),
            (array) config('tenancy.central_domains', ['localhost', '127.0.0.1', '::1', 'pharmacore.test']),
        );

        return in_array($normalized, $central, true);
    }

    public static function defaultSubdomain(string $slug): string
    {
        return strtolower(trim($slug)).'.'.static::baseDomain();
    }

    /**
     * Normalize either a full domain ("demo.localhost", "rx.clinic.com") or a
     * bare subdomain label ("demo") into a lowercase host without scheme/port/path.
     */
    public static function normalizeInput(?string $input): ?string
    {
        $raw = strtolower(trim((string) $input));
        if ($raw === '') {
            return null;
        }

        $raw = (string) preg_replace('#^https?://#i', '', $raw);
        $raw = explode('/', $raw, 2)[0];
        $host = static::stripPort($raw);
        $host = trim($host, '.');

        if ($host === '') {
            return null;
        }

        if (static::isReservedHost($host)) {
            return $host;
        }

        if (! str_contains($host, '.')) {
            return $host.'.'.static::baseDomain();
        }

        return $host;
    }

    public static function validateForAssignment(?string $rawDomain, ?Tenant $ignoringTenant = null): ?string
    {
        $normalized = static::normalizeInput($rawDomain);
        if ($normalized === null) {
            return null;
        }

        $isValidHost = preg_match(
            '/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:localhost|[a-z]{2,63})$/',
            $normalized,
        ) === 1;

        if (! $isValidHost || static::isIpLiteral($normalized)) {
            throw ValidationException::withMessages([
                'domain' => 'Enter a valid subdomain (e.g. demo or demo.'.static::baseDomain().') or custom domain (e.g. shop.yourpharmacy.com).',
            ]);
        }

        if (static::isReservedHost($normalized)) {
            throw ValidationException::withMessages([
                'domain' => 'That hostname is reserved for the central platform or Business Owner portal.',
            ]);
        }

        $alreadyTaken = static::query()
            ->whereRaw('LOWER(domain) = ?', [$normalized])
            ->when($ignoringTenant, fn ($q) => $q->where('tenant_id', '!=', $ignoringTenant->id))
            ->exists();

        if ($alreadyTaken) {
            throw ValidationException::withMessages([
                'domain' => "The domain \"{$normalized}\" is already assigned to another workspace.",
            ]);
        }

        return $normalized;
    }

    private static function isIpLiteral(string $host): bool
    {
        return filter_var($host, FILTER_VALIDATE_IP) !== false;
    }

    public static function urlForHost(string $host, ?Request $request = null, string $path = '/'): string
    {
        $scheme = $request?->getScheme()
            ?? parse_url((string) config('app.url'), PHP_URL_SCHEME)
            ?? 'http';

        $port = $request?->getPort();
        if (! $port || in_array($port, [80, 443], true)) {
            $appPort = parse_url((string) config('app.url'), PHP_URL_PORT);
            $port = $appPort ? (int) $appPort : null;
        }

        $portSuffix = $port && ! in_array($port, [80, 443], true) ? ":{$port}" : '';
        $normalizedPath = '/'.ltrim($path, '/');

        return "{$scheme}://{$host}{$portSuffix}".($normalizedPath === '/' ? '' : $normalizedPath);
    }

    public static function resolveType(string $domain): string
    {
        return str_ends_with($domain, '.'.static::baseDomain()) ? 'subdomain' : 'custom';
    }

    public static function setPrimaryForTenant(Tenant $tenant, ?string $domain = null, bool $replaceExistingPrimary = true): self
    {
        $target = static::normalizeInput($domain) ?? static::defaultSubdomain($tenant->slug);
        $attributes = [
            'tenant_id' => $tenant->id,
            'domain' => $target,
            'type' => static::resolveType($target),
            'is_primary' => true,
            'is_verified' => true,
            'verified_at' => now(),
        ];

        $existingPrimary = static::query()
            ->where('tenant_id', $tenant->id)
            ->where('is_primary', true)
            ->first();

        $existingTarget = static::query()
            ->whereRaw('LOWER(domain) = ?', [$target])
            ->first();

        if ($existingTarget && (int) $existingTarget->tenant_id === (int) $tenant->id) {
            if ($replaceExistingPrimary && $existingPrimary && $existingPrimary->id !== $existingTarget->id) {
                $existingPrimary->delete();
            } else {
                static::query()
                    ->where('tenant_id', $tenant->id)
                    ->where('id', '!=', $existingTarget->id)
                    ->where('is_primary', true)
                    ->update(['is_primary' => false]);
            }

            $existingTarget->update($attributes);

            return $existingTarget->fresh();
        }

        if ($replaceExistingPrimary && $existingPrimary) {
            $existingPrimary->update($attributes);

            return $existingPrimary->fresh();
        }

        static::query()
            ->where('tenant_id', $tenant->id)
            ->where('domain', '!=', $target)
            ->where('is_primary', true)
            ->update(['is_primary' => false]);

        return static::query()->updateOrCreate(
            ['domain' => $target],
            $attributes,
        );
    }
}

