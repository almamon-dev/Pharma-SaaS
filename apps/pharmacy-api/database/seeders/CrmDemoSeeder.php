<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\CRM\Models\CrmFollowup;
use App\Tenancy\CurrentTenant;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

class CrmDemoSeeder extends Seeder
{
    public function run(): void
    {
        $currentTenant = app(CurrentTenant::class);
        $tenants = Tenant::query()->where('status', 'active')->orderBy('id')->get();

        foreach ($tenants as $tenant) {
            $currentTenant->run($tenant, function () use ($tenant): void {
                $branches = Branch::query()->where('is_active', true)->orderByDesc('is_head_office')->orderBy('id')->get();
                if ($branches->isEmpty()) {
                    return;
                }

                $mainBranch = $branches->first();
                $secondBranch = $branches->get(1) ?? $mainBranch;
                $staffUsers = User::query()
                    ->whereHas('tenants', fn ($q) => $q->where('tenants.id', $tenant->id))
                    ->orderBy('id')
                    ->get();
                $markerId = $staffUsers->first()?->id;
                $today = CarbonImmutable::today();

                $customers = Customer::query()->orderBy('id')->get();
                $segments = ['chronic', 'vip', 'credit', 'regular'];
                $doctors = ['Dr. Kamrul Islam (Medicine)', 'Dr. Shirin Sultana (Cardiology)', 'Dr. Rezaul Karim (Endocrinology)', null];

                foreach ($customers as $cIdx => $customer) {
                    if ($customer->branch_id === null) {
                        $customer->update([
                            'branch_id' => ($cIdx % 2 === 0) ? $mainBranch->id : $secondBranch->id,
                            'segment' => $segments[$cIdx % count($segments)],
                            'credit_limit' => ($cIdx % 3 === 0) ? 15000 : 5000,
                            'doctor_name' => $doctors[$cIdx % count($doctors)],
                        ]);
                    }
                }

                if (CrmFollowup::query()->count() === 0 && $customers->isNotEmpty()) {
                    $sampleFollowups = [
                        [
                            'followup_type' => 'refill_reminder',
                            'title' => 'Monthly Hypertension & Diabetes Refill',
                            'medicines_summary' => 'Camlosart 5/20mg (30 pcs), Comet 500mg (60 pcs)',
                            'due_date' => $today->subDay()->toDateString(),
                            'channel' => 'phone',
                            'status' => 'pending',
                            'notes' => 'Patient refills every 30 days on the 27th.',
                        ],
                        [
                            'followup_type' => 'refill_reminder',
                            'title' => 'Asthma Inhaler & Montelukast Refill',
                            'medicines_summary' => 'Monas 10mg (30 pcs), Sulprex Inhaler',
                            'due_date' => $today->toDateString(),
                            'channel' => 'whatsapp',
                            'status' => 'pending',
                            'notes' => 'Send WhatsApp confirmation before evening delivery.',
                        ],
                        [
                            'followup_type' => 'due_followup',
                            'title' => 'Monthly Credit Account Settlement Call',
                            'medicines_summary' => null,
                            'due_date' => $today->toDateString(),
                            'channel' => 'phone',
                            'status' => 'contacted',
                            'notes' => 'Customer promised bKash payment before 6 PM.',
                        ],
                        [
                            'followup_type' => 'health_check',
                            'title' => 'Post-Antibiotic Course Check-in',
                            'medicines_summary' => 'Zimax 500mg, Sergel 20mg',
                            'due_date' => $today->addDays(2)->toDateString(),
                            'channel' => 'sms',
                            'status' => 'pending',
                            'notes' => 'Confirm symptom recovery after 5-day course.',
                        ],
                    ];

                    foreach ($sampleFollowups as $fIdx => $fRow) {
                        $cust = $customers->get($fIdx % $customers->count());
                        CrmFollowup::query()->create([
                            ...$fRow,
                            'customer_id' => $cust->id,
                            'branch_id' => $cust->branch_id ?? $mainBranch->id,
                            'assigned_to' => $staffUsers->get($fIdx % max(1, $staffUsers->count()))?->id,
                            'created_by' => $markerId,
                        ]);
                    }
                }
            });
        }
    }
}

