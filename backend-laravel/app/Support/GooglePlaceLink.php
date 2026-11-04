<?php

namespace App\Support;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Finds a business's Google Place ID (ChIJ…) from the link an owner can
 * easily copy: Google Maps' "Share" link (maps.app.goo.gl/…) or the Maps
 * page itself. No API key is needed.
 *
 * A Maps page's URL carries the place's feature ID, "!1s0x<hex>:0x<hex>",
 * and a Place ID is those same two 64-bit numbers encoded (a small
 * protobuf, base64url): 0x0a 0x12, then field 1 and field 2 as
 * little-endian fixed64. Short links are followed, only through Google's
 * own hosts, to reach that URL.
 */
class GooglePlaceLink
{
    // Redirects are followed only through these, so a pasted link can't
    // make the server fetch anywhere else.
    private const HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co', 'share.google', 'google.com', 'www.google.com', 'maps.google.com', 'google.co.in', 'www.google.co.in'];

    private const MAX_REDIRECTS = 5;

    /** A Google link that already opens the review box: kept as it is. */
    public static function isDirectReviewLink(string $url): bool
    {
        return (bool) preg_match('#^https?://(g\.page/r/[^/]+/review|search\.google\.com/local/writereview)#i', trim($url));
    }

    public static function looksLikeGoogleLink(string $url): bool
    {
        return in_array(self::host($url), self::HOSTS, true) || self::host($url) === 'g.page';
    }

    /** The Place ID a link (or anything in it) points at, following short links; null if it can't be found. */
    public static function placeId(string $url): ?string
    {
        $url = trim($url);
        for ($hop = 0; $hop <= self::MAX_REDIRECTS; $hop++) {
            if ($id = self::fromText(rawurldecode($url))) {
                return $id;
            }
            if (! in_array(self::host($url), self::HOSTS, true)) {
                return null;
            }
            try {
                $response = Http::timeout(6)->withOptions(['allow_redirects' => false])
                    ->withHeaders(['User-Agent' => 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'])
                    ->get($url);
            } catch (ConnectionException) {
                return null;
            }
            $next = $response->header('Location');
            if (! $response->redirect() || ! $next) {
                // Some pages give the place in their body instead of a redirect.
                return self::fromText(mb_substr($response->body(), 0, 200_000));
            }
            $url = str_starts_with($next, '/') ? 'https://'.self::host($url).$next : $next;
        }

        return null;
    }

    /** A Place ID in some text: one written out, or a Maps feature ID turned into one. */
    public static function fromText(string $text): ?string
    {
        if (preg_match('/(?:placeid=|place_id[=:])(ChIJ[A-Za-z0-9_-]{20,})/', $text, $m)) {
            return $m[1];
        }
        if (preg_match('/(?:!1s|ftid=)0x([0-9a-f]{1,16}):0x([0-9a-f]{1,16})/i', $text, $m)) {
            return self::fromFeatureId($m[1], $m[2]);
        }

        return null;
    }

    /** "0x<a>:0x<b>" (as hex without 0x) → "ChIJ…". */
    public static function fromFeatureId(string $aHex, string $bHex): string
    {
        $le = fn (string $hex) => strrev(hex2bin(str_pad($hex, 16, '0', STR_PAD_LEFT)));
        $raw = "\x0a\x12\x09".$le($aHex)."\x11".$le($bHex);

        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    private static function host(string $url): string
    {
        return strtolower((string) parse_url(trim($url), PHP_URL_HOST));
    }
}
