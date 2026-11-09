{{-- An image card as a PDF page (App\Support\Cards\CardPdf::renderImage):
     the artwork fills the page and each action is an <a href> over its
     spot, which dompdf turns into a clickable link. --}}
<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>{{ $name }}</title>
  <style>
    @page{margin:0}
    html,body{margin:0;padding:0}
    .page{position:relative;width:{{ $width }}pt;height:{{ $height }}pt;overflow:hidden}
    .page img.art{position:absolute;left:0;top:0;width:{{ $width }}pt;height:{{ $height }}pt}
    .page .pic{position:absolute}
    .page .pic img{width:100%;height:100%}
    .page .detail{position:absolute;overflow:hidden;line-height:1.2}
    {{-- Empty: just a clickable area over the artwork's own button. (dompdf has no
         transparent text, so a name inside would be printed on the card.) --}}
    .page a{position:absolute;display:block;text-decoration:none}
  </style>
</head>
<body>
  <div class="page">
    <img class="art" src="{{ $image }}" alt="" />
    @foreach ($spots as $s)
      @if ($s['kind'] === 'image')
        <div class="pic" style="{{ $s['box'] }}"><img src="{{ $s['src'] }}" alt="" /></div>
      @elseif ($s['kind'] === 'text')
        <div class="detail" style="{{ $s['box'] }};{{ $s['textStyle'] }}">{!! nl2br(e($s['display'])) !!}</div>
      @endif
      @if ($s['href'] && $s['href'] !== '#')
        <a href="{{ $s['href'] }}" style="{{ $s['box'] }}" title="{{ $s['text'] }}"></a>
      @endif
    @endforeach
  </div>
</body>
</html>
