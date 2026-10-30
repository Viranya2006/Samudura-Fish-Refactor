<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class StockAdjustment extends Model
{
    use HasUuids;

    public $timestamps = false;

    const CREATED_AT = 'created_at';

    protected $fillable = [
        'id',
        'product_id',
        'adjustment_date',
        'weight_kg',
        'reason',
        'notes',
        'created_by',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'adjustment_date' => 'date',
            'weight_kg' => 'float',
            'created_at' => 'datetime',
        ];
    }
}
