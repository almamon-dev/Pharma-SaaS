<?php

namespace App\Modules\Billing\Support;

use App\Models\Tenant;
use App\Modules\Billing\Models\Plan;
use App\Modules\Billing\Models\PlanFeature;
use App\Modules\Billing\Services\FeatureManager;

class PlanChangeImpact
{
    /**
     * @return array{
     *     is_downgrade: bool,
     *     over_limit_resources: array<string, array{resource: string, label: string, current_used: int, new_limit: int, difference: int}>,
     *     features_disabled: array<string, string>,
     *     levels_reduced: array<string, array{from: string, to: string}>,
     *     warnings: array<int, string>
     * }
     */
    public static function evaluate(Tenant $tenant, Plan $targetPlan): array
    {
        $featureManager = app(FeatureManager::class)->setTenant($tenant);
        $currentFeatures = $featureManager->all();

        $targetPlanFeatures = PlanFeature::with('feature')
            ->where('plan_id', $targetPlan->id)
            ->get()
            ->keyBy('feature_key');

        $isDowngrade = false;
        $overLimitResources = [];
        $featuresDisabled = [];
        $levelsReduced = [];
        $warnings = [];

        // 1. Evaluate Limit Resources
        $limitKeys = [
            'max_users' => 'Users / Staff',
            'max_branches' => 'Pharmacy Branches',
            'max_products' => 'Medicines / Products',
            'max_bills_month' => 'Monthly Bills',
        ];

        foreach ($limitKeys as $limitKey => $label) {
            $currentUsed = $featureManager->used($limitKey);
            $targetLimit = $targetPlanFeatures->has($limitKey)
                ? $targetPlanFeatures->get($limitKey)->limit_value
                : null; // null = unlimited

            if ($targetLimit !== null && $currentUsed > $targetLimit) {
                $isDowngrade = true;
                $diff = $currentUsed - $targetLimit;
                $overLimitResources[$limitKey] = [
                    'resource' => $limitKey,
                    'label' => $label,
                    'current_used' => $currentUsed,
                    'new_limit' => $targetLimit,
                    'difference' => $diff,
                ];

                $warnings[] = "You currently have {$currentUsed} {$label}; {$targetPlan->name} allows {$targetLimit}. Existing records remain preserved, but new {$label} cannot be added until usage is within limits.";
            }
        }

        // 2. Evaluate Boolean Features
        foreach ($currentFeatures as $key => $feature) {
            if ($feature['type'] !== 'boolean') {
                continue;
            }

            $currentVal = (bool) $feature['value'];
            $targetVal = $targetPlanFeatures->has($key)
                ? (bool) $targetPlanFeatures->get($key)->bool_value
                : false;

            if ($currentVal && ! $targetVal) {
                $isDowngrade = true;
                $featuresDisabled[$key] = $feature['name'] ?? $key;
                $warnings[] = "Feature '{$feature['name']}' will be locked under the {$targetPlan->name} plan.";
            }
        }

        // 3. Evaluate Level Features
        $levelOrder = [
            'report_level' => ['basic' => 1, 'detailed' => 2, 'advanced' => 3],
            'accounts_level' => ['basic' => 1, 'full' => 2],
        ];

        foreach ($levelOrder as $levelKey => $hierarchy) {
            $currentLevel = $featureManager->level($levelKey) ?? 'basic';
            $targetLevel = $targetPlanFeatures->has($levelKey)
                ? ($targetPlanFeatures->get($levelKey)->level_value ?? 'basic')
                : 'basic';

            $currentRank = $hierarchy[$currentLevel] ?? 1;
            $targetRank = $hierarchy[$targetLevel] ?? 1;

            if ($targetRank < $currentRank) {
                $isDowngrade = true;
                $levelsReduced[$levelKey] = [
                    'from' => $currentLevel,
                    'to' => $targetLevel,
                ];
                $warnings[] = "Level for '{$levelKey}' will be reduced from {$currentLevel} to {$targetLevel}.";
            }
        }

        return [
            'is_downgrade' => $isDowngrade,
            'over_limit_resources' => $overLimitResources,
            'features_disabled' => $featuresDisabled,
            'levels_reduced' => $levelsReduced,
            'warnings' => $warnings,
        ];
    }
}

