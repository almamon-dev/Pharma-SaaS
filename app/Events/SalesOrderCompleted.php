<?php

namespace App\Events;

use App\Models\Sale;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SalesOrderCompleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Sale $sale
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("tenant.{$this->sale->tenant_id}.branch.{$this->sale->branch_id}"),
            new PrivateChannel("user.{$this->sale->salesman_id}"),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'sale_id' => $this->sale->id,
            'order_number' => $this->sale->order_number,
            'invoice_number' => $this->sale->invoice_number,
            'total_amount' => (float) $this->sale->total_amount,
            'paid_amount' => (float) $this->sale->paid_amount,
            'payment_status' => $this->sale->payment_status,
            'order_status' => $this->sale->order_status,
            'cashier_name' => $this->sale->cashier?->name,
            'completed_at' => now()->toISOString(),
        ];
    }
}

