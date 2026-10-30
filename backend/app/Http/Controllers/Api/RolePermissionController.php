<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RolePermissionDefault;
use Illuminate\Http\Request;

class RolePermissionController extends Controller
{
    public function index()
    {
        return response()->json(['data' => RolePermissionDefault::query()->orderBy('role')->get()]);
    }

    public function upsert(Request $request)
    {
        $data = $request->validate([
            'role' => ['required', 'in:admin,cashier,developer'],
            'permissions' => ['required', 'array'],
        ]);

        $row = RolePermissionDefault::query()->updateOrCreate(
            ['role' => $data['role']],
            ['permissions' => $data['permissions'], 'updated_at' => now()]
        );

        return response()->json(['data' => $row]);
    }
}
