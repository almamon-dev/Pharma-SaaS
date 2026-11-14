<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Scopes\TenantScope;
use App\Models\Tenant;
use App\Support\TenantContext;
use App\Tenancy\CurrentTenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class BranchController extends Controller
{
    public function index(Request $request, TenantContext $tenantContext): Response
    {
        $user = $request->user();
        $currentTenant = $tenantContext->tenant();
        $isOwner = $user->isSubscriberAdmin() && $tenantContext->isOwner();

        $adminTenantIds = $isOwner
            ? Tenant::query()->where('owner_id', $user->id)->pluck('id')->all()
            : [$currentTenant->id];

        $tenants = Tenant::query()
            ->whereIn('id', $adminTenantIds)
            ->orderBy('name')
            ->get(['id', 'name', 'city']);

        $branches = Branch::withoutGlobalScope(TenantScope::class)
            ->whereIn('tenant_id', $adminTenantIds)
            ->with('tenant:id,name,slug')
            ->withCount(['batches', 'sales'])
            ->orderByDesc('is_head_office')
            ->orderBy('tenant_id')
            ->orderBy('name')
            ->get()
            ->map(fn (Branch $branch) => [
                'id' => $branch->id,
                'tenant_id' => $branch->tenant_id,
                'tenant_name' => $branch->tenant?->name ?? 'Business',
                'name' => $branch->name,
                'code' => $branch->code,
                'phone' => $branch->phone,
                'email' => $branch->email,
                'city' => $branch->city,
                'address' => $branch->address,
                'is_head_office' => (bool) $branch->is_head_office,
                'is_active' => (bool) $branch->is_active,
                'batches_count' => $branch->batches_count,
                'sales_count' => $branch->sales_count,
            ]);

        $subscriberAdmin = $user->effectiveSubscriberAdmin();

        return Inertia::render('Branches/Index', [
            'branches' => $branches,
            'tenants' => $tenants,
            'currentTenantId' => $currentTenant?->id,
            'usage' => $subscriberAdmin?->subscriptionUsage(),
        ]);
    }

    public function store(Request $request, TenantContext $tenantContext, CurrentTenant $currentTenantContext): RedirectResponse
    {
        $user = $request->user();
        $activeTenant = $tenantContext->tenant();
        $subscriberAdmin = $user->effectiveSubscriberAdmin();
        $usage = $subscriberAdmin?->subscriptionUsage();

        $targetTenantId = $user->isSubscriberAdmin() && $request->filled('tenant_id')
            ? (int) $request->input('tenant_id')
            : (int) $activeTenant->id;

        $targetTenant = Tenant::query()
            ->where('id', $targetTenantId)
            ->when(
                $user->isSubscriberAdmin(),
                fn ($q) => $q->where('owner_id', $user->id),
                fn ($q) => $q->where('id', $activeTenant->id)
            )
            ->firstOrFail();

        if ($usage && $usage['branches'] >= $usage['max_branches']) {
            return back()->with('error', "Your current subscription allows up to {$usage['max_branches']} branch(es) across your account. Upgrade on the Plans page to add another branch.");
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required',
                'string',
                'max:30',
                Rule::unique('branches', 'code')->where('tenant_id', $targetTenant->id),
            ],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:500'],
        ]);

        $branch = $currentTenantContext->run($targetTenant, function () use ($validated): Branch {
            return Branch::query()->create([
                'name' => trim($validated['name']),
                'code' => strtoupper(trim($validated['code'])),
                'phone' => $validated['phone'] ?? null,
                'email' => $validated['email'] ?? null,
                'city' => $validated['city'] ?? null,
                'address' => $validated['address'] ?? null,
                'is_head_office' => false,
                'is_active' => true,
            ]);
        });

        AuditLog::record(
            action: 'branch.created',
            description: "Created branch \"{$branch->name}\" ({$branch->code}) in {$targetTenant->name}.",
            subject: $branch,
            tenantId: $targetTenant->id,
        );

        return back()->with('success', "Branch \"{$branch->name}\" created under {$targetTenant->name}.");
    }

    public function toggleStatus(Request $request, int $branchId, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $branch = Branch::withoutGlobalScope(TenantScope::class)
            ->with('tenant:id,owner_id')
            ->find($branchId);

        if (! $branch) {
            abort(404);
        }

        $belongsToCurrentTenant = (int) $branch->tenant_id === (int) $tenantContext->id();
        $ownedByUser = $user->isSubscriberAdmin() && (int) $branch->tenant?->owner_id === (int) $user->id;

        if (! $belongsToCurrentTenant && ! $ownedByUser) {
            abort(404);
        }

        if ($branch->is_head_office) {
            return back()->with('error', 'The Head Office branch cannot be deactivated.');
        }

        $branch->update(['is_active' => ! $branch->is_active]);

        AuditLog::record(
            action: 'branch.status_updated',
            description: ($branch->is_active ? 'Activated' : 'Deactivated')." branch \"{$branch->name}\".",
            subject: $branch,
            tenantId: $branch->tenant_id,
        );

        return back()->with('success', 'Branch status updated.');
    }
}
