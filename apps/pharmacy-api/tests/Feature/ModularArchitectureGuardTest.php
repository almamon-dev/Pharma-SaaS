<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Sale;
use App\Modules\Billing\Providers\BillingServiceProvider;
use App\Modules\CashCounter\Providers\CashCounterServiceProvider;
use App\Modules\Catalog\Providers\CatalogServiceProvider;
use App\Modules\Core\Providers\CoreServiceProvider;
use App\Modules\CRM\Providers\CrmServiceProvider;
use App\Modules\Foundation\Application\Ports\AuditLogger;
use App\Modules\Foundation\Application\Ports\SequenceNumberGenerator;
use App\Modules\Foundation\Application\Ports\TenantContextReader;
use App\Modules\Foundation\Providers\FoundationServiceProvider;
use App\Modules\Inventory\Providers\InventoryServiceProvider;
use App\Modules\Sales\Providers\SalesServiceProvider;
use App\Tenancy\CurrentTenant;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PharmaCore\Foundation\Application\Clock;
use PharmaCore\Foundation\Application\IdGenerator;
use PharmaCore\Foundation\Application\TransactionManager;
use PharmaCore\Foundation\Domain\DomainProblem;
use PharmaCore\Foundation\Domain\Money;
use PharmaCore\Foundation\Domain\OpaqueId;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Tests\TestCase;

class ModularArchitectureGuardTest extends TestCase
{
    use RefreshDatabase;

    public function test_foundation_package_primitives_are_exact_and_framework_free(): void
    {
        // Exact decimal math without float drift: 0.10 + 0.20 === 0.30
        $sum = Money::fromDecimal('0.10')->add(Money::fromDecimal('0.20'));
        $this->assertSame(30, $sum->minorUnits);
        $this->assertSame('0.30', $sum->toDecimalString());

        $diff = Money::fromDecimal('1300.00')->subtract(Money::fromDecimal('1321.10'));
        $this->assertSame(-2110, $diff->minorUnits);
        $this->assertSame('-21.10', $diff->toDecimalString());
        $this->assertTrue($diff->isNegative());

        $id = OpaqueId::fromInt(42);
        $this->assertSame('42', (string) $id);

        $problem = new DomainProblem('SHIFT_ALREADY_OPEN', 'Cashier already has an open shift.', 422, 'counter');
        $this->assertSame('SHIFT_ALREADY_OPEN', $problem->errorCode);
        $this->assertSame(422, $problem->statusCode);
    }

    public function test_foundation_ports_are_bound_in_container_and_morph_map_is_registered(): void
    {
        $clock = app(Clock::class);
        $this->assertInstanceOf(\DateTimeImmutable::class, $clock->now());

        $idGen = app(IdGenerator::class);
        $this->assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', $idGen->nextId());

        $this->assertInstanceOf(TransactionManager::class, app(TransactionManager::class));
        $this->assertInstanceOf(AuditLogger::class, app(AuditLogger::class));
        $this->assertInstanceOf(SequenceNumberGenerator::class, app(SequenceNumberGenerator::class));
        $this->assertInstanceOf(TenantContextReader::class, app(TenantContextReader::class));

        // Polymorphic morph map preserves canonical keys
        $morphMap = Relation::morphMap();
        $this->assertArrayHasKey('App\\Models\\Sale', $morphMap);
        $this->assertSame(Sale::class, $morphMap['App\\Models\\Sale']);

        // Every modular provider is loaded and CurrentTenant remains properly scoped
        $loadedProviders = array_keys(app()->getLoadedProviders());
        foreach ([
            FoundationServiceProvider::class,
            CoreServiceProvider::class,
            BillingServiceProvider::class,
            CatalogServiceProvider::class,
            CrmServiceProvider::class,
            InventoryServiceProvider::class,
            CashCounterServiceProvider::class,
            SalesServiceProvider::class,
        ] as $providerClass) {
            $this->assertContains($providerClass, $loadedProviders, "Expected module provider {$providerClass} to be loaded.");
        }

        $this->assertSame(
            spl_object_id(app(CurrentTenant::class)),
            spl_object_id(app(CurrentTenant::class)),
            'CurrentTenant must remain scoped to a single instance per request.'
        );
    }

    public function test_clean_architecture_layer_boundaries_keep_domain_and_application_framework_free(): void
    {
        $forbiddenInDomainAndApplication = [
            'Illuminate\\',
            'App\\Models\\',
            'App\\Http\\',
        ];

        $scanDirs = [
            dirname(base_path(), 2).'/packages/foundation/src',
            base_path('app/Modules/Foundation/Application'),
        ];

        // Also scan any Domain/ and Application/ folders across all Clean Architecture modules
        $moduleDirs = glob(base_path('app/Modules/*'), GLOB_ONLYDIR) ?: [];
        foreach ($moduleDirs as $modDir) {
            foreach (['Domain', 'Application'] as $layer) {
                $layerPath = $modDir.'/'.$layer;
                if (is_dir($layerPath)) {
                    $scanDirs[] = $layerPath;
                }
            }
        }

        $violations = [];
        foreach (array_unique($scanDirs) as $dir) {
            if (! is_dir($dir)) {
                continue;
            }
            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
            foreach ($iterator as $file) {
                if (! $file->isFile() || $file->getExtension() !== 'php') {
                    continue;
                }
                $contents = file_get_contents($file->getPathname()) ?: '';
                foreach ($forbiddenInDomainAndApplication as $forbidden) {
                    if (preg_match('/^\s*use\s+'.preg_quote($forbidden, '/').'/m', $contents)) {
                        $violations[] = "{$file->getPathname()} imports forbidden dependency {$forbidden}";
                    }
                }
            }
        }

        $this->assertSame([], $violations, "Clean Architecture boundary violation(s):\n".implode("\n", $violations));
    }
}

