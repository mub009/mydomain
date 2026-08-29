<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Support\ApiResponse;
use App\Support\Uploads\SvgSanitizer;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

// Single endpoint behind every "upload an image" button in the app —
// business photos/logo/cover, product images, and category icons. Stores
// to DigitalOcean Spaces (an S3-compatible disk — see config/filesystems.php
// "spaces" and README "Image uploads (DigitalOcean Spaces)") and hands
// back the CDN URL a form field just saves like any other URL. `purpose`
// only decides the storage folder, the caller's allowed role, and (for
// "posters") whether SVG is accepted — every purpose still writes to the
// same disk through the same validation path.
class UploadController extends Controller
{
    private const PURPOSES = [
        'business-photos' => ['folder' => 'businesses/photos', 'roles' => ['BUSINESS_OWNER', 'DEALER', 'ADMIN']],
        'business-logo' => ['folder' => 'businesses/logos', 'roles' => ['BUSINESS_OWNER', 'DEALER', 'ADMIN']],
        'business-cover' => ['folder' => 'businesses/covers', 'roles' => ['BUSINESS_OWNER', 'DEALER', 'ADMIN']],
        'products' => ['folder' => 'products', 'roles' => ['BUSINESS_OWNER', 'DEALER', 'ADMIN']],
        'categories' => ['folder' => 'categories', 'roles' => ['ADMIN']],
        // Poster Studio itself isn't ported yet (see README), but its
        // artwork uploads need SVG + sanitization once it is, so that
        // path is ready ahead of the rest of the module.
        'posters' => ['folder' => 'posters', 'roles' => ['ADMIN'], 'allowSvg' => true],
    ];

    private const MAX_RASTER_BYTES = 5 * 1024 * 1024;

    private const MAX_SVG_BYTES = 2 * 1024 * 1024;

    private const MIME_EXTENSIONS = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
    ];

    public function image(Request $request)
    {
        $actor = $request->attributes->get('auth');

        $data = $request->validate([
            'purpose' => ['required', 'string', 'in:'.implode(',', array_keys(self::PURPOSES))],
        ]);
        $purpose = self::PURPOSES[$data['purpose']];
        $allowSvg = ! empty($purpose['allowSvg']);

        if (! in_array($actor['role'], $purpose['roles'], true)) {
            throw ApiException::forbidden('You cannot upload this kind of image');
        }

        $file = $request->file('file');
        if (! $file || ! $file->isValid()) {
            throw ApiException::badRequest('No file was uploaded');
        }

        [$extension, $mime] = self::detectType($file, $allowSvg);

        if ($extension === 'svg') {
            if ($file->getSize() > self::MAX_SVG_BYTES) {
                throw ApiException::badRequest('That file is larger than 2MB');
            }
            $sanitized = SvgSanitizer::sanitize(file_get_contents($file->getRealPath()));
            $contents = $sanitized['svg'];
        } else {
            if ($file->getSize() > self::MAX_RASTER_BYTES) {
                throw ApiException::badRequest('That file is larger than 5MB');
            }
            $contents = file_get_contents($file->getRealPath());
        }

        $path = $purpose['folder'].'/'.Str::uuid().'.'.$extension;

        try {
            Storage::disk('spaces')->put($path, $contents, ['visibility' => 'public', 'ContentType' => $mime]);
        } catch (Throwable) {
            throw new ApiException(500, 'INTERNAL_ERROR', "Could not upload that file \u{2014} check the server's DigitalOcean Spaces configuration");
        }

        return ApiResponse::ok(['url' => Storage::disk('spaces')->url($path)]);
    }

    /**
     * @return array{0: string, 1: string} the file extension to store under, and its mime type
     */
    private static function detectType(UploadedFile $file, bool $allowSvg): array
    {
        // Sniffed from the file's actual bytes (fileinfo), not the
        // client-supplied header — getClientMimeType() is the untrusted one.
        $mime = $file->getMimeType();
        if (isset(self::MIME_EXTENSIONS[$mime])) {
            return [self::MIME_EXTENSIONS[$mime], $mime];
        }

        if ($allowSvg) {
            // XML has no magic number, so sniffing can only narrow things
            // down to "looks like markup" — SvgSanitizer::sanitize() is what
            // actually judges whether it is a valid, safe SVG.
            $head = ltrim((string) file_get_contents($file->getRealPath(), false, null, 0, 4096));
            if ($head !== '' && $head[0] === '<' && preg_match('/<svg[\s>]/i', $head)) {
                return ['svg', 'image/svg+xml'];
            }
        }

        throw ApiException::badRequest($allowSvg
            ? 'That file is not a PNG, JPEG, GIF, WebP or SVG image'
            : 'That file is not a PNG, JPEG, GIF or WebP image');
    }
}
