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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ImportPosBackup extends Command
{
    protected $signature = 'pos:import-backup
        {path : Path to JSON export (from /api/backup/export or Supabase dump JSON)}
        {--fresh : Truncate POS tables before import}
        {--default-password=ChangeMe123! : Password for imported users (must_reset_password=true)}';

    protected $description = 'Import POS data from a JSON backup into MariaDB/SQLite';

    public function handle(): int
    {
        $path = $this->argument('path');
        if (! is_file($path)) {
            $this->error("File not found: {$path}");

            return self::FAILURE;
        }

        $payload = json_decode(file_get_contents($path), true);
        if (! is_array($payload)) {
            $this->error('Invalid JSON');

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->warn('Truncating POS tables...');
            $this->truncateAll();
        }

        DB::transaction(function () use ($payload) {
            $this->importUsers($payload);
            $this->importRoleDefaults($payload);
            $this->importShopSettings($payload);
            $this->importProducts($payload);
            $this->importSales($payload);
            $this->importPettyCash($payload);
            $this->importDayEnd($payload);
            $this->importStock($payload);
        });

        $this->info('Import complete.');
        $this->table(
            ['Table', 'Count'],
            [
                ['users', User::query()->count()],
                ['products', Product::query()->count()],
                ['sales', Sale::query()->count()],
                ['sale_items', SaleItem::query()->count()],
                ['petty_cash', PettyCashTransaction::query()->count()],
                ['day_end', DayEndRecord::query()->count()],
                ['stock_purchases', StockPurchase::query()->count()],
                ['stock_adjustments', StockAdjustment::query()->count()],
            ]
        );

        return self::SUCCESS;
    }

    private function truncateAll(): void
    {
        $driver = DB::getDriverName();
        if ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
        }

        foreach ([
            'sale_items', 'sales', 'stock_adjustments', 'stock_purchases',
            'petty_cash_transactions', 'day_end_records', 'products',
            'shop_settings', 'role_permission_defaults',
        ] as $table) {
            DB::table($table)->delete();
        }

        // Keep at least one way to log in: wipe users only if JSON includes users
        if ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }
    }

    private function importUsers(array $payload): void
    {
        $rows = $payload['users'] ?? $payload['profiles'] ?? [];
        $authUsers = collect($payload['auth_users'] ?? [])->keyBy('id');
        $password = (string) $this->option('default-password');

        foreach ($rows as $row) {
            $id = $row['id'] ?? (string) Str::uuid();
            $email = $row['email']
                ?? $authUsers->get($id)['email']
                ?? ($row['full_name'] ?? 'user').'@imported.local';

            User::query()->updateOrCreate(
                ['id' => $id],
                [
                    'name' => $row['full_name'] ?? $row['name'] ?? 'User',
                    'email' => $email,
                    'password' => Hash::make($password),
                    'role' => $row['role'] ?? 'cashier',
                    'permissions' => $row['permissions'] ?? [],
                    'is_active' => $row['is_active'] ?? true,
                    'must_reset_password' => true,
                ]
            );
        }

        $this->info('Users: '.count($rows));
    }

    private function importRoleDefaults(array $payload): void
    {
        foreach ($payload['role_permission_defaults'] ?? [] as $row) {
            RolePermissionDefault::query()->updateOrCreate(
                ['role' => $row['role']],
                [
                    'permissions' => $row['permissions'] ?? [],
                    'updated_at' => now(),
                ]
            );
        }
    }

    private function importShopSettings(array $payload): void
    {
        $rows = $payload['shop_settings'] ?? [];
        if ($rows === [] && isset($payload['shop_settings']) === false) {
            return;
        }
        // support single object
        if (isset($payload['shop_settings']) && isset($payload['shop_settings']['shop_name'])) {
            $rows = [$payload['shop_settings']];
        }

        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            ShopSetting::query()->updateOrCreate(
                ['id' => $row['id'] ?? (string) Str::uuid()],
                [
                    'shop_name' => $row['shop_name'] ?? 'Samudura Fish Market',
                    'shop_name_si' => $row['shop_name_si'] ?? '',
                    'address' => $row['address'] ?? null,
                    'address_si' => $row['address_si'] ?? null,
                    'phone' => $row['phone'] ?? null,
                    'logo_url' => $row['logo_url'] ?? null,
                    'receipt_footer' => $row['receipt_footer'] ?? null,
                    'receipt_footer_si' => $row['receipt_footer_si'] ?? null,
                    'data_retention_days' => $row['data_retention_days'] ?? 90,
                    'plu_file_path' => $row['plu_file_path'] ?? 'D:/PLU/plu.txt',
                    'scale_price_format' => $row['scale_price_format'] ?? 'none',
                    'updated_at' => now(),
                ]
            );
        }
    }

    private function importProducts(array $payload): void
    {
        foreach ($payload['products'] ?? [] as $row) {
            Product::query()->updateOrCreate(
                ['id' => $row['id']],
                [
                    'plu_code' => $row['plu_code'],
                    'name_en' => $row['name_en'],
                    'name_si' => $row['name_si'],
                    'retail_price_per_kg' => $row['retail_price_per_kg'] ?? 0,
                    'wholesale_price_per_kg' => $row['wholesale_price_per_kg'] ?? 0,
                    'no_cut_discount_per_kg' => $row['no_cut_discount_per_kg'] ?? 0,
                    'min_stock_kg' => $row['min_stock_kg'] ?? 0,
                    'is_active' => $row['is_active'] ?? true,
                ]
            );
        }
        $this->info('Products: '.count($payload['products'] ?? []));
    }

    private function importSales(array $payload): void
    {
        foreach ($payload['sales'] ?? [] as $row) {
            Sale::query()->updateOrCreate(
                ['id' => $row['id']],
                [
                    'receipt_number' => $row['receipt_number'],
                    'cashier_id' => $row['cashier_id'],
                    'sale_type' => $row['sale_type'] ?? 'retail',
                    'subtotal' => $row['subtotal'] ?? 0,
                    'discount_amount' => $row['discount_amount'] ?? 0,
                    'discount_type' => $row['discount_type'] ?? null,
                    'total' => $row['total'] ?? 0,
                    'payment_method' => $row['payment_method'] ?? null,
                    'cash_received' => $row['cash_received'] ?? null,
                    'change_given' => $row['change_given'] ?? null,
                    'status' => $row['status'] ?? 'completed',
                    'terminal_id' => $row['terminal_id'] ?? null,
                    'synced' => $row['synced'] ?? true,
                    'created_at' => $row['created_at'] ?? now(),
                    'updated_at' => $row['updated_at'] ?? now(),
                ]
            );
        }

        foreach ($payload['sale_items'] ?? [] as $row) {
            SaleItem::query()->updateOrCreate(
                ['id' => $row['id']],
                [
                    'sale_id' => $row['sale_id'],
                    'product_id' => $row['product_id'],
                    'weight_kg' => $row['weight_kg'],
                    'price_per_kg' => $row['price_per_kg'],
                    'line_total' => $row['line_total'],
                    'line_discount' => $row['line_discount'] ?? 0,
                    'is_cut' => $row['is_cut'] ?? true,
                    'barcode_raw' => $row['barcode_raw'] ?? null,
                    'is_manual' => $row['is_manual'] ?? false,
                    'created_at' => $row['created_at'] ?? now(),
                ]
            );
        }

        $this->info('Sales: '.count($payload['sales'] ?? []).', items: '.count($payload['sale_items'] ?? []));
    }

    private function importPettyCash(array $payload): void
    {
        foreach ($payload['petty_cash_transactions'] ?? [] as $row) {
            PettyCashTransaction::query()->updateOrCreate(
                ['id' => $row['id']],
                [
                    'cashier_id' => $row['cashier_id'],
                    'amount' => $row['amount'],
                    'reason' => $row['reason'] ?? null,
                    'created_at' => $row['created_at'] ?? now(),
                ]
            );
        }
    }

    private function importDayEnd(array $payload): void
    {
        foreach ($payload['day_end_records'] ?? [] as $row) {
            DayEndRecord::query()->updateOrCreate(
                ['id' => $row['id']],
                [
                    'cashier_id' => $row['cashier_id'],
                    'record_date' => $row['record_date'],
                    'opening_cash' => $row['opening_cash'] ?? 0,
                    'closing_cash' => $row['closing_cash'],
                    'expected_cash' => $row['expected_cash'],
                    'variance' => $row['variance'],
                    'total_sales' => $row['total_sales'] ?? 0,
                    'cash_sales' => $row['cash_sales'] ?? 0,
                    'card_sales' => $row['card_sales'] ?? 0,
                    'notes' => $row['notes'] ?? null,
                    'created_at' => $row['created_at'] ?? now(),
                ]
            );
        }
    }

    private function importStock(array $payload): void
    {
        foreach ($payload['stock_purchases'] ?? [] as $row) {
            StockPurchase::query()->updateOrCreate(
                ['id' => $row['id']],
                [
                    'product_id' => $row['product_id'],
                    'purchase_date' => $row['purchase_date'],
                    'weight_kg' => $row['weight_kg'],
                    'cost_per_kg' => $row['cost_per_kg'],
                    'total_cost' => $row['total_cost'],
                    'supplier' => $row['supplier'] ?? null,
                    'notes' => $row['notes'] ?? null,
                    'created_by' => $row['created_by'] ?? null,
                    'created_at' => $row['created_at'] ?? now(),
                ]
            );
        }

        foreach ($payload['stock_adjustments'] ?? [] as $row) {
            StockAdjustment::query()->updateOrCreate(
                ['id' => $row['id']],
                [
                    'product_id' => $row['product_id'],
                    'adjustment_date' => $row['adjustment_date'],
                    'weight_kg' => $row['weight_kg'],
                    'reason' => $row['reason'],
                    'notes' => $row['notes'] ?? null,
                    'created_by' => $row['created_by'] ?? null,
                    'created_at' => $row['created_at'] ?? now(),
                ]
            );
        }
    }
}
