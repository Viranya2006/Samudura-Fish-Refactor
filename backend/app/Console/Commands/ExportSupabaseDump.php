<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Pull public tables from a live Supabase project via PostgREST (service role).
 * Usage: php artisan pos:export-supabase path/to/out.json
 */
class ExportSupabaseDump extends Command
{
    protected $signature = 'pos:export-supabase
        {output=docs/exports/supabase-dump.json : Output JSON path}
        {--url= : Supabase project URL (or SUPABASE_URL env)}
        {--key= : Service role key (or SUPABASE_SERVICE_ROLE_KEY env)}';

    protected $description = 'Export POS tables from Supabase PostgREST into a JSON file for pos:import-backup';

    private array $tables = [
        'profiles',
        'products',
        'shop_settings',
        'role_permission_defaults',
        'sales',
        'sale_items',
        'petty_cash_transactions',
        'day_end_records',
        'stock_purchases',
        'stock_adjustments',
    ];

    public function handle(): int
    {
        $url = rtrim((string) ($this->option('url') ?: env('SUPABASE_URL')), '/');
        $key = (string) ($this->option('key') ?: env('SUPABASE_SERVICE_ROLE_KEY'));

        if ($url === '' || $key === '') {
            $this->error('Set --url/--key or SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');

            return self::FAILURE;
        }

        $out = [];
        foreach ($this->tables as $table) {
            $this->info("Fetching {$table}...");
            $rows = [];
            $from = 0;
            $page = 1000;
            while (true) {
                $to = $from + $page - 1;
                $res = Http::withHeaders([
                    'apikey' => $key,
                    'Authorization' => "Bearer {$key}",
                    'Range' => "{$from}-{$to}",
                ])->get("{$url}/rest/v1/{$table}", ['select' => '*']);

                if (! $res->successful()) {
                    $this->warn("{$table}: HTTP {$res->status()} — {$res->body()}");
                    break;
                }

                $chunk = $res->json();
                if (! is_array($chunk) || $chunk === []) {
                    break;
                }
                $rows = array_merge($rows, $chunk);
                if (count($chunk) < $page) {
                    break;
                }
                $from += $page;
            }
            $out[$table] = $rows;
            $this->line("  → ".count($rows)." rows");
        }

        // Map profiles → users shape for importer convenience
        $out['users'] = array_map(function ($p) {
            return [
                'id' => $p['id'],
                'full_name' => $p['full_name'] ?? 'User',
                'role' => $p['role'] ?? 'cashier',
                'permissions' => $p['permissions'] ?? [],
                'is_active' => $p['is_active'] ?? true,
                'email' => $p['email'] ?? null,
            ];
        }, $out['profiles'] ?? []);

        $out['exported_at'] = now()->toISOString();
        $path = $this->argument('output');
        $dir = dirname($path);
        if (! is_dir($dir)) {
            mkdir($dir, 0777, true);
        }
        file_put_contents($path, json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $this->info("Wrote {$path}");

        return self::SUCCESS;
    }
}
