<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class StockPurchase extends Model
{
    use HasUuids;

    public $timestamps = false;

    const CREATED_AT = 'created_at';

    protected $fillable = [
        'id',
        'product_id',
        'purchase_date',
        'weight_kg',
        'cost_per_kg',
        'total_cost',
        'supplier',
        'notes',
        'created_by',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'purchase_date' => 'date',
            'weight_kg' => 'float',
            'cost_per_kg' => 'float',
            'total_cost' => 'float',
            'created_at' => 'datetime',
        ];
    }
}
