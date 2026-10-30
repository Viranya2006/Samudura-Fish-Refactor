<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\RolePermissionDefault;
use App\Models\ShopSetting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        RolePermissionDefault::query()->upsert([
            [
                'role' => 'admin',
                'permissions' => json_encode([
                    'sales' => true, 'inventory' => true, 'history' => true, 'petty_cash' => true, 'day_end' => true,
                    'reports' => true, 'user_management' => true, 'shop_settings' => true, 'scale_file' => true,
                    'permissions' => false, 'data_retention' => false, 'system' => false,
                ]),
                'updated_at' => now(),
            ],
            [
                'role' => 'cashier',
                'permissions' => json_encode([
                    'sales' => true, 'inventory' => true, 'history' => true, 'petty_cash' => true, 'day_end' => true,
                    'reports' => false, 'user_management' => false, 'shop_settings' => false, 'scale_file' => false,
                    'permissions' => false, 'data_retention' => false, 'system' => false,
                ]),
                'updated_at' => now(),
            ],
            [
                'role' => 'developer',
                'permissions' => json_encode([
                    'sales' => true, 'inventory' => true, 'history' => true, 'petty_cash' => true, 'day_end' => true,
                    'reports' => true, 'user_management' => true, 'shop_settings' => true, 'scale_file' => true,
                    'permissions' => true, 'data_retention' => true, 'system' => true,
                ]),
                'updated_at' => now(),
            ],
        ], ['role'], ['permissions', 'updated_at']);

        ShopSetting::query()->firstOrCreate(
            ['shop_name' => 'Samudura Fish Market'],
            [
                'id' => (string) Str::uuid(),
                'shop_name_si' => 'සමුදුර මත්ස්‍ය වෙළඳපොළ',
                'data_retention_days' => 90,
                'plu_file_path' => 'D:/PLU/plu.txt',
                'scale_price_format' => 'none',
                'updated_at' => now(),
            ]
        );

        $devPerms = RolePermissionDefault::query()->find('developer')?->permissions ?? [];

        User::query()->updateOrCreate(
            ['email' => 'developer@samudura.local'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Developer',
                'password' => Hash::make('ChangeMe123!'),
                'role' => 'developer',
                'permissions' => $devPerms,
                'is_active' => true,
                'must_reset_password' => false,
            ]
        );

        $samples = [
            ['0040', 'Salaya', 'සාලය', 500, 450],
            ['0041', 'Kelawalla', 'කෙලවළ්ල', 650, 580],
            ['0042', 'Thalapath', 'තලපත්', 700, 620],
            ['0043', 'Thora', 'තෝරා', 550, 490],
            ['0044', 'Sardine', 'සාඩින්', 400, 360],
        ];

        foreach ($samples as [$plu, $en, $si, $retail, $wholesale]) {
            Product::query()->updateOrCreate(
                ['plu_code' => $plu],
                [
                    'id' => (string) Str::uuid(),
                    'name_en' => $en,
                    'name_si' => $si,
                    'retail_price_per_kg' => $retail,
                    'wholesale_price_per_kg' => $wholesale,
                    'is_active' => true,
                ]
            );
        }
    }
}
