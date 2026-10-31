<?php

use App\Http\Controllers\SpaController;
use Illuminate\Support\Facades\Route;

// SPA fallback: serve Vite build from public/ when present
Route::get('/{any?}', SpaController::class)->where('any', '^(?!api).*$');
