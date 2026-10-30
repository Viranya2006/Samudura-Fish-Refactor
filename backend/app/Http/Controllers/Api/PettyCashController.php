<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PettyCashTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PettyCashController extends Controller
{
    public function index(Request $request)
    {
        $q = PettyCashTransaction::query()->orderByDesc('created_at');

        if ($from = $request->query('from')) {
            $q->where('created_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $q->where('created_at', '<=', $to);
        }

        return response()->json(['data' => $q->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric'],
            'reason' => ['nullable', 'string'],
        ]);

        $row = PettyCashTransaction::query()->create([
            'id' => (string) Str::uuid(),
            'cashier_id' => $request->user()->id,
            'amount' => $data['amount'],
            'reason' => $data['reason'] ?? null,
            'created_at' => now(),
        ]);

        return response()->json(['data' => $row], 201);
    }

    public function destroyOlderThan(Request $request)
    {
        $data = $request->validate(['before' => ['required', 'date']]);
        $count = PettyCashTransaction::query()->where('created_at', '<', $data['before'])->delete();

        return response()->json(['deleted' => $count]);
    }
}
