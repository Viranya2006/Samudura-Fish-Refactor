<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;
use Illuminate\Support\Facades\File;

class SpaController extends Controller
{
    public function __invoke(): Response|\Illuminate\Http\JsonResponse
    {
        $index = public_path('index.html');
        if (File::exists($index)) {
            return response(File::get($index), 200)->header('Content-Type', 'text/html');
        }

        return response()->json([
            'app' => 'Samudura Fish POS API',
            'docs' => 'See /api/* endpoints. Build frontend into public/ for SPA hosting.',
        ]);
    }
}
