<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Read-only model for stock_levels SQL view */
class StockLevel extends Model
{
    protected $table = 'stock_levels';

    public $incrementing = false;

    public $timestamps = false;

    protected $primaryKey = 'product_id';

    protected $keyType = 'string';

    protected function casts(): array
    {
        return [
            'min_stock_kg' => 'float',
            'purchased_kg' => 'float',
            'sold_kg' => 'float',
            'adjustment_loss_kg' => 'float',
            'freezer_in_kg' => 'float',
            'freezer_out_kg' => 'float',
            'fresh_available_kg' => 'float',
            'freezer_kg' => 'float',
        ];
    }
}
