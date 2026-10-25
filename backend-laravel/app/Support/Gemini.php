<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Google Gemini's generateContent, answering in JSON that matches a schema
 * (config/services.php "gemini"). Throws RuntimeException when Gemini
 * can't give an answer — no key, quota used up (HTTP 429), a blocked
 * prompt, or nothing usable back — for the caller to fall back or explain.
 * Network failures surface as Laravel's ConnectionException.
 */
class Gemini
{
    public static function configured(): bool
    {
        return (bool) config('services.gemini.key');
    }

    /**
     * @param  array<int, array{role: string, text: string}>  $turns  user/model turns, oldest first
     * @param  array<string, mixed>  $schema  OpenAPI-style schema (types in capitals: OBJECT, STRING, …)
     * @return array<string, mixed>
     */
    public static function json(string $system, array $turns, array $schema, int $maxTokens = 2048): array
    {
        if (! self::configured()) {
            throw new RuntimeException('No Gemini API key is set');
        }

        $model = config('services.gemini.model');
        $base = rtrim((string) config('services.gemini.base_url'), '/');
        $bundle = config('services.gemini.ca_bundle');
        $response = Http::timeout(30)
            ->withOptions($bundle ? ['verify' => $bundle] : [])
            ->withHeaders(['x-goog-api-key' => config('services.gemini.key')])
            ->post("{$base}/v1beta/models/{$model}:generateContent", [
                'systemInstruction' => ['parts' => [['text' => $system]]],
                'contents' => array_map(fn ($turn) => ['role' => $turn['role'], 'parts' => [['text' => $turn['text']]]], $turns),
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                    'responseSchema' => $schema,
                    // Room for the model's own reasoning as well as the answer.
                    'maxOutputTokens' => $maxTokens,
                ],
            ]);

        if ($response->failed()) {
            // 429 is the free tier's daily/minute quota.
            throw new RuntimeException("Gemini HTTP {$response->status()}: ".mb_substr($response->body(), 0, 300));
        }
        if ($reason = $response->json('promptFeedback.blockReason')) {
            throw new RuntimeException("Gemini blocked the prompt ({$reason})");
        }

        $text = collect($response->json('candidates.0.content.parts', []))->pluck('text')->filter()->implode('');
        $data = json_decode($text, true);
        if (! is_array($data)) {
            throw new RuntimeException('Gemini returned no usable answer ('.($response->json('candidates.0.finishReason') ?? 'no candidate').')');
        }

        return $data;
    }
}
