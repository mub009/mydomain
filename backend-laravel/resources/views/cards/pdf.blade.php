{{-- The visiting card as a PDF page (App\Support\Cards\CardPdf). dompdf
     renders only simple CSS, so this is table-based, every colour is a plain
     #rrggbb worked out in CardPdf, and images arrive as data URIs.
     Each action is an <a href>, which dompdf turns into a clickable link
     in the PDF. --}}
@php
    $dark = $layout === 'luxury';
    $hero = in_array($layout, ['classic', 'banner', 'split'], true);
    $pageBg = $dark ? $c['background'] : $c['background'];
    $cardBg = $c['surface'];
    $textColor = $c['text'];
    $muted = $c['muted'];
    $line = $tint($muted, 0.7);
    // Icons, links and soft/outline buttons use $ink: the primary colour,
    // or a readable stand-in where it would vanish into the card.
    $chip = $dark ? $c['surface'] : $tint($ink, 0.88);
    // Compact: the second try when the card doesn't fit on one page.
    $k = $compact ? 0.78 : 1;
    $logoSize = round(64 * $k);
    $heroBg = $layout === 'banner' ? $shade($c['primary'], 0.25) : $c['primary'];
    $heroText = $layout === 'split' ? $c['buttonText'] : '#ffffff';

    // Buttons: [background, text, border] for the template's button style.
    $btn = function (string $color) use ($buttonStyle, $c, $tint) {
        if (in_array($buttonStyle, ['outline', 'soft'], true)) {
            $color = \App\Support\Cards\CardEngine::readableOn($color, $c['surface'], [$c['accent'], $c['text']]);
        }

        return match ($buttonStyle) {
            'outline' => ['transparent', $color, $color],
            'soft' => [$tint($color, 0.85), $color, $tint($color, 0.85)],
            default => [$color, $c['buttonText'], $color],
        };
    };
    $actions = array_values(array_filter([
        $b['phoneHref'] ? ['Call', 'phone', $b['phoneHref'], $c['primary']] : null,
        $b['whatsappHref'] ? ['WhatsApp', 'message-square', $b['whatsappHref'], $c['accent']] : null,
        $b['mapsHref'] ? ['Location', 'map-pin', $b['mapsHref'], $c['primary']] : null,
        ($b['googleReviewHref'] ?? null) && $b['googleReviewHref'] !== '#' ? ['Review us', 'star', $b['googleReviewHref'], $c['accent']] : null,
        $b['email'] ? ['Email', 'mail', 'mailto:'.$b['email'], $c['primary']] : ($b['website'] ? ['Website', 'globe', $b['website'], $c['primary']] : null),
    ]));
    $info = array_values(array_filter([
        $b['phone'] ? ['Phone', 'phone', $b['phone'], $b['phoneHref']] : null,
        $b['whatsappHref'] ? ['WhatsApp', 'message-square', 'Chat with us', $b['whatsappHref']] : null,
        $b['email'] ? ['Email', 'mail', $b['email'], 'mailto:'.$b['email']] : null,
        $b['website'] ? ['Website', 'globe', preg_replace('#^https?://(www\.)?#i', '', rtrim($b['website'], '/')), $b['website']] : null,
        $b['address'] ? ['Address', 'map-pin', $b['address'], $b['mapsHref']] : null,
        $b['hours'] ? ['Open', 'clock', $b['hours'], null] : null,
    ]));
    $nameColor = $dark ? $c['accent'] : $textColor;
    $heroHeight = round(($layout === 'classic' ? 150 : 200) * $k);
@endphp
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>{{ $b['name'] }}</title>
<style>
  @page { margin: 0; }
  body { margin: 0; background: {{ $pageBg }}; font-family: "DejaVu Sans", sans-serif; color: {{ $textColor }}; font-size: 9pt; line-height: 1.35; }
  a { text-decoration: none; color: inherit; }
  table { border-collapse: collapse; }
  .page { padding: 16pt; }
  .card { background: {{ $cardBg }}; border-radius: 14pt; @if ($dark) border: 1pt solid {{ $c['accent'] }}; @elseif ($layout === 'minimal') border-top: 4pt solid {{ $c['primary'] }}; @endif }
  .name { font-family: "{{ $headingFont }}"; font-weight: bold; font-size: 19pt; line-height: 1.1; }
  .tagline { font-size: 8.5pt; margin-top: 3pt; }
  .about { color: {{ $muted }}; font-size: 8.5pt; margin: 0 0 10pt; }
  .btn { display: block; padding: {{ round(7 * $k, 1) }}pt 4pt; border-radius: {{ $radius }}; text-align: center; font-weight: bold; font-size: 9pt; }
  .btn img { vertical-align: -1.5pt; }
  .label { color: {{ $muted }}; font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.6pt; }
  .value { font-size: 8.5pt; }
  .chip { width: 22pt; height: 22pt; border-radius: 6pt; background: {{ $chip }}; text-align: center; }
  .section { padding: 0 16pt; }
  .rule { border-top: 0.75pt solid {{ $line }}; }
</style>
</head>
<body>
<div class="page">
  <div class="card">

    {{-- Header --}}
    @if ($hero)
      {{-- The background is pre-cut by CardPdf to exactly this box (364 x 200pt at 144 dpi). --}}
      <table style="width: 100%;">
        <tr>
          <td style="height: {{ $heroHeight - 28 }}pt; padding: 14pt 16pt; vertical-align: bottom; background-color: {{ $heroBg }}; @if ($background) background-image: url('{{ $background }}'); background-repeat: no-repeat; background-position: 0 0; @endif border-top-left-radius: 14pt; border-top-right-radius: 14pt; {{ $layout === 'classic' ? 'text-align: center;' : '' }}">
              @if ($layout === 'classic')
                @if ($logo)<img src="{{ $logo }}" style="width: {{ $logoSize }}pt; height: {{ $logoSize }}pt;" />@endif
                <div class="name" style="color: #ffffff; margin-top: 6pt;">{{ $b['name'] }}</div>
                @if ($b['tagline'])<div class="tagline" style="color: #eeeeee;">{{ $b['tagline'] }}</div>@endif
              @else
                <table>
                  <tr>
                    @if ($logo)<td style="padding-right: 10pt; vertical-align: middle;"><img src="{{ $logo }}" style="width: 58pt; height: 58pt;" /></td>@endif
                    <td style="vertical-align: middle;">
                      <div class="name" style="color: {{ $heroText }};">{{ $b['name'] }}</div>
                      @if ($b['tagline'])<div class="tagline" style="color: {{ $heroText }};">{{ $b['tagline'] }}</div>@endif
                    </td>
                  </tr>
                </table>
              @endif
          </td>
        </tr>
      </table>
    @elseif ($layout === 'luxury')
      <div style="text-align: center; padding: 18pt 16pt 4pt;">
        @if ($background)
          <img src="{{ $background }}" style="width: 100%; height: {{ $compact ? 54 : 90 }}pt; border-radius: 10pt; margin-bottom: {{ $compact ? 6 : 10 }}pt;" />
        @endif
        <div style="color: {{ $c['accent'] }}; font-size: 8pt; letter-spacing: 4pt;">&#9670; &#9670; &#9670;</div>
        @if ($logo)<img src="{{ $logo }}" style="width: {{ $logoSize }}pt; height: {{ $logoSize }}pt; margin-top: {{ $compact ? 4 : 8 }}pt;" />@endif
        <div class="name" style="color: {{ $c['accent'] }}; margin-top: 6pt; letter-spacing: 0.5pt;">{{ $b['name'] }}</div>
        @if ($b['tagline'])<div class="tagline" style="color: {{ $muted }}; text-transform: uppercase; letter-spacing: 1.5pt; font-size: 7pt;">{{ $b['tagline'] }}</div>@endif
        <div style="width: 60pt; margin: 10pt auto 0; border-top: 0.75pt solid {{ $c['accent'] }};"></div>
      </div>
    @else
      <div style="padding: 18pt 16pt 6pt;">
        <table style="width: 100%;">
          <tr>
            @if ($logo)<td style="width: 54pt; vertical-align: middle;"><img src="{{ $logo }}" style="width: 46pt; height: 46pt;" /></td>@endif
            <td style="vertical-align: middle;">
              <div class="name" style="color: {{ $nameColor }}; font-size: 17pt;">{{ $b['name'] }}</div>
              @if ($b['tagline'])<div class="tagline" style="color: {{ $muted }};">{{ $b['tagline'] }}</div>@endif
            </td>
          </tr>
        </table>
        @if ($background)
          <img src="{{ $background }}" style="width: 100%; height: 80pt; border-radius: 10pt; margin-top: 10pt;" />
        @endif
      </div>
    @endif

    <div class="section" style="padding-top: 12pt;">
      @if ($b['description'])
        <p class="about">{{ \Illuminate\Support\Str::limit($b['description'], 220) }}</p>
      @endif

      {{-- Actions, two to a row --}}
      @if ($actions)
        <table style="width: 100%; margin-bottom: 8pt;">
          @foreach (array_chunk($actions, 2) as $row)
            <tr>
              @foreach ($row as [$label, $iconName, $href, $color])
                @php [$bg, $fg, $border] = $btn($color); @endphp
                <td style="width: 50%; padding: 3pt;">
                  <a href="{{ $href }}" class="btn" style="background: {{ $bg }}; color: {{ $fg }}; border: 1.2pt solid {{ $border }};"><img src="{{ $icon($iconName, $fg) }}" style="width: 10pt; height: 10pt;" /> {{ $label }}</a>
                </td>
              @endforeach
              @if (count($row) === 1)<td style="width: 50%;"></td>@endif
            </tr>
          @endforeach
        </table>
      @endif

      {{-- Details: each one a link where there is somewhere to go --}}
      <table style="width: 100%;">
        @foreach ($info as [$label, $iconName, $value, $href])
          <tr>
            <td style="width: 30pt; padding: {{ round(4 * $k, 1) }}pt 0; vertical-align: top;">
              <div class="chip"><img src="{{ $icon($iconName, $ink, 11) }}" style="width: 11pt; height: 11pt; margin-top: 5.5pt;" /></div>
            </td>
            <td style="padding: {{ round(4 * $k, 1) }}pt 0; vertical-align: top;">
              <div class="label">{{ $label }}</div>
              @if ($href)
                <a href="{{ $href }}" class="value">{{ $value }}</a>
              @else
                <span class="value">{{ $value }}</span>
              @endif
            </td>
          </tr>
        @endforeach
      </table>

      @if ($b['social'])
        <table style="margin: 8pt auto 0;">
          <tr>
            @foreach ($b['social'] as $network => $url)
              <td style="padding: 0 4pt;">
                <a href="{{ $url }}" style="display: block; padding: 4pt 8pt; border-radius: 10pt; background: {{ $chip }}; color: {{ $ink }}; font-size: 8pt; font-weight: bold;"><img src="{{ $icon($network, $ink, 10) }}" style="width: 9pt; height: 9pt; vertical-align: middle;" /> {{ ucfirst($network) }}</a>
              </td>
            @endforeach
          </tr>
        </table>
      @endif
    </div>

    {{-- The digital card: QR code, its link, and "Save contact" --}}
    <div class="section" style="padding-top: 12pt; padding-bottom: 14pt;">
      <div class="rule"></div>
      @if ($live && $qr)
        <table style="width: 100%; margin-top: 10pt;">
          <tr>
            <td style="width: 84pt; vertical-align: middle;">
              <a href="{{ $b['cardUrl'] }}"><img src="{{ $qr }}" style="width: 76pt; height: 76pt;" /></a>
            </td>
            <td style="vertical-align: middle;">
              <div style="font-weight: bold; font-size: 9pt;">Scan or tap to open our digital card</div>
              <a href="{{ $b['cardUrl'] }}" style="font-size: 7.5pt; color: {{ $ink }};">{{ preg_replace('#^https?://#', '', $b['cardUrl']) }}</a>
              <table style="margin-top: 6pt;">
                <tr>
                  @foreach ([['Open card', 'external-link', $b['cardUrl']], ['Save contact', 'download', $b['vcfUrl']]] as [$label, $iconName, $href])
                    @php [$bg, $fg, $border] = $btn($c['primary']); @endphp
                    <td style="padding-right: 5pt;">
                      <a href="{{ $href }}" class="btn" style="padding: 5pt 8pt; font-size: 8pt; background: {{ $bg }}; color: {{ $fg }}; border: 1pt solid {{ $border }};"><img src="{{ $icon($iconName, $fg, 10) }}" style="width: 9pt; height: 9pt;" /> {{ $label }}</a>
                    </td>
                  @endforeach
                </tr>
              </table>
            </td>
          </tr>
        </table>
      @else
        <p style="margin: 10pt 0 0; color: {{ $muted }}; font-size: 8pt; text-align: center;">Publish your digital card to add its QR code, link and “Save contact” here.</p>
      @endif
      <p style="margin: 10pt 0 0; color: {{ $muted }}; font-size: 6.5pt; text-align: center;">Digital visiting card by Markkito</p>
    </div>
  </div>
</div>
</body>
</html>
