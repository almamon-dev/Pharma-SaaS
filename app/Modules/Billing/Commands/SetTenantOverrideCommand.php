<?php

namespace App\Modules\Billing\Commands;

use App\Models\AuditLog;
use App\Models\Tenant;
use App\Modules\Billing\Events\OverrideChanged;
use App\Modules\Billing\Models\Feature;
use App\Modules\Billing\Models\TenantOverride;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SetTenantOverrideCommand extends Command
{
    protected $signature = 'tenant:set-override
                            {tenant : The ID or slug of the tenant}
                            {feature : The feature key to override}
                            {value : The boolean (true/false), limit (number), or level string}
                            {--expires= : Optional ISO expiration date (e.g. 2026-12-31)}
                            {--note= : Note explaining why the override was granted}';

    protected $description = 'Set a custom feature or limit override for a pharmacy tenant';

    public function handle(): int
    {
        $tenantInput = $this->argument('tenant');
        $featureKey = $this->argument('feature');
        $value = (string) $this->argument('value');
        $expiresInput = $this->option('expires');
        $note = $this->option('note') ?: 'Manual override via Artisan';

        $tenant = is_numeric($tenantInput)
            ? Tenant::find($tenantInput)
            : Tenant::where('slug', $tenantInput)->orWhere('name', $tenantInput)->first();

        if (! $tenant) {
            $this->error("Tenant '{$tenantInput}' not found.");
            return 1;
        }

        $feature = Feature::find($featureKey);
        if (! $feature) {
            $this->error("Feature '{$featureKey}' not found in catalog.");
            return 1;
        }

        $expiresAt = ! empty($expiresInput) ? Carbon::parse($expiresInput) : null;

        $boolValue = null;
        $limitValue = null;
        $levelValue = null;

        if ($feature->type === 'boolean') {
            $boolValue = filter_var($value, FILTER_VALIDATE_BOOLEAN);
        } elseif ($feature->type === 'limit') {
            $limitValue = is_numeric($value) ? (int) $value : null;
        } elseif ($feature->type === 'level') {
            $levelValue = trim($value);
        }

        $override = TenantOverride::withoutGlobalScopes()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'feature_key' => $featureKey],
            [
                'bool_value' => $boolValue,
                'limit_value' => $limitValue,
                'level_value' => $levelValue,
                'expires_at' => $expiresAt,
                'note' => $note,
                'created_by' => null,
            ]
        );

        AuditLog::record(
            action: 'billing.override_set',
            description: "Set override for feature {$featureKey} on {$tenant->name}.",
            subject: $override,
            metadata: [
                'feature' => $featureKey,
                'type' => $feature->type,
                'value' => $value,
                'expires_at' => $expiresAt?->toIso8601String(),
                'note' => $note,
            ],
            tenantId: $tenant->id,
        );

        OverrideChanged::dispatch($tenant->id, $featureKey);

        $this->info("Successfully set override on {$tenant->name} for {$featureKey} = {$value} (Type: {$feature->type}).");

        return 0;
    }
}

