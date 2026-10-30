<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    use HasUuids;

    protected $fillable = [
        'id',
        'receipt_number',
        'cashier_id',
        'sale_type',
        'subtotal',
        'discount_amount',
        'discount_type',
        'total',
        'payment_method',
        'cash_received',
        'change_given',
        'status',
        'terminal_id',
        'synced',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'float',
            'discount_amount' => 'float',
            'total' => 'float',
            'cash_received' => 'float',
            'change_given' => 'float',
            'synced' => 'boolean',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }
}
