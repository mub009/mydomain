<?php

namespace App\Support;

use Firebase\JWT\JWT as FirebaseJwt;
use Firebase\JWT\Key;

class Jwt
{
    public static function ttlToSeconds(string $ttl): int
    {
        if (! preg_match('/^(\d+)([smhd])$/', $ttl, $m)) {
            return 900;
        }

        $multipliers = ['s' => 1, 'm' => 60, 'h' => 3600, 'd' => 86400];

        return ((int) $m[1]) * $multipliers[$m[2]];
    }

    public static function signAccessToken(string $userId, string $role): string
    {
        $now = time();
        $payload = [
            'sub' => $userId,
            'role' => $role,
            'iat' => $now,
            'exp' => $now + self::ttlToSeconds(config('jwt.access_ttl')),
        ];

        return FirebaseJwt::encode($payload, config('jwt.access_secret'), 'HS256');
    }

    /**
     * @return array{sub:string,role:string}|null
     */
    public static function verifyAccessToken(string $token): ?array
    {
        try {
            $decoded = FirebaseJwt::decode($token, new Key(config('jwt.access_secret'), 'HS256'));

            return ['sub' => $decoded->sub, 'role' => $decoded->role];
        } catch (\Throwable) {
            return null;
        }
    }
}
