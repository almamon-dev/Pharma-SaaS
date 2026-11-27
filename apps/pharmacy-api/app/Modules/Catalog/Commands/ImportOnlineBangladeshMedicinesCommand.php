<?php

namespace App\Modules\Catalog\Commands;

use App\Models\Tenant;
use App\Modules\Catalog\Services\BangladeshCatalogImportService;
use App\Tenancy\CurrentTenant;
use Illuminate\Console\Command;

class ImportOnlineBangladeshMedicinesCommand extends Command
{
    protected $signature = 'catalog:import-bd-medicines
        {--tenant= : Tenant ID, slug, or domain (defaults to first active tenant)}
        {--all : Import into all active tenants}
        {--limit=0 : Maximum products to import (0 = all available ~33,000+)}
        {--refresh-cache : Re-download remote CSV/JSON datasets even if cached locally}';

    protected $description = 'Download and import 30,000+ real Bangladeshi medicines into Catalog products & Inventory medicines';

    public function handle(CurrentTenant $currentTenant, BangladeshCatalogImportService $importer): int
    {
        $tenants = $this->resolveTenants();
        if ($tenants->isEmpty()) {
            $this->error('No matching active tenant found.');

            return self::FAILURE;
        }

        $this->info('Fetching online Bangladesh medicine datasets...');
        $dataset = $importer->loadCombinedDatasets(
            refreshCache: (bool) $this->option('refresh-cache'),
            allowDownload: true,
            logger: fn (string $msg) => $this->line($msg)
        );

        $limit = max(0, (int) $this->option('limit'));
        $totalTarget = $limit > 0 ? min($limit, count($dataset['items'])) : count($dataset['items']);

        $this->info(sprintf(
            'Prepared %d unique medicines (%d categories, %d companies, %d generics).',
            $totalTarget,
            count($dataset['categories']),
            count($dataset['companies']),
            count($dataset['generics'])
        ));

        foreach ($tenants as $tenant) {
            $this->info("Importing into Tenant #{$tenant->id} ({$tenant->name})...");
            $currentTenant->run($tenant, function () use ($tenant, $dataset, $limit, $totalTarget, $importer): void {
                $bar = $this->output->createProgressBar($totalTarget * 2);
                $bar->start();

                $stats = $importer->syncForTenant(
                    tenant: $tenant,
                    dataset: $dataset,
                    limit: $limit,
                    progressCallback: fn () => $bar->advance()
                );

                $bar->finish();
                $this->newLine();
                $this->info(sprintf(
                    '  ✓ Tenant #%d: Catalog +%d (skipped %d) | Inventory Medicines +%d (skipped %d) | Opening Batches +%d.',
                    $tenant->id,
                    $stats['products_inserted'],
                    $stats['products_skipped'],
                    $stats['medicines_inserted'],
                    $stats['medicines_skipped'],
                    $stats['batches_inserted'] ?? 0
                ));
            });
        }

        $this->info('Online Bangladesh medicine catalog & inventory import complete!');

        return self::SUCCESS;
    }

    private function resolveTenants()
    {
        $query = Tenant::query()->where('status', 'active')->orderBy('id');

        if ($this->option('all')) {
            return $query->get();
        }

        $filter = $this->option('tenant');
        if ($filter) {
            $filterStr = trim((string) $filter);
            $domainCandidates = [$filterStr, "{$filterStr}.localhost"];

            return $query->where(function ($q) use ($filterStr, $domainCandidates): void {
                if (is_numeric($filterStr)) {
                    $q->where('id', (int) $filterStr);
                } else {
                    $q->where('slug', $filterStr)
                        ->orWhereExists(function ($sub) use ($domainCandidates): void {
                            $sub->selectRaw('1')
                                ->from('tenant_domains')
                                ->whereColumn('tenant_domains.tenant_id', 'tenants.id')
                                ->whereIn('tenant_domains.domain', $domainCandidates);
                        });
                }
            })->get();
        }

        return $query->limit(1)->get();
    }
}
