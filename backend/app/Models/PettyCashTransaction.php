<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PettyCashTransaction extends Model
{
    use HasUuids;

    public $timestamps = false;

    const CREATED_AT = 'created_at';

    protected $fillable = [
        'id',
        'cashier_id',
        'amount',
        'reason',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'created_at' => 'datetime',
        ];
    }
}
