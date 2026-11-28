<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            PlanSeeder::class,
            Phase2PlansAndFeaturesSeeder::class,
            DemoPharmacySeeder::class,
            CatalogModuleSeeder::class,
            RbacPermissionCatalogSeeder::class,
            CrmDemoSeeder::class,
        ]);

        \App\Models\DemoRole::seedDefaults();
    }
}
