<?php

namespace App\Support\GoldRates;

use App\Exceptions\ApiException;
use GdImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

// Template PNGs and logos for the gold-rate poster maker. Unlike
// UploadController (which shrinks and converts to WebP), these are kept
// byte for byte as uploaded — the master PNG is the poster's background and
// must never change. They live on the private local disk and reach the
// browser only through the admin-only routes in routes/web.php.
class GoldRateFiles
{
    public const DISK = 'local';

    private const TEMPLATE_FOLDER = 'gold-rates/templates';

    private const THUMB_FOLDER = 'gold-rates/thumbs';

    private const LOGO_FOLDER = 'gold-rates/logos';

    private const MAX_TEMPLATE_BYTES = 30 * 1024 * 1024;

    private const MAX_LOGO_BYTES = 5 * 1024 * 1024;

    // Browsers refuse to draw (or export) canvases much past this; Safari
    // on iPhone is the tightest.
    private const MAX_SIDE = 10000;

    private const MAX_PIXELS = 25_000_000;

    private const THUMB_WIDTH = 480;

    private const LOGO_TYPES = ['image/png' => 'png', 'image/webp' => 'webp', 'image/jpeg' => 'jpg'];

    /**
     * @return array{path: string, thumbPath: ?string, width: int, height: int}
     */
    public static function storeTemplate(?UploadedFile $file): array
    {
        [$width, $height] = self::check($file, ['image/png' => 'png'], self::MAX_TEMPLATE_BYTES, 'The template must be a PNG image');
        if ($width * $height > self::MAX_PIXELS) {
            throw ApiException::badRequest('That PNG is too large to edit in a browser ('.$width.'×'.$height.'). Keep it under 25 megapixels.');
        }

        $name = Str::uuid().'.png';
        $path = self::put(self::TEMPLATE_FOLDER, $name, $file);

        return [
            'path' => $path,
            'thumbPath' => self::makeThumb((string) file_get_contents($file->getRealPath()), $name),
            'width' => $width,
            'height' => $height,
        ];
    }

    /**
     * @return array{path: string, mime: string, width: int, height: int}
     */
    public static function storeLogo(?UploadedFile $file): array
    {
        [$width, $height, $mime] = self::check($file, self::LOGO_TYPES, self::MAX_LOGO_BYTES, 'The logo must be a PNG, WebP or JPEG image');
        $path = self::put(self::LOGO_FOLDER, Str::uuid().'.'.self::LOGO_TYPES[$mime], $file);

        return ['path' => $path, 'mime' => $mime, 'width' => $width, 'height' => $height];
    }

    // A copy for a duplicated template, so deleting one never removes the
    // other's background.
    public static function copy(?string $path, string $folder = self::TEMPLATE_FOLDER): ?string
    {
        if (! $path) {
            return null;
        }
        $copy = $folder.'/'.Str::uuid().'.'.pathinfo($path, PATHINFO_EXTENSION);
        Storage::disk(self::DISK)->copy($path, $copy);

        return $copy;
    }

    public static function copyThumb(?string $path): ?string
    {
        return self::copy($path, self::THUMB_FOLDER);
    }

    public static function delete(?string ...$paths): void
    {
        $paths = array_filter($paths);
        if ($paths) {
            Storage::disk(self::DISK)->delete($paths);
        }
    }

    public static function response(string $path, string $mime)
    {
        if (! Storage::disk(self::DISK)->exists($path)) {
            abort(404);
        }

        return Storage::disk(self::DISK)->response($path, null, [
            'Content-Type' => $mime,
            'X-Content-Type-Options' => 'nosniff',
            // Files are never changed in place — a new upload gets a new id.
            'Cache-Control' => 'private, max-age=31536000, immutable',
        ]);
    }

    /**
     * @return array{0: int, 1: int, 2: string} width, height and sniffed mime type
     */
    private static function check(?UploadedFile $file, array $types, int $maxBytes, string $wrongType): array
    {
        if (! $file) {
            throw ApiException::badRequest('No file was uploaded');
        }
        if (! $file->isValid()) {
            throw ApiException::badRequest(self::uploadError($file->getError()));
        }
        if ($file->getSize() > $maxBytes) {
            throw ApiException::badRequest('That file is larger than '.intdiv($maxBytes, 1024 * 1024).'MB');
        }
        // From the file's bytes, not the name or the browser's claim.
        $mime = $file->getMimeType();
        if (! isset($types[$mime])) {
            throw ApiException::badRequest($wrongType);
        }
        $size = @getimagesize($file->getRealPath());
        if (! $size || $size[0] < 1 || $size[1] < 1) {
            throw ApiException::badRequest('That image could not be read');
        }
        if ($size[0] > self::MAX_SIDE || $size[1] > self::MAX_SIDE) {
            throw ApiException::badRequest('Images can be at most '.self::MAX_SIDE.' pixels on a side');
        }

        return [$size[0], $size[1], $mime];
    }

    // PHP drops a file over its own limits before the app sees it; say so,
    // with the limit, rather than "no file".
    private static function uploadError(int $code): string
    {
        return match ($code) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'That file is larger than this server accepts (PHP upload_max_filesize is '
                .ini_get('upload_max_filesize').'). Raise upload_max_filesize and post_max_size in php.ini — see README "Gold rate templates".',
            UPLOAD_ERR_PARTIAL => 'The upload was interrupted — please try again',
            UPLOAD_ERR_NO_FILE => 'No file was uploaded',
            UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE, UPLOAD_ERR_EXTENSION => 'The server could not store the upload (PHP temp folder missing or not writable)',
            default => 'The upload failed',
        };
    }

    private static function put(string $folder, string $name, UploadedFile $file): string
    {
        $path = Storage::disk(self::DISK)->putFileAs($folder, $file, $name);
        if (! $path) {
            throw ApiException::internal('Could not save that file — check that storage/app is writable');
        }

        return $path;
    }

    // A small PNG for the template list. A separate file — the master is
    // never touched. Skipped (the list shows the master) if GD can't do it.
    private static function makeThumb(string $contents, string $name): ?string
    {
        try {
            $image = @imagecreatefromstring($contents);
            if (! $image instanceof GdImage) {
                return null;
            }
            $width = imagesx($image);
            if ($width > self::THUMB_WIDTH) {
                $image = imagescale($image, self::THUMB_WIDTH, (int) max(1, round(imagesy($image) * self::THUMB_WIDTH / $width)), IMG_BICUBIC);
            }
            imagealphablending($image, false);
            imagesavealpha($image, true);
            ob_start();
            imagepng($image, null, 9);
            $png = (string) ob_get_clean();
            $path = self::THUMB_FOLDER.'/'.$name;

            return $png !== '' && Storage::disk(self::DISK)->put($path, $png) ? $path : null;
        } catch (Throwable $e) {
            report($e);

            return null;
        }
    }
}
