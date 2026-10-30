<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasUuids;

    protected $fillable = [
        'id',
        'plu_code',
        'name_en',
        'name_si',
        'retail_price_per_kg',
        'wholesale_price_per_kg',
        'no_cut_discount_per_kg',
        'min_stock_kg',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'retail_price_per_kg' => 'float',
            'wholesale_price_per_kg' => 'float',
            'no_cut_discount_per_kg' => 'float',
            'min_stock_kg' => 'float',
            'is_active' => 'boolean',
        ];
    }
}
