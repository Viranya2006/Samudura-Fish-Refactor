<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ShopSetting extends Model
{
    use HasUuids;

    public $timestamps = false;

    const UPDATED_AT = 'updated_at';

    protected $fillable = [
        'id',
        'shop_name',
        'shop_name_si',
        'address',
        'address_si',
        'phone',
        'logo_url',
        'receipt_footer',
        'receipt_footer_si',
        'data_retention_days',
        'plu_file_path',
        'scale_price_format',
        'updated_at',
    ];

    protected function casts(): array
    {
        return [
            'data_retention_days' => 'integer',
            'updated_at' => 'datetime',
        ];
    }
}
