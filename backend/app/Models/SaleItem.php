<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItem extends Model
{
    use HasUuids;

    public $timestamps = false;

    const CREATED_AT = 'created_at';

    protected $fillable = [
        'id',
        'sale_id',
        'product_id',
        'weight_kg',
        'price_per_kg',
        'line_total',
        'line_discount',
        'is_cut',
        'barcode_raw',
        'is_manual',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'weight_kg' => 'float',
            'price_per_kg' => 'float',
            'line_total' => 'float',
            'line_discount' => 'float',
            'is_cut' => 'boolean',
            'is_manual' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
