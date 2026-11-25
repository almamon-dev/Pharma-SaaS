<?php

namespace App\Events;

use App\Models\Sale;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class UnassignedOrderAlert implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Sale $sale,
        public string $reason
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("tenant.{$this->sale->tenant_id}.branch.{$this->sale->branch_id}"),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'sale_id' => $this->sale->id,
            'order_number' => $this->sale->order_number,
            'reason' => $this->reason,
            'created_at' => now()->toISOString(),
        ];
    }
}

