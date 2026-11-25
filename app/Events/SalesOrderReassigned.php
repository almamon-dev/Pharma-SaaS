<?php

namespace App\Events;

use App\Models\Counter;
use App\Models\Sale;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SalesOrderReassigned implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Sale $sale,
        public ?Counter $oldCounter,
        public Counter $newCounter,
        public string $reason
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("tenant.{$this->sale->tenant_id}.branch.{$this->sale->branch_id}"),
            new PrivateChannel("counter.{$this->newCounter->id}"),
            new PrivateChannel("user.{$this->sale->salesman_id}"),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'sale_id' => $this->sale->id,
            'order_number' => $this->sale->order_number,
            'old_counter_id' => $this->oldCounter?->id,
            'old_counter_name' => $this->oldCounter?->name,
            'new_counter_id' => $this->newCounter->id,
            'new_counter_name' => $this->newCounter->name,
            'reason' => $this->reason,
            'reassigned_at' => now()->toISOString(),
        ];
    }
}

