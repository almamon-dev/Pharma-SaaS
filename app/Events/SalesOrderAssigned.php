<?php

namespace App\Events;

use App\Models\Counter;
use App\Models\Sale;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SalesOrderAssigned implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Sale $sale,
        public Counter $counter,
        public string $assignmentType = 'automatic'
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("tenant.{$this->sale->tenant_id}.branch.{$this->sale->branch_id}"),
            new PrivateChannel("counter.{$this->counter->id}"),
            new PrivateChannel("user.{$this->sale->salesman_id}"),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'sale_id' => $this->sale->id,
            'order_number' => $this->sale->order_number,
            'counter_id' => $this->counter->id,
            'counter_name' => $this->counter->name,
            'counter_code' => $this->counter->code,
            'salesman_id' => $this->sale->salesman_id,
            'customer_name' => $this->sale->customer?->name,
            'total_amount' => (float) $this->sale->total_amount,
            'assignment_type' => $this->assignmentType,
            'assigned_at' => now()->toISOString(),
        ];
    }
}

