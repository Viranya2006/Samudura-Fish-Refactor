<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
use Illuminate\Http\Request;

class BackupController extends Controller
{
    public function export(Request $request)
    {
        return response()->json([
            'exported_at' => now()->toISOString(),
            'users' => User::query()->get()->map->toProfileArray(),
            'products' => Product::query()->get(),
            'shop_settings' => ShopSetting::query()->get(),
            'role_permission_defaults' => RolePermissionDefault::query()->get(),
            'sales' => Sale::query()->get(),
            'sale_items' => SaleItem::query()->get(),
            'petty_cash_transactions' => PettyCashTransaction::query()->get(),
            'day_end_records' => DayEndRecord::query()->get(),
            'stock_purchases' => StockPurchase::query()->get(),
            'stock_adjustments' => StockAdjustment::query()->get(),
        ]);
    }
}
