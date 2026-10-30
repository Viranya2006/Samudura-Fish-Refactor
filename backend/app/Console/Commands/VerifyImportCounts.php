<?php

namespace App\Console\Commands;

use App\Models\DayEndRecord;
use App\Models\PettyCashTransaction;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockAdjustment;
use App\Models\StockPurchase;
use Illuminate\Console\Command;

class VerifyImportCounts extends Command
{
    protected $signature = 'pos:verify-counts {path : JSON dump used for import}';

    protected $description = 'Compare DB row counts to a JSON dump';

    public function handle(): int
    {
        $payload = json_decode(file_get_contents($this->argument('path')), true);
        if (! is_array($payload)) {
            $this->error('Invalid JSON');

            return self::FAILURE;
        }

        $checks = [
            'products' => [count($payload['products'] ?? []), Product::query()->count()],
            'sales' => [count($payload['sales'] ?? []), Sale::query()->count()],
            'sale_items' => [count($payload['sale_items'] ?? []), SaleItem::query()->count()],
            'petty_cash_transactions' => [count($payload['petty_cash_transactions'] ?? []), PettyCashTransaction::query()->count()],
            'day_end_records' => [count($payload['day_end_records'] ?? []), DayEndRecord::query()->count()],
            'stock_purchases' => [count($payload['stock_purchases'] ?? []), StockPurchase::query()->count()],
            'stock_adjustments' => [count($payload['stock_adjustments'] ?? []), StockAdjustment::query()->count()],
        ];

        $ok = true;
        $rows = [];
        foreach ($checks as $name => [$expected, $actual]) {
            $match = $expected === $actual;
            $ok = $ok && $match;
            $rows[] = [$name, $expected, $actual, $match ? 'OK' : 'MISMATCH'];
        }

        $this->table(['Table', 'Dump', 'DB', 'Status'], $rows);

        $latestDump = collect($payload['sales'] ?? [])->sortByDesc('created_at')->first();
        $latestDb = Sale::query()->orderByDesc('created_at')->first();
        $this->line('Latest dump receipt: '.($latestDump['receipt_number'] ?? 'n/a'));
        $this->line('Latest DB receipt: '.($latestDb->receipt_number ?? 'n/a'));

        return $ok ? self::SUCCESS : self::FAILURE;
    }
}
