<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * NVIDIA's hosted model catalog (build.nvidia.com), via its OpenAI-compatible
 * /v1/chat/completions endpoint (config/services.php "nvidia"). Answers in
 * JSON via "response_format: json_object" — supported by every instruct
 * model NVIDIA hosts there. Throws RuntimeException when it can't give an
 * answer — no key, a failed request, or nothing usable back — for the
 * caller to fall back or explain. Network failures surface as Laravel's
 * ConnectionException.
 */
class Nvidia
{
    public static function configured(): bool
    {
        return (bool) config('services.nvidia.key');
    }

    /**
     * @param  array<int, array{role: string, text: string}>  $turns  user/assistant turns, oldest first
     * @return array<string, mixed>
     */
    public static function json(string $system, array $turns, int $maxTokens = 2048, int $timeout = 30): array
    {
        if (! self::configured()) {
            throw new RuntimeException('No NVIDIA API key is set');
        }

        $model = config('services.nvidia.model');
        $base = rtrim((string) config('services.nvidia.base_url'), '/');
        $bundle = config('services.nvidia.ca_bundle');
        $response = Http::timeout($timeout)->connectTimeout(min(5, $timeout))
            ->withOptions($bundle ? ['verify' => $bundle] : [])
            ->withToken(config('services.nvidia.key'))
            ->post("{$base}/v1/chat/completions", [
                'model' => $model,
                'messages' => [
                    ['role' => 'system', 'content' => $system],
                    ...array_map(fn ($turn) => ['role' => $turn['role'] === 'model' ? 'assistant' : $turn['role'], 'content' => $turn['text']], $turns),
                ],
                'response_format' => ['type' => 'json_object'],
                'max_tokens' => $maxTokens,
            ]);

        if ($response->failed()) {
            // 429 is NVIDIA's rate limit on the free catalog tier.
            throw new RuntimeException("NVIDIA HTTP {$response->status()}: ".mb_substr($response->body(), 0, 300));
        }
        if (($reason = $response->json('choices.0.finish_reason')) === 'content_filter') {
            throw new RuntimeException('NVIDIA blocked the prompt (content_filter)');
        }

        $text = (string) $response->json('choices.0.message.content', '');
        $data = json_decode($text, true);
        if (! is_array($data)) {
            throw new RuntimeException('NVIDIA returned no usable answer ('.($reason ?? 'empty response').')');
        }

        return $data;
    }
}
