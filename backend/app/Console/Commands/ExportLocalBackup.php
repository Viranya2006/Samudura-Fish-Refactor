<?php

namespace App\Console\Commands;

use App\Models\DayEndRecord;
use App\Models\PettyCashTransaction;
use App\Models\Product;
use App\Models\RolePermissionDefault;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\ShopSetting;
use App\Models\StockAdjustment;
use App\Models\StockPurchase;
use App\Models\User;
use Illuminate\Console\Command;

class ExportLocalBackup extends Command
{
    protected $signature = 'pos:export-local {output=storage/app/backups/pos-export.json}';

    protected $description = 'Export current DB to JSON (same shape as /api/backup/export)';

    public function handle(): int
    {
        $payload = [
            'exported_at' => now()->toISOString(),
            'users' => User::query()->get()->map->toProfileArray()->all(),
            'products' => Product::query()->get()->toArray(),
            'shop_settings' => ShopSetting::query()->get()->toArray(),
            'role_permission_defaults' => RolePermissionDefault::query()->get()->toArray(),
            'sales' => Sale::query()->get()->toArray(),
            'sale_items' => SaleItem::query()->get()->toArray(),
            'petty_cash_transactions' => PettyCashTransaction::query()->get()->toArray(),
            'day_end_records' => DayEndRecord::query()->get()->toArray(),
            'stock_purchases' => StockPurchase::query()->get()->toArray(),
            'stock_adjustments' => StockAdjustment::query()->get()->toArray(),
        ];

        $path = $this->argument('output');
        if (! str_starts_with($path, '/') && ! preg_match('/^[A-Za-z]:/', $path)) {
            $path = base_path($path);
        }

        $dir = dirname($path);
        if (! is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $this->info("Wrote {$path}");

        return self::SUCCESS;
    }
}
