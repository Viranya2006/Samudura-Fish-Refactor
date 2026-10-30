<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DayEndRecord;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DayEndController extends Controller
{
    public function index(Request $request)
    {
        $q = DayEndRecord::query()->orderByDesc('record_date');

        if ($from = $request->query('from')) {
            $q->where('record_date', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $q->where('record_date', '<=', $to);
        }
        if ($date = $request->query('date')) {
            $q->where('record_date', $date);
        }

        return response()->json(['data' => $q->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'record_date' => ['required', 'date'],
            'opening_cash' => ['nullable', 'numeric'],
            'closing_cash' => ['required', 'numeric'],
            'expected_cash' => ['required', 'numeric'],
            'variance' => ['required', 'numeric'],
            'total_sales' => ['nullable', 'numeric'],
            'cash_sales' => ['nullable', 'numeric'],
            'card_sales' => ['nullable', 'numeric'],
            'notes' => ['nullable', 'string'],
        ]);

        $row = DayEndRecord::query()->create([
            'id' => (string) Str::uuid(),
            'cashier_id' => $request->user()->id,
            'record_date' => $data['record_date'],
            'opening_cash' => $data['opening_cash'] ?? 0,
            'closing_cash' => $data['closing_cash'],
            'expected_cash' => $data['expected_cash'],
            'variance' => $data['variance'],
            'total_sales' => $data['total_sales'] ?? 0,
            'cash_sales' => $data['cash_sales'] ?? 0,
            'card_sales' => $data['card_sales'] ?? 0,
            'notes' => $data['notes'] ?? null,
            'created_at' => now(),
        ]);

        return response()->json(['data' => $row], 201);
    }

    public function destroyOlderThan(Request $request)
    {
        $data = $request->validate(['before' => ['required', 'date']]);
        $count = DayEndRecord::query()->where('created_at', '<', $data['before'])->delete();

        return response()->json(['deleted' => $count]);
    }
}
