<?php

namespace App\Support\SiteBuilder;

use App\Models\Business;

class Helpers
{
    private const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    public const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Everything rendered into a page comes from the owner's account, so
    // escape it — a stray quote or angle bracket in a business name must not
    // break (or inject into) the generated markup.
    public static function escapeHtml(?string $value): string
    {
        if (! $value) {
            return '';
        }

        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    // Indian digit grouping (lakh/crore: 2-digit groups after the first 3
    // from the right) — matches JS's (n).toLocaleString("en-IN").
    private static function indianGroup(string $intPart): string
    {
        if (strlen($intPart) <= 3) {
            return $intPart;
        }
        $last3 = substr($intPart, -3);
        $rest = substr($intPart, 0, -3);
        $rest = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest);

        return "{$rest},{$last3}";
    }

    public static function formatPrice(int $cents, string $currency): string
    {
        if ($cents === 0) {
            return 'Free';
        }
        $symbol = $currency === 'INR' ? '₹' : '';
        $rupees = intdiv(abs($cents), 100);
        $paise = abs($cents) % 100;
        $decimals = $paise === 0 ? '' : ($paise % 10 === 0 ? '.'.intdiv($paise, 10) : '.'.str_pad((string) $paise, 2, '0', STR_PAD_LEFT));
        $sign = $cents < 0 ? '-' : '';

        return "{$symbol}{$sign}".self::indianGroup((string) $rupees).$decimals;
    }

    public static function to12Hour(string $time): string
    {
        $parts = explode(':', $time);
        if (! isset($parts[0]) || ! is_numeric($parts[0])) {
            return $time;
        }
        $h = (int) $parts[0];
        $m = isset($parts[1]) && is_numeric($parts[1]) ? (int) $parts[1] : 0;
        $period = $h >= 12 ? 'pm' : 'am';
        $hour = $h % 12 === 0 ? 12 : $h % 12;

        return $m ? "{$hour}.".str_pad((string) $m, 2, '0', STR_PAD_LEFT).$period : "{$hour}{$period}";
    }

    // "9.30am to 8pm" when every open day shares the same window, otherwise a
    // per-day list — matching how shops actually describe their hours.
    public static function summariseHours(iterable $hours): string
    {
        $hours = collect($hours);
        $open = $hours->filter(fn ($h) => ! $h->isClosed);
        if ($open->isEmpty()) {
            return '';
        }
        $windows = $open->map(fn ($h) => "{$h->openTime}-{$h->closeTime}")->unique();
        if ($windows->count() === 1) {
            $first = $open->first();
            $closedDays = $hours->filter(fn ($h) => $h->isClosed)->map(fn ($h) => self::DAY_SHORT[$h->dayOfWeek]);
            $range = self::to12Hour($first->openTime).' to '.self::to12Hour($first->closeTime);

            return $closedDays->isNotEmpty() ? "{$range} (closed ".$closedDays->implode(', ').')' : $range;
        }

        return $open->map(fn ($h) => self::DAY_SHORT[$h->dayOfWeek].' '.self::to12Hour($h->openTime).'–'.self::to12Hour($h->closeTime))->implode(', ');
    }

    /**
     * Every value a template needs, derived once from the business record so
     * the individual designs only deal with presentation. $business must
     * have category, photos (sortOrder asc), hours (dayOfWeek asc), and
     * services (active, createdAt asc) already loaded.
     */
    public static function buildContext(Business $business): array
    {
        // Most listings have no dedicated logo, so fall back to their first
        // photo and finally to a lettermark — a header should never look
        // unfinished.
        $logoSrc = self::escapeHtml($business->logoUrl ?? $business->photos->first()?->url ?? '');
        $initial = self::escapeHtml(strtoupper(mb_substr(trim($business->name), 0, 1) ?: 'M'));
        $name = self::escapeHtml($business->name);
        $phoneDigits = preg_replace('/[^0-9]/', '', $business->phone);

        $slides = $business->photos->take(5)->map(fn ($p) => ['url' => self::escapeHtml($p->url)])->values();

        return [
            'name' => $name,
            'category' => self::escapeHtml($business->category?->name ?? ''),
            'city' => self::escapeHtml($business->city),
            'description' => self::escapeHtml(
                $business->description ?: "{$business->name} — ".($business->category?->name ?? 'local business')." in {$business->city}."
            ),
            'address' => self::escapeHtml(
                collect([$business->addressLine1, $business->addressLine2, $business->city, $business->state, $business->postalCode])
                    ->filter()->implode(', ')
            ),
            'phone' => self::escapeHtml($business->phone),
            'phoneDigits' => $phoneDigits,
            'email' => self::escapeHtml($business->email),
            'logoSrc' => $logoSrc,
            'initial' => $initial,
            'logoHtml' => $logoSrc
                ? "<img class=\"mk-logo\" src=\"{$logoSrc}\" alt=\"{$name}\"/>"
                : "<span class=\"mk-logo mk-logo-text\">{$initial}</span>",
            'workingTime' => self::escapeHtml(self::summariseHours($business->hours)),
            'instagram' => self::escapeHtml($business->instagramUsername ? preg_replace('/^@/', '', $business->instagramUsername) : ''),
            'mapsQuery' => "{$business->latitude},{$business->longitude}",
            'directionsUrl' => "https://www.google.com/maps/dir/?api=1&destination={$business->latitude},{$business->longitude}",
            'mapEmbedUrl' => "https://maps.google.com/maps?q={$business->latitude},{$business->longitude}&amp;z=16&amp;output=embed",
            'whatsappUrl' => "https://wa.me/{$phoneDigits}",
            'year' => (int) date('Y'),
            'rating' => $business->avgRating > 0 ? number_format($business->avgRating, 1) : '',
            'reviewCount' => $business->reviewCount,
            'photos' => $business->photos->map(fn ($p) => [
                'url' => self::escapeHtml($p->url),
                'caption' => self::escapeHtml($p->caption ?: $business->name),
            ])->values(),
            'slides' => $slides,
            'services' => $business->services->map(fn ($s) => [
                'name' => self::escapeHtml($s->name),
                'description' => self::escapeHtml($s->description ?? ''),
                'price' => self::formatPrice($s->priceCents, $s->currency),
            ])->values(),
            'hours' => $business->hours->map(fn ($h) => [
                'day' => self::DAY_NAMES[$h->dayOfWeek],
                'value' => $h->isClosed ? 'Closed' : self::to12Hour($h->openTime).' – '.self::to12Hour($h->closeTime),
                'closed' => $h->isClosed,
            ])->values(),
        ];
    }

    /**
     * Shared pure-CSS hero slideshow. Published pages have scripts stripped,
     * so the slider is a track of N slides stepped along by a keyframe
     * animation, generated to match the number of photos the shop actually
     * has.
     */
    public static function slideshow(array $ctx, string $emptyClass = 'mk-slide-empty'): array
    {
        $slides = $ctx['slides'];
        $count = count($slides);
        $slidesHtml = $count
            ? collect($slides)->map(fn ($s) => "<div class=\"mk-slide\"><img src=\"{$s['url']}\" alt=\"{$ctx['name']}\"/></div>")->implode('')
            : "<div class=\"mk-slide {$emptyClass}\"><span>{$ctx['name']}</span></div>";

        if ($count <= 1) {
            return [
                'html' => $slidesHtml,
                'css' => '.mk-track{display:flex;width:100%;height:100%}.mk-slide{width:100%;height:100%}',
            ];
        }

        $step = 100 / $count;
        $stops = collect($slides)->map(function ($_, $i) use ($step) {
            $from = number_format($i * $step, 3, '.', '');
            $to = number_format($i * $step + $step - 4, 3, '.', '');
            $shift = number_format(-$i * $step, 4, '.', '');

            return "{$from}%,{$to}%{transform:translateX({$shift}%)}";
        })->implode('');

        $stepFmt = number_format($step, 4, '.', '');
        $trackWidth = $count * 100;
        $duration = $count * 5;

        return [
            'html' => $slidesHtml,
            'css' => ".mk-track{display:flex;width:{$trackWidth}%;height:100%;animation:mk-slideshow {$duration}s infinite}
.mk-hero:hover .mk-track{animation-play-state:paused}
.mk-slide{width:{$stepFmt}%;height:100%}
@keyframes mk-slideshow{{$stops}100%{transform:translateX(0%)}}",
        ];
    }

    // The floating call/WhatsApp pair every template carries.
    public static function floatButtons(array $ctx, string $accent): array
    {
        $wa = Icons::WHATSAPP;
        $phoneIcon = Icons::PHONE;

        return [
            'html' => <<<HTML
            <div class="mk-float">
              <a class="mk-float-btn mk-float-wa" href="{$ctx['whatsappUrl']}" target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp">{$wa}</a>
              <a class="mk-float-btn mk-float-call" href="tel:{$ctx['phone']}" aria-label="Call us">{$phoneIcon}</a>
            </div>
            HTML,
            'css' => ".mk-float{position:fixed;right:20px;bottom:22px;display:flex;flex-direction:column;gap:12px;z-index:60}
.mk-float-btn{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.26);transition:transform .18s}
.mk-float-btn svg{width:28px;height:28px}
.mk-float-btn:hover{transform:scale(1.08)}
.mk-float-wa{background:#25d366}
.mk-float-call{background:{$accent}}
.mk-float-call svg{width:25px;height:25px}
@media(max-width:560px){.mk-float-btn{width:50px;height:50px}.mk-float-btn svg{width:25px;height:25px}}",
        ];
    }

    // The enquiry form. Submissions are picked up by the published page and
    // delivered to the business's Leads inbox.
    public static function enquiryForm(string $submitLabel = 'Submit'): string
    {
        return <<<HTML
        <form class="mk-contact-form" data-mk-form="enquiry">
          <input type="text" name="name" placeholder="Name" required/>
          <input type="tel" name="phone" placeholder="Phone number"/>
          <input type="email" name="email" placeholder="Email address"/>
          <input type="text" name="subject" placeholder="Subject"/>
          <textarea name="message" placeholder="Message..." rows="5"></textarea>
          <button type="submit">{$submitLabel}</button>
        </form>
        HTML;
    }

    public static function mapSection(array $ctx, string $buttonLabel = 'Goto Shop'): string
    {
        $pin = Icons::PIN;

        return <<<HTML
        <section class="mk-map-section">
          <div class="mk-map">
            <iframe src="{$ctx['mapEmbedUrl']}" loading="lazy" title="Map to {$ctx['name']}"></iframe>
          </div>
          <a class="mk-btn-map" href="{$ctx['directionsUrl']}" target="_blank" rel="noreferrer">{$pin}<span>{$buttonLabel}</span></a>
        </section>
        HTML;
    }
}
