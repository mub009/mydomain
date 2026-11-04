{{-- The public One Review page (App\Http\Controllers\Web\OneReviewPageController):
     what the business's One Review QR code opens — every review and social
     link it has set up (App\Support\OneReview), on one page. Self-contained
     like the visiting card and AI review page: no app CSS or JS. $b is
     escaped by Blade. --}}
@php
    // Brand colours for each link's icon tile.
    $tint = [
        'GOOGLE' => '#ffffff', 'AI_REVIEW' => '#0f9e68', 'FACEBOOK' => '#1877f2', 'MARKKITO_REVIEW' => '#0f172a',
        'INSTAGRAM' => 'linear-gradient(45deg,#f9ce34,#ee2a7b 50%,#6228d7)', 'FACEBOOK_PAGE' => '#1877f2', 'YOUTUBE' => '#ff0000',
        'TIKTOK' => '#010101', 'X' => '#000000', 'LINKEDIN' => '#0a66c2', 'SNAPCHAT' => '#fffc00', 'THREADS' => '#000000',
        'PINTEREST' => '#e60023', 'TELEGRAM' => '#229ed9',
        'WHATSAPP' => '#25d366', 'CALL' => '#0ea5e9', 'WEBSITE' => '#6366f1', 'DIRECTIONS' => '#ea4335',
    ];
    $star = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>';
    $icons = [
        'GOOGLE' => '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
        'AI_REVIEW' => '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
        'FACEBOOK' => '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21z"/></svg>',
        'MARKKITO_REVIEW' => '<svg viewBox="0 0 24 24" fill="#f5b301" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>',
        'INSTAGRAM' => '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="#fff" stroke="none"/></svg>',
        'YOUTUBE' => '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M10 8.5v7l6-3.5z"/></svg>',
        'TIKTOK' => '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#25f4ee" transform="translate(-.8 -.6)" d="M16.5 3c.3 2.1 1.6 3.6 3.5 3.9v3a7.3 7.3 0 0 1-3.5-1.1v6.4A5.8 5.8 0 1 1 10.7 9.4v3.1a2.8 2.8 0 1 0 2.8 2.8V3z"/><path fill="#fe2c55" transform="translate(.8 .6)" d="M16.5 3c.3 2.1 1.6 3.6 3.5 3.9v3a7.3 7.3 0 0 1-3.5-1.1v6.4A5.8 5.8 0 1 1 10.7 9.4v3.1a2.8 2.8 0 1 0 2.8 2.8V3z"/><path fill="#fff" d="M16.5 3c.3 2.1 1.6 3.6 3.5 3.9v3a7.3 7.3 0 0 1-3.5-1.1v6.4A5.8 5.8 0 1 1 10.7 9.4v3.1a2.8 2.8 0 1 0 2.8 2.8V3z"/></svg>',
        'X' => '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.9zm-1.1 16.2h1.7L7.4 4.7H5.6z"/></svg>',
        'LINKEDIN' => '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M6.9 8.8H3.6V20h3.3zM5.2 3.5a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8zM20.4 13.4c0-3-1.6-4.9-4.3-4.9-1.6 0-2.6.9-3 1.6V8.8H9.9V20h3.3v-5.9c0-1.5.6-2.6 2-2.6s1.9 1.1 1.9 2.6V20h3.3z"/></svg>',
        'SNAPCHAT' => '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round" d="M12 3c3 0 5 2.2 5 5v2.2l1.6-.5c.6-.1 1 .6.5 1l-1.8 1.1c.6 1.9 1.9 3.2 3.7 3.7-.3.8-1.4 1.1-2.6 1.2l-.4 1.3-1.9-.2c-.9 0-1.6.9-4.1 1.7-2.5-.8-3.2-1.7-4.1-1.7l-1.9.2-.4-1.3c-1.2-.1-2.3-.4-2.6-1.2 1.8-.5 3.1-1.8 3.7-3.7l-1.8-1.1c-.5-.4-.1-1.1.5-1l1.6.5V8c0-2.8 2-5 5-5z"/></svg>',
        'THREADS' => '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M16.6 11.2l-.3-.1c-.2-2.9-1.8-4.6-4.5-4.6-1.6 0-3 .7-3.8 2l1.5 1c.6-.9 1.5-1.1 2.3-1.1 1 0 1.7.3 2.1.9.3.4.5 1 .6 1.7-.8-.1-1.6-.2-2.5-.1-2.5.1-4.1 1.6-4 3.7.1 1 .6 2 1.5 2.5.8.5 1.7.7 2.7.7 1.3-.1 2.3-.6 3-1.5.5-.7.9-1.6 1-2.7.6.4 1.1.9 1.3 1.5.4 1 .4 2.6-.9 3.9-1.1 1.1-2.5 1.6-4.6 1.7-2.3 0-4.1-.8-5.2-2.2-1.1-1.3-1.6-3.2-1.6-5.5s.5-4.2 1.6-5.5c1.1-1.4 2.9-2.1 5.2-2.2 2.3 0 4.1.8 5.3 2.2.6.7 1 1.6 1.3 2.6l1.7-.5c-.4-1.3-.9-2.4-1.7-3.3-1.6-1.8-3.8-2.7-6.7-2.8-2.9 0-5.1 1-6.6 2.8C4.1 7 3.4 9.3 3.4 12s.7 5 2 6.7c1.5 1.8 3.7 2.8 6.6 2.8 2.6 0 4.4-.7 5.9-2.2 2-2 1.9-4.4 1.3-5.9-.5-1-1.3-1.8-2.6-2.2zm-4.5 4.4c-1.1.1-2.2-.4-2.3-1.4 0-.8.6-1.6 2.4-1.7h.7c.6 0 1.2.1 1.7.2-.2 2.4-1.4 2.8-2.5 2.9z"/></svg>',
        'PINTEREST' => '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 2.5a9.5 9.5 0 0 0-3.5 18.3c-.1-.8-.2-2 0-2.8l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.5 1.8-2.5.9 0 1.3.6 1.3 1.4 0 .9-.5 2.1-.8 3.3-.2 1 .5 1.8 1.5 1.8 1.8 0 3.2-1.9 3.2-4.7 0-2.4-1.8-4.1-4.3-4.1-2.9 0-4.6 2.2-4.6 4.4 0 .9.3 1.8.8 2.3l.1.3-.3 1.2c0 .2-.2.2-.4.1-1.3-.6-2.1-2.5-2.1-4 0-3.3 2.4-6.3 6.9-6.3 3.6 0 6.4 2.6 6.4 6 0 3.6-2.3 6.5-5.4 6.5-1.1 0-2.1-.6-2.4-1.2l-.7 2.5c-.2.9-.9 2.1-1.3 2.8A9.5 9.5 0 1 0 12 2.5z"/></svg>',
        'TELEGRAM' => '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M20.7 4.3 2.9 11.2c-1.2.5-1.2 1.2-.2 1.5l4.6 1.4 1.7 5.4c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.4-2.3 4.8 3.6c.9.5 1.5.2 1.7-.8l3.2-15c.3-1.3-.5-1.9-1.4-1.5zM8.4 13.8l9.4-5.9c.5-.3.9-.1.5.2l-8 7.3-.3 3.3z"/></svg>',
        'WHATSAPP' => '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 2.5a9.4 9.4 0 0 0-8.1 14.2L2.5 21.5l4.9-1.3A9.4 9.4 0 1 0 12 2.5zm0 17.2c-1.5 0-2.9-.4-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A7.8 7.8 0 1 1 12 19.7zm4.3-5.8c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.4 6.4 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1s.2-1.1.1-1.1-.2-.2-.4-.3z"/></svg>',
        'CALL' => '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
        'WEBSITE' => '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
        'DIRECTIONS' => '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    ];
    $icons['FACEBOOK_PAGE'] = $icons['FACEBOOK'];
    $chevron = '<svg class="go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
    $external = fn ($l) => ! in_array($l['key'], ['CALL'], true);
@endphp
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="only light" />
  <meta name="robots" content="noindex" />
  <meta name="format-detection" content="telephone=no" />
  <title>{{ $b['name'] }} · Review &amp; follow us</title>
  <meta property="og:title" content="{{ $b['name'] }} — review &amp; follow us" />
  @if ($b['logoUrl'])<meta property="og:image" content="{{ $b['logoUrl'] }}" />@endif
  <style>
    /* Shared layout; each .t-<style> below only changes the variables (and a few touches). */
    :root{--accent:#0f9e68;--ink:#0f172a;--ink2:#334155;--muted:#64748b;--line:#e8edf3;--star:#f5b301;
      --bg:#f1f5f9;--card:#ffffff;--pill:#f8fafc;--hero:linear-gradient(135deg,#0f172a,#134e4a 55%,#0f9e68);
      --logo-bg:#ecfdf5;--radius:22px;--shadow:0 14px 36px -16px rgba(15,23,42,.28);--font:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif;color-scheme:only light}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0}
    body{min-height:100vh;background:var(--bg);background-attachment:fixed;color:var(--ink);font-family:var(--font);-webkit-font-smoothing:antialiased;line-height:1.45}
    a{color:inherit;text-decoration:none}
    .page{position:relative;max-width:480px;margin:0 auto;padding:0 0 calc(28px + env(safe-area-inset-bottom))}
    .hero{position:relative;height:150px;background:var(--hero);overflow:hidden}
    .hero img{width:100%;height:100%;object-fit:cover;display:block}
    .hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,23,42,0) 40%,rgba(15,23,42,.35))}
    .profile,.social{background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow)}
    .profile{position:relative;margin:-56px 16px 0;padding:0 18px 20px;text-align:center}
    .logo{width:88px;height:88px;margin:0 auto;transform:translateY(-38px);margin-bottom:-26px;border-radius:24px;overflow:hidden;background:var(--logo-bg);border:4px solid var(--card);box-shadow:0 6px 18px -6px rgba(15,23,42,.3);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:28px;color:var(--accent)}
    .logo img{width:100%;height:100%;object-fit:cover;display:block}
    h1{margin:0;font-size:22px;line-height:1.2;font-weight:800;letter-spacing:-.01em}
    .tagline{margin:4px 0 0;font-size:13.5px;color:var(--muted)}
    .meta{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:12px}
    .pill{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;padding:5px 10px;border-radius:999px;background:var(--pill);border:1px solid var(--line);color:var(--ink2)}
    .pill.ok{color:var(--accent)}
    .pill svg{width:13px;height:13px}
    .pill .st{color:var(--star)}
    .thanks{margin:14px 0 0;font-size:14px;color:var(--ink2)}
    section{margin:18px 16px 0}
    h2{margin:0 0 14px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
    .social{padding:18px 14px 16px;text-align:center}
    .icons{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
    .icon{width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px -8px rgba(15,23,42,.45);transition:transform .12s;-webkit-tap-highlight-color:transparent}
    .icon:active{transform:scale(.92)}
    .icon svg{width:26px;height:26px}
    .icon.google{border:1px solid #e8edf3}
    .icon.google svg{width:28px;height:28px}
    .hint{margin:14px 0 0;font-size:12.5px;color:var(--muted)}
    .empty{background:var(--card);border-radius:16px;padding:18px;text-align:center;color:var(--muted);font-size:14px}
    footer{margin-top:28px;text-align:center;font-size:11.5px;color:var(--muted)}
    footer a{font-weight:700;color:var(--ink2)}
    .backdrop{display:none}

    /* 2 Minimal: plain white, no banner, hairlines instead of shadows, square icons. */
    .t-minimal{--bg:#ffffff;--shadow:none;--pill:#ffffff;--line:#e5e7eb;--ink:#111827;--ink2:#374151;--accent:#111827;--logo-bg:#f3f4f6}
    .t-minimal .hero{display:none}
    .t-minimal .profile{margin-top:36px;padding-top:4px}
    .t-minimal .logo{transform:none;margin-bottom:14px;border-radius:50%;border-color:#f3f4f6}
    .t-minimal .social{border-top:1px solid var(--line);border-radius:0;padding-top:22px}
    .t-minimal .icon{border-radius:14px;box-shadow:none}

    /* 3 Midnight: deep navy, soft glow. */
    .t-midnight{--bg:#0b1120;--card:#111a2e;--ink:#f1f5f9;--ink2:#cbd5e1;--muted:#94a3b8;--line:#1e293b;--pill:#0f172a;--accent:#22d3ee;--logo-bg:#0f172a;
      --hero:linear-gradient(135deg,#1e1b4b,#0f172a 60%,#0e7490);--shadow:0 20px 40px -20px rgba(0,0,0,.8)}

    /* 4 Sunset: warm gradient page, white cards. */
    .t-sunset{--bg:linear-gradient(160deg,#ff9a5a,#ff5e7e 55%,#a855f7);--hero:transparent;--ink:#3b0a2a;--ink2:#5b2140;--muted:#9d4b6c;--accent:#e11d48;--pill:#fff1f2;--line:#fde2e8;--logo-bg:#fff1f2;--radius:26px}
    .t-sunset .hero::after,.t-ocean .hero::after{display:none}
    .t-sunset footer,.t-sunset footer a,.t-ocean footer,.t-ocean footer a{color:#fff}

    /* 5 Ocean: blue gradient page, white cards. */
    .t-ocean{--bg:linear-gradient(160deg,#0ea5e9,#2563eb 60%,#1e3a8a);--hero:transparent;--ink:#0c1e4a;--ink2:#1e3a8a;--muted:#5b6b94;--accent:#2563eb;--pill:#eff6ff;--line:#dbeafe;--logo-bg:#eff6ff}

    /* 6 Forest: deep green with a cream card. */
    .t-forest{--bg:#14532d;--card:#fefce8;--ink:#1a2e05;--ink2:#3f4f24;--muted:#6b7a4d;--line:#e7e5c8;--pill:#f7f5dc;--accent:#15803d;--logo-bg:#f7f5dc;
      --hero:linear-gradient(135deg,#052e16,#166534);--font:Georgia,"Times New Roman",serif}
    .t-forest footer,.t-forest footer a{color:#d9f99d}

    /* 7 Royal Gold: black and gold, serif — suits jewellers. */
    .t-gold{--bg:#0a0a0a;--card:#141414;--ink:#f5e6c4;--ink2:#e7d3a6;--muted:#a8946b;--line:#3a3224;--pill:#1c1813;--accent:#e7c873;--logo-bg:#1c1813;
      --hero:linear-gradient(135deg,#3a2a10,#b8860b 50%,#1a1206);--shadow:0 0 0 1px #3a3224,0 20px 40px -20px rgba(0,0,0,.9)}
    .t-gold h1{font-family:Georgia,"Times New Roman",serif;color:#e7c873;letter-spacing:.02em}
    .t-gold .logo{border-color:#c9a227}
    .t-gold .icon{box-shadow:0 0 0 2px #141414,0 0 0 3.5px #c9a227}

    /* 8 Pastel: soft pink and lilac, extra round. */
    .t-pastel{--bg:linear-gradient(180deg,#fdf2f8,#ede9fe);--ink:#4c1d95;--ink2:#6d28d9;--muted:#8b5cf6;--line:#ede9fe;--pill:#faf5ff;--accent:#a21caf;--logo-bg:#fdf4ff;
      --hero:linear-gradient(135deg,#fbcfe8,#c4b5fd);--radius:32px;--shadow:0 16px 34px -18px rgba(139,92,246,.45)}
    .t-pastel .logo{border-radius:50%}

    /* 9 Neon: black with glowing rings. */
    .t-neon{--bg:#05010f;--card:#0d0620;--ink:#f5f3ff;--ink2:#ddd6fe;--muted:#a78bfa;--line:#2e1065;--pill:#140a2e;--accent:#e879f9;--logo-bg:#140a2e;
      --hero:linear-gradient(135deg,#7c3aed,#db2777 50%,#06b6d4);--shadow:0 0 0 1px #2e1065,0 0 40px -10px rgba(168,85,247,.55)}
    .t-neon h1{text-shadow:0 0 14px rgba(232,121,249,.8)}
    .t-neon .icon{box-shadow:0 0 0 2px #0d0620,0 0 0 4px #a855f7,0 0 18px #a855f7}

    /* 10 Glass: the cover photo (or a gradient) blurred behind frosted cards. */
    .t-glass{--bg:#0f172a;--card:rgba(255,255,255,.14);--ink:#ffffff;--ink2:rgba(255,255,255,.9);--muted:rgba(255,255,255,.75);--line:rgba(255,255,255,.25);--pill:rgba(255,255,255,.12);--accent:#a7f3d0;--logo-bg:rgba(255,255,255,.2);
      --hero:transparent;--shadow:0 20px 40px -20px rgba(0,0,0,.6)}
    .t-glass .backdrop{display:block;position:fixed;inset:-40px;z-index:0;background:linear-gradient(135deg,#334155,#64748b 50%,#0f9e68) center/cover;filter:blur(28px) saturate(1.2);transform:scale(1.1)}
    .t-glass .hero::after{display:none}
    .t-glass .profile,.t-glass .social{-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.25)}
    .t-glass .logo{border-color:rgba(255,255,255,.5)}
    .t-glass .page{z-index:1}
  </style>
</head>
<body class="t-{{ $style }}">
  {{-- Glass: the cover photo, blurred, behind everything. --}}
  <div class="backdrop" @if ($b['coverImageUrl']) style="background-image:url('{{ $b['coverImageUrl'] }}')" @endif></div>
  <div class="page">
    <div class="hero">@if ($b['coverImageUrl'])<img src="{{ $b['coverImageUrl'] }}" alt="" />@endif</div>

    <header class="profile">
      <div class="logo">@if ($b['logoUrl'])<img src="{{ $b['logoUrl'] }}" alt="{{ $b['name'] }} logo" />@else{{ $b['initials'] }}@endif</div>
      <h1>{{ $b['name'] }}</h1>
      @if ($b['tagline'])<p class="tagline">{{ $b['tagline'] }}</p>@endif
      <div class="meta">
        <span class="pill ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Verified business</span>
        @if ($rating)
          <span class="pill"><span class="st">{!! $star !!}</span> {{ number_format($rating['avg'], 1) }} · {{ number_format($rating['count']) }} {{ $rating['count'] === 1 ? 'review' : 'reviews' }}</span>
        @endif
      </div>
      <p class="thanks">Thank you for visiting! Your review helps us grow.</p>
    </header>

    @if (! $links)
      <section><p class="empty">Links are coming soon.</p></section>
    @endif

    @if ($links)
      <section class="social">
        <h2>Review &amp; follow us</h2>
        <nav class="icons" aria-label="Review and follow {{ $b['name'] }}">
          @foreach ($links as $l)
            <a class="icon {{ $l['key'] === 'GOOGLE' ? 'google' : '' }}" href="{{ $l['href'] }}" data-link="{{ $l['key'] }}" rel="noopener"
               style="background:{{ $tint[$l['key']] }}" aria-label="{{ $l['label'] }}" title="{{ $l['label'] }}">{!! $icons[$l['key']] !!}</a>
          @endforeach
        </nav>
        <p class="hint">Tap an icon to review or follow us</p>
      </section>
    @endif

    <footer>Powered by <a href="{{ config('frontend.origin') }}" rel="noopener">Markkito</a></footer>
  </div>

  <script>
    (function () {
      var slug = @json($slug);
      document.querySelectorAll("[data-link]").forEach(function (a) {
        a.addEventListener("click", function () {
          try {
            fetch("/api/v1/one-review/" + encodeURIComponent(slug) + "/tap", {
              method: "POST", keepalive: true,
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ link: a.dataset.link }),
            }).catch(function () {});
          } catch (e) {}
        });
      });
    })();
  </script>
</body>
</html>
