<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DayEndRecord extends Model
{
    use HasUuids;

    public $timestamps = false;

    const CREATED_AT = 'created_at';

    protected $fillable = [
        'id',
        'cashier_id',
        'record_date',
        'opening_cash',
        'closing_cash',
        'expected_cash',
        'variance',
        'total_sales',
        'cash_sales',
        'card_sales',
        'notes',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'record_date' => 'date',
            'opening_cash' => 'float',
            'closing_cash' => 'float',
            'expected_cash' => 'float',
            'variance' => 'float',
            'total_sales' => 'float',
            'cash_sales' => 'float',
            'card_sales' => 'float',
            'created_at' => 'datetime',
        ];
    }
}
