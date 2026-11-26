<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Interfaces\Http;

use App\Http\Controllers\Controller;
use App\Models\Counter;
use App\Models\CounterSession;
use App\Modules\CashCounter\Application\CashCounterShiftWorkflow;
use App\Modules\CashCounter\Application\DTO\CloseShiftCommand;
use App\Modules\CashCounter\Application\DTO\OpenShiftCommand;
use App\Modules\CashCounter\Application\DTO\RecordCashMovementCommand;
use App\Modules\CashCounter\Application\Ports\ShiftSessionRepository;
use App\Modules\CashCounter\Domain\CashCounterProblem;
use App\Modules\CashCounter\Domain\CashMovementType;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Thin HTTP Interface Adapter for Cash Counter Shift lifecycle endpoints.
 */
final class ShiftOperationsController extends Controller
{
    public function __construct(
        private readonly CashCounterShiftWorkflow $workflow,
        private readonly ShiftSessionRepository $sessions,
    ) {}

    public function openSession(Request $request, Counter $counter, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $branch = $tenantContext->branch();
        $tenant = $tenantContext->tenant();

        if (! $tenant || ! $branch) {
            return back()->with('error', 'Select an active branch before opening a shift.');
        }

        $validated = $request->validate([
            'opening_float' => ['required', 'numeric', 'min:0'],
            'opening_denominations' => ['nullable', 'array'],
            'opening_denominations.*' => ['nullable', 'integer', 'min:0'],
            'shift' => ['nullable', Rule::in(['morning', 'evening', 'night'])],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $this->workflow->openShift(new OpenShiftCommand(
                tenantId: (int) $tenant->id,
                branchId: (int) $branch->id,
                counterId: (int) $counter->id,
                cashierId: (int) $user->id,
                cashierName: (string) $user->name,
                openingFloat: $validated['opening_float'],
                shift: $validated['shift'] ?? null,
                notes: $validated['notes'] ?? null,
                openingDenominations: $validated['opening_denominations'] ?? null,
                currencyCode: (string) ($tenant->currency_code ?? 'BDT'),
            ));
        } catch (CashCounterProblem $problem) {
            return back()->with('error', $problem->getMessage());
        }

        return back()->with('success', "Shift started on Counter {$counter->code} with opening float.");
    }

    public function closeSession(Request $request, Counter $counter, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $canOverride = $tenantContext->hasRole(['admin', 'manager']) || ($user && $user->isSubscriberAdmin());

        $validated = $request->validate([
            'closing_cash_counted' => ['required', 'numeric', 'min:0'],
            'closing_denominations' => ['nullable', 'array'],
            'closing_denominations.*' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $closed = $this->workflow->closeShift(new CloseShiftCommand(
                counterId: (int) $counter->id,
                actorId: (int) $user->id,
                actorName: (string) $user->name,
                closingCashCounted: $validated['closing_cash_counted'],
                closingDenominations: $validated['closing_denominations'] ?? null,
                notes: $validated['notes'] ?? null,
                canOverrideOwnership: $canOverride,
                currencyCode: (string) ($tenantContext->tenant()?->currency_code ?? 'BDT'),
            ));
        } catch (CashCounterProblem $problem) {
            return back()->with('error', $problem->getMessage());
        }

        if ($closed === null) {
            return back()->with('success', "Counter {$counter->code} closed.");
        }

        $discrepancy = (float) ($closed->discrepancy ?? 0);
        $discrepancyMsg = $discrepancy == 0.0
            ? 'Cash matched 100%!'
            : ($discrepancy > 0 ? "Cash surplus of +{$closed->discrepancy}" : "Cash shortage of {$closed->discrepancy}");

        return back()
            ->with('success', "Shift closed on Counter {$counter->code}. Z-Report {$closed->zReportNumber} generated: {$discrepancyMsg}")
            ->with('lastClosedSessionId', $closed->id);
    }

    public function forceCloseSession(Request $request, Counter $counter, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $canForceClose = $tenantContext->hasRole(['admin', 'manager']) || ($user && $user->isSubscriberAdmin());
        if (! $canForceClose) {
            abort(403, 'Unauthorized. Only Admins and Branch Managers can force-close shifts.');
        }

        $validated = $request->validate([
            'force_close_reason' => ['required', 'string', 'min:3', 'max:500'],
            'closing_cash_counted' => ['nullable', 'numeric', 'min:0'],
            'closing_denominations' => ['nullable', 'array'],
            'closing_denominations.*' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $closed = $this->workflow->closeShift(new CloseShiftCommand(
                counterId: (int) $counter->id,
                actorId: (int) $user->id,
                actorName: (string) $user->name,
                closingCashCounted: $validated['closing_cash_counted'] ?? null,
                closingDenominations: $validated['closing_denominations'] ?? null,
                notes: $validated['notes'] ?? null,
                canOverrideOwnership: true,
                isForceClose: true,
                forceCloseReason: $validated['force_close_reason'],
                currencyCode: (string) ($tenantContext->tenant()?->currency_code ?? 'BDT'),
            ));
        } catch (CashCounterProblem $problem) {
            return back()->with('error', $problem->getMessage());
        }

        if ($closed === null) {
            return back()->with('success', "Counter {$counter->code} closed.");
        }

        return back()
            ->with('success', "Shift force-closed on Counter {$counter->code}. Z-Report {$closed->zReportNumber} generated.")
            ->with('lastClosedSessionId', $closed->id);
    }

    public function recordCashMovement(Request $request, Counter $counter, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $canOverride = $tenantContext->hasRole(['admin', 'manager']) || ($user && $user->isSubscriberAdmin());

        $validated = $request->validate([
            'type' => ['required', Rule::in(CashMovementType::values())],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'reason' => ['required', 'string', 'max:255'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $result = $this->workflow->recordCashMovement(new RecordCashMovementCommand(
                counterId: (int) $counter->id,
                counterCode: (string) $counter->code,
                actorId: (int) $user->id,
                actorName: (string) $user->name,
                type: $validated['type'],
                amount: $validated['amount'],
                reason: $validated['reason'],
                referenceNumber: $validated['reference_number'] ?? null,
                notes: $validated['notes'] ?? null,
                canOverrideOwnership: $canOverride,
                currencyCode: (string) ($tenantContext->tenant()?->currency_code ?? 'BDT'),
            ));
        } catch (CashCounterProblem $problem) {
            return back()->with('error', $problem->getMessage());
        }

        $label = CashMovementType::from($result['type'])->shortLabel();

        return back()->with('success', "{$label} of ৳{$result['amount']} recorded on Counter {$counter->code}.");
    }

    public function zReport(Request $request, CounterSession $session, TenantContext $tenantContext): JsonResponse
    {
        $user = $request->user();
        $canViewAll = $tenantContext->hasRole(['admin', 'manager']) || ($user && $user->isSubscriberAdmin());

        if (! $canViewAll && (int) $session->user_id !== (int) $user->id) {
            abort(403, 'Unauthorized. You can only view Z-Reports for your own shift sessions.');
        }

        $snapshot = $this->sessions->findById((int) $session->id);

        return response()->json($this->workflow->getReportPayload($snapshot));
    }
}

