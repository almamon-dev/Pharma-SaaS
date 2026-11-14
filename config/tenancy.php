<?php

$appHost = parse_url((string) env('APP_URL', 'http://localhost:8001'), PHP_URL_HOST);
$baseDomain = strtolower(ltrim(trim((string) env('TENANCY_BASE_DOMAIN', 'localhost')), '.')) ?: 'localhost';
$adminSubdomain = strtolower(trim((string) env('TENANCY_ADMIN_SUBDOMAIN', 'admin'))) ?: 'admin';

$configuredCentral = array_values(array_filter(array_map(
    static fn (string $domain): string => strtolower(trim($domain)),
    explode(',', (string) env('TENANCY_CENTRAL_DOMAINS', 'localhost,127.0.0.1,::1,pharmacore.test'))
)));

if ($appHost && ! in_array(strtolower($appHost), $configuredCentral, true)) {
    $configuredCentral[] = strtolower($appHost);
}

$configuredAdmin = array_values(array_filter(array_map(
    static fn (string $domain): string => strtolower(trim($domain)),
    explode(',', (string) env('TENANCY_ADMIN_DOMAINS', 'admin.localhost,admin.127.0.0.1.nip.io'))
)));

$primaryAdminHost = "{$adminSubdomain}.{$baseDomain}";
if (! in_array($primaryAdminHost, $configuredAdmin, true)) {
    array_unshift($configuredAdmin, $primaryAdminHost);
}

return [
    /*
    |--------------------------------------------------------------------------
    | Base Subdomain Host
    |--------------------------------------------------------------------------
    |
    | Subdomains provisioned automatically for pharmacy tenants append this
    | base domain (e.g. "demo.localhost" locally, "demo.127.0.0.1" if mapped,
    | or "demo.yourapp.com" in production).
    |
    */
    'base_domain' => $baseDomain,

    /*
    |--------------------------------------------------------------------------
    | Platform Owner (Super Admin) Subdomain & Domains
    |--------------------------------------------------------------------------
    |
    | Dedicated host(s) for the SaaS Business Owner (Platform Super Admin)
    | sign-in portal and management console.
    |
    */
    'admin_subdomain' => $adminSubdomain,
    'admin_domains' => $configuredAdmin,

    /*
    |--------------------------------------------------------------------------
    | Central Application Hosts
    |--------------------------------------------------------------------------
    |
    | Requests arriving on these hosts serve the central SaaS landing site,
    | registration flow, and workspace switcher rather than a single tenant.
    |
    */
    'central_domains' => $configuredCentral,
];
