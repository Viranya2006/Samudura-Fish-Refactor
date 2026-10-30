<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RolePermissionDefault;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $users = User::query()->orderBy('name')->get()->map->toProfileArray();

        return response()->json(['data' => $users]);
    }

    public function store(Request $request)
    {
        /** @var User $actor */
        $actor = $request->user();

        $data = $request->validate([
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'full_name' => ['required', 'string', 'max:255'],
            'role' => ['required', Rule::in(['admin', 'cashier', 'developer'])],
        ]);

        if ($actor->role === 'admin' && in_array($data['role'], ['admin', 'developer'], true)) {
            return response()->json(['message' => 'Admins cannot create admin or developer users'], 403);
        }

        if ($actor->role !== 'developer' && $data['role'] === 'developer') {
            return response()->json(['message' => 'Only developers can create developers'], 403);
        }

        $defaults = RolePermissionDefault::query()->find($data['role']);
        $permissions = $defaults?->permissions ?? [];

        $user = User::query()->create([
            'id' => (string) Str::uuid(),
            'name' => $data['full_name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => $data['role'],
            'permissions' => $permissions,
            'is_active' => true,
            'must_reset_password' => true,
        ]);

        return response()->json(['data' => $user->toProfileArray()], 201);
    }

    public function update(Request $request, string $id)
    {
        /** @var User $actor */
        $actor = $request->user();
        $user = User::query()->findOrFail($id);

        $data = $request->validate([
            'full_name' => ['sometimes', 'string', 'max:255'],
            'role' => ['sometimes', Rule::in(['admin', 'cashier', 'developer'])],
            'permissions' => ['sometimes', 'array'],
            'is_active' => ['sometimes', 'boolean'],
            'password' => ['sometimes', 'string', 'min:6'],
        ]);

        if (isset($data['role']) && $actor->role !== 'developer' && $data['role'] === 'developer') {
            return response()->json(['message' => 'Only developers can assign developer role'], 403);
        }

        if (isset($data['full_name'])) {
            $user->name = $data['full_name'];
        }
        if (isset($data['role'])) {
            $user->role = $data['role'];
        }
        if (array_key_exists('permissions', $data)) {
            $user->permissions = $data['permissions'];
        }
        if (array_key_exists('is_active', $data)) {
            $user->is_active = $data['is_active'];
        }
        if (isset($data['password'])) {
            $user->password = Hash::make($data['password']);
            $user->must_reset_password = true;
        }
        $user->save();

        return response()->json(['data' => $user->fresh()->toProfileArray()]);
    }
}
