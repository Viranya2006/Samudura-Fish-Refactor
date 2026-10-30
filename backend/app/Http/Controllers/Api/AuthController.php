<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        /** @var User|null $user */
        $user = User::query()->where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid email or password.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['This account is inactive.'],
            ]);
        }

        $user->tokens()->delete();
        $token = $user->createToken('pos')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user->toAuthUserArray(),
            'profile' => $user->toProfileArray(),
            'must_reset_password' => $user->must_reset_password,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'user' => $user->toAuthUserArray(),
            'profile' => $user->toProfileArray(),
            'must_reset_password' => $user->must_reset_password,
        ]);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $user->password = $data['password'];
        $user->must_reset_password = false;
        $user->save();

        return response()->json([
            'ok' => true,
            'profile' => $user->toProfileArray(),
        ]);
    }
}
