<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ShopSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ShopSettingController extends Controller
{
    public function show()
    {
        $settings = ShopSetting::query()->first();

        return response()->json(['data' => $settings]);
    }

    public function upsert(Request $request)
    {
        $data = $request->validate([
            'shop_name' => ['sometimes', 'string'],
            'shop_name_si' => ['sometimes', 'string'],
            'address' => ['nullable', 'string'],
            'address_si' => ['nullable', 'string'],
            'phone' => ['nullable', 'string'],
            'logo_url' => ['nullable', 'string'],
            'receipt_footer' => ['nullable', 'string'],
            'receipt_footer_si' => ['nullable', 'string'],
            'data_retention_days' => ['sometimes', 'integer', 'min:1'],
            'plu_file_path' => ['sometimes', 'string'],
            'scale_price_format' => ['sometimes', 'in:actual,none,zero'],
        ]);

        $settings = ShopSetting::query()->first();
        if (! $settings) {
            $settings = ShopSetting::query()->create(array_merge([
                'id' => (string) Str::uuid(),
                'shop_name' => 'Samudura Fish Market',
                'shop_name_si' => 'සමුදුර මත්ස්‍ය වෙළඳපොළ',
                'data_retention_days' => 90,
                'plu_file_path' => 'D:/PLU/plu.txt',
                'scale_price_format' => 'none',
            ], $data, ['updated_at' => now()]));
        } else {
            $settings->fill($data);
            $settings->updated_at = now();
            $settings->save();
        }

        return response()->json(['data' => $settings->fresh()]);
    }
}
