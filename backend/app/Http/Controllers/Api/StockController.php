<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StockAdjustment;
use App\Models\StockLevel;
use App\Models\StockPurchase;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StockController extends Controller
{
    public function levels()
    {
        return response()->json(['data' => StockLevel::query()->orderBy('name_en')->get()]);
    }

    public function purchases(Request $request)
    {
        $q = StockPurchase::query()->orderByDesc('purchase_date');
        if ($pid = $request->query('product_id')) {
            $q->where('product_id', $pid);
        }

        return response()->json(['data' => $q->get()]);
    }

    public function storePurchase(Request $request)
    {
        $data = $request->validate([
            'product_id' => ['required', 'uuid'],
            'purchase_date' => ['required', 'date'],
            'weight_kg' => ['required', 'numeric', 'gt:0'],
            'cost_per_kg' => ['required', 'numeric', 'gte:0'],
            'total_cost' => ['required', 'numeric', 'gte:0'],
            'supplier' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        $row = StockPurchase::query()->create([
            'id' => (string) Str::uuid(),
            ...$data,
            'created_by' => $request->user()->id,
            'created_at' => now(),
        ]);

        return response()->json(['data' => $row], 201);
    }

    public function adjustments(Request $request)
    {
        $q = StockAdjustment::query()->orderByDesc('adjustment_date');
        if ($pid = $request->query('product_id')) {
            $q->where('product_id', $pid);
        }
        if ($reason = $request->query('reason')) {
            $q->where('reason', $reason);
        }
        if ($from = $request->query('from')) {
            $q->where('adjustment_date', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $q->where('adjustment_date', '<=', $to);
        }

        return response()->json(['data' => $q->get()]);
    }

    public function storeAdjustment(Request $request)
    {
        $data = $request->validate([
            'product_id' => ['required', 'uuid'],
            'adjustment_date' => ['required', 'date'],
            'weight_kg' => ['required', 'numeric', 'gt:0'],
            'reason' => ['required', Rule::in(['waste', 'freezer_in', 'freezer_out', 'damage', 'other'])],
            'notes' => ['nullable', 'string'],
        ]);

        $row = StockAdjustment::query()->create([
            'id' => (string) Str::uuid(),
            ...$data,
            'created_by' => $request->user()->id,
            'created_at' => now(),
        ]);

        return response()->json(['data' => $row], 201);
    }
}
