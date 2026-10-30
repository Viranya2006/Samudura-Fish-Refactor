<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class BackupDatabase extends Command
{
    protected $signature = 'pos:backup-db';

    protected $description = 'Dump POS JSON backup into storage/app/backups';

    public function handle(): int
    {
        $dir = storage_path('app/backups');
        File::ensureDirectoryExists($dir);

        $this->call('pos:export-local', [
            'output' => $dir.'/pos-'.now()->format('Y-m-d_His').'.json',
        ]);

        // Keep last 30 files
        $files = collect(File::files($dir))
            ->sortByDesc(fn ($f) => $f->getMTime())
            ->values();
        foreach ($files->slice(30) as $old) {
            File::delete($old->getPathname());
        }

        return self::SUCCESS;
    }
}
