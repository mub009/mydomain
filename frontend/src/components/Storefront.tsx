import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { shopApi, type PlacedOrder, type PublishedSite } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Product } from "@/types";
import { Spinner } from "@/components/Loading";

const PAGE_SIZE = 12;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface CartLine {
  productId: string;
  quantity: number;
}

function money(cents: number, currency = "INR"): string {
  const symbol = currency === "INR" ? "₹" : "";
  return `${symbol}${(cents / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function to12Hour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}.${String(m).padStart(2, "0")}${period}` : `${hour}${period}`;
}

// A shopper who half-filled a basket and reloaded should still have it. Scoped
// per shop so two storefronts in the same browser never share a cart.
function cartKey(slug: string): string {
  return `mk-cart:${slug}`;
}

function readCart(slug: string): CartLine[] {
  try {
    const raw = window.localStorage.getItem(cartKey(slug));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (line): line is CartLine =>
        typeof line?.productId === "string" && Number.isInteger(line?.quantity) && line.quantity > 0,
    );
  } catch {
    return [];
  }
}

/**
 * A working shop: catalogue, cart and checkout. Storefronts are rendered by
 * the app rather than served as authored markup — published builder pages have
 * their scripts stripped, so a cart could not run there — and the design the
 * owner picked comes through as a palette.
 */
export default function Storefront({ site }: { site: PublishedSite }) {
  const { business, theme } = site;
  const slug = business.slug;

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [cart, setCart] = useState<CartLine[]>(() => readCart(slug));
  const [cartOpen, setCartOpen] = useState(false);
  const [view, setView] = useState<"shop" | "checkout" | "done">("shop");
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  // Catalogue. Page 1 replaces, later pages append — the grid is a "load more"
  // list, which is how people browse a shop.
  useEffect(() => {
    let cancelled = false;
    if (page === 1) setLoading(true);
    else setLoadingMore(true);

    shopApi
      .products(slug, { page, pageSize: PAGE_SIZE, ...(appliedSearch ? { search: appliedSearch } : {}) })
      .then((res) => {
        if (cancelled) return;
        setProducts((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
        setTotal(res.meta.total);
      })
      .catch((err) => !cancelled && setError(apiErrorMessage(err)))
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setLoadingMore(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, page, appliedSearch]);

  useEffect(() => {
    window.localStorage.setItem(cartKey(slug), JSON.stringify(cart));
  }, [cart, slug]);

  useEffect(() => {
    document.title = `${business.name} — Order online`;
  }, [business.name]);

  // Products the cart refers to. Anything the shop has since removed simply
  // drops out rather than blocking checkout with a stale line.
  const cartLines = useMemo(
    () =>
      cart
        .map((line) => ({ line, product: products.find((p) => p.id === line.productId) }))
        .filter((entry): entry is { line: CartLine; product: Product } => !!entry.product),
    [cart, products],
  );

  const itemCount = cartLines.reduce((sum, { line }) => sum + line.quantity, 0);
  const subtotal = cartLines.reduce((sum, { line, product }) => sum + product.priceCents * line.quantity, 0);
  const currency = products[0]?.currency ?? "INR";

  const freeAbove = site.storefront?.freeDeliveryAboveCents ?? null;
  const baseFee = site.storefront?.deliveryFeeCents ?? 0;
  const deliveryFee = freeAbove != null && subtotal >= freeAbove ? 0 : baseFee;
  const orderTotal = subtotal + deliveryFee;

  function inCart(productId: string): number {
    return cart.find((line) => line.productId === productId)?.quantity ?? 0;
  }

  function setQuantity(productId: string, quantity: number) {
    setCart((prev) => {
      const without = prev.filter((line) => line.productId !== productId);
      return quantity > 0 ? [...without, { productId, quantity }] : without;
    });
  }

  function addToCart(product: Product) {
    const next = inCart(product.id) + 1;
    if (product.trackStock && next > product.stock) return;
    setQuantity(product.id, next);
    setCartOpen(true);
  }

  function runSearch(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  }

  const address = [business.addressLine1, business.addressLine2, business.city, business.state, business.postalCode]
    .filter(Boolean)
    .join(", ");
  const whatsapp = `https://wa.me/${business.phone.replace(/[^0-9]/g, "")}`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`;
  const banner = business.photos[0]?.url ?? null;

  // The theme travels as CSS variables so every rule below is written once.
  const cssVars = {
    "--sf-accent": theme.accent,
    "--sf-accent-alt": theme.accentAlt,
    "--sf-on-accent": theme.onAccent,
    "--sf-bg": theme.bg,
    "--sf-surface": theme.surface,
    "--sf-text": theme.text,
    "--sf-muted": theme.muted,
    "--sf-line": theme.line,
    "--sf-header-bg": theme.headerBg,
    "--sf-header-text": theme.headerText,
    "--sf-radius": theme.radius,
    "--sf-font": theme.font,
    "--sf-heading": theme.heading,
  } as React.CSSProperties;

  return (
    <div className="mk-shop" style={cssVars}>
      <style>{STOREFRONT_CSS}</style>

      <header className="sf-header">
        <div className="sf-header-inner">
          <a className="sf-brand" href="#top">
            {business.logoUrl ? (
              <img className="sf-logo" src={business.logoUrl} alt={business.name} />
            ) : (
              <span className="sf-logo sf-logo-text">{business.name.trim().charAt(0).toUpperCase()}</span>
            )}
            <span className="sf-brand-text">
              <strong style={{ textTransform: theme.uppercase ? "uppercase" : "none" }}>{business.name}</strong>
              <small>{business.city}</small>
            </span>
          </a>

          <form className="sf-search" onSubmit={runSearch}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
            />
            <button type="submit">Search</button>
          </form>

          <button className="sf-cart-btn" onClick={() => setCartOpen(true)} aria-label="Open cart">
            <CartIcon />
            <span>Cart</span>
            {itemCount > 0 && <em className="sf-badge">{itemCount}</em>}
          </button>
        </div>
      </header>

      <section className="sf-hero" id="top">
        {banner && <img className="sf-hero-img" src={banner} alt="" />}
        <div className="sf-hero-body">
          <h1 style={{ fontFamily: theme.heading }}>{business.name}</h1>
          {business.description && <p className="sf-hero-sub">{business.description}</p>}
          <div className="sf-hero-meta">
            {business.avgRating > 0 && (
              <span className="sf-pill">
                ★ {business.avgRating.toFixed(1)} · {business.reviewCount} reviews
              </span>
            )}
            <span className="sf-pill">{business.city}</span>
            {baseFee === 0 ? (
              <span className="sf-pill">Free delivery</span>
            ) : freeAbove != null ? (
              <span className="sf-pill">Free delivery over {money(freeAbove, currency)}</span>
            ) : (
              <span className="sf-pill">Delivery {money(baseFee, currency)}</span>
            )}
          </div>
          <div className="sf-hero-actions">
            <a className="sf-btn sf-btn-primary" href={`tel:${business.phone}`}>
              Call {business.phone}
            </a>
            <a className="sf-btn sf-btn-ghost" href={whatsapp} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
            <a className="sf-btn sf-btn-ghost" href={directions} target="_blank" rel="noreferrer">
              Directions
            </a>
          </div>
        </div>
      </section>

      {view === "shop" && (
        <main className="sf-main">
          <div className="sf-main-head">
            <h2 style={{ fontFamily: theme.heading }}>
              {appliedSearch ? `Results for “${appliedSearch}”` : "Shop our products"}
            </h2>
            <p className="sf-count">
              {total === 0 ? "Nothing here yet" : `Showing ${products.length} of ${total}`}
              {appliedSearch && (
                <button
                  className="sf-link"
                  onClick={() => {
                    setSearch("");
                    setAppliedSearch("");
                    setPage(1);
                  }}
                >
                  Clear search
                </button>
              )}
            </p>
          </div>

          {error && <p className="sf-error">{error}</p>}

          {loading ? (
            <div className="sf-loading">
              <Spinner label="Loading products…" />
            </div>
          ) : products.length === 0 ? (
            <p className="sf-empty">
              {appliedSearch
                ? "No products matched your search. Try a different word."
                : "This shop has not listed any products yet."}
            </p>
          ) : (
            <>
              <div className="sf-grid">
                {products.map((product) => {
                  const qty = inCart(product.id);
                  const soldOut = product.trackStock && product.stock <= 0;
                  const atLimit = product.trackStock && qty >= product.stock;
                  return (
                    <article className="sf-card" key={product.id}>
                      <div className="sf-card-img">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} loading="lazy" />
                        ) : (
                          <span className="sf-noimg">{product.name.charAt(0).toUpperCase()}</span>
                        )}
                        {soldOut && <span className="sf-soldout">Sold out</span>}
                        {!soldOut && product.compareAtCents && product.compareAtCents > product.priceCents && (
                          <span className="sf-save">
                            Save {money(product.compareAtCents - product.priceCents, product.currency)}
                          </span>
                        )}
                      </div>
                      <div className="sf-card-body">
                        <h3>{product.name}</h3>
                        {product.description && <p className="sf-desc">{product.description}</p>}
                        <p className="sf-price">
                          {money(product.priceCents, product.currency)}
                          {product.compareAtCents && product.compareAtCents > product.priceCents && (
                            <s>{money(product.compareAtCents, product.currency)}</s>
                          )}
                        </p>
                        {product.trackStock && !soldOut && product.stock <= 5 && (
                          <p className="sf-lowstock">Only {product.stock} left</p>
                        )}

                        {soldOut ? (
                          <button className="sf-btn sf-btn-disabled" disabled>
                            Sold out
                          </button>
                        ) : qty === 0 ? (
                          <button className="sf-btn sf-btn-primary" onClick={() => addToCart(product)}>
                            Add to cart
                          </button>
                        ) : (
                          <div className="sf-stepper">
                            <button onClick={() => setQuantity(product.id, qty - 1)} aria-label="Remove one">
                              −
                            </button>
                            <span>{qty}</span>
                            <button
                              onClick={() => setQuantity(product.id, qty + 1)}
                              disabled={atLimit}
                              aria-label="Add one"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              {products.length < total && (
                <div className="sf-more">
                  <button className="sf-btn sf-btn-ghost" onClick={() => setPage((p) => p + 1)} disabled={loadingMore}>
                    {loadingMore ? "Loading…" : `Load more (${total - products.length} left)`}
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      )}

      {view === "checkout" && (
        <Checkout
          slug={slug}
          lines={cartLines}
          subtotal={subtotal}
          deliveryFee={deliveryFee}
          orderTotal={orderTotal}
          currency={currency}
          defaultCity={business.city}
          onBack={() => setView("shop")}
          onPlaced={(order) => {
            setPlaced(order);
            setCart([]);
            setCartOpen(false);
            setView("done");
            window.scrollTo({ top: 0 });
          }}
        />
      )}

      {view === "done" && placed && (
        <main className="sf-main sf-done">
          <div className="sf-done-card">
            <span className="sf-tick">✓</span>
            <h2 style={{ fontFamily: theme.heading }}>Thank you, your order is in</h2>
            <p className="sf-done-num">
              Order <strong>{placed.orderNumber}</strong>
            </p>
            <ul className="sf-done-list">
              {placed.items.map((item, i) => (
                <li key={i}>
                  <span>
                    {item.quantity} × {item.name}
                  </span>
                  <span>{money(item.lineTotalCents, placed.currency)}</span>
                </li>
              ))}
            </ul>
            <p className="sf-done-total">
              <span>Total to pay on delivery</span>
              <strong>{money(placed.totalCents, placed.currency)}</strong>
            </p>
            <p className="sf-done-note">
              {business.name} will call you on the number you gave to confirm. Keep your order number handy.
            </p>
            <button
              className="sf-btn sf-btn-primary"
              onClick={() => {
                setPlaced(null);
                setView("shop");
                setPage(1);
              }}
            >
              Continue shopping
            </button>
          </div>
        </main>
      )}

      <footer className="sf-footer">
        <div className="sf-footer-inner">
          <div>
            <h4>{business.name}</h4>
            <p>{address}</p>
            <p>
              <a href={`tel:${business.phone}`}>{business.phone}</a>
              {business.email && (
                <>
                  {" · "}
                  <a href={`mailto:${business.email}`}>{business.email}</a>
                </>
              )}
            </p>
          </div>
          {business.hours.length > 0 && (
            <div>
              <h4>Opening hours</h4>
              <ul className="sf-hours">
                {business.hours.map((h) => (
                  <li key={h.dayOfWeek}>
                    <span>{DAY_NAMES[h.dayOfWeek]}</span>
                    <span>{h.isClosed ? "Closed" : `${to12Hour(h.openTime)} – ${to12Hour(h.closeTime)}`}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h4>Find us</h4>
            <div className="sf-map">
              <iframe
                src={`https://maps.google.com/maps?q=${business.latitude},${business.longitude}&z=16&output=embed`}
                title={`Map to ${business.name}`}
                loading="lazy"
              />
            </div>
            <a className="sf-link" href={directions} target="_blank" rel="noreferrer">
              Get directions
            </a>
          </div>
        </div>
        <p className="sf-copy">
          © {new Date().getFullYear()} {business.name} ·{" "}
          <Link to={`/business/${business.slug}`}>View on Markkito</Link>
        </p>
      </footer>

      {/* Floating contact buttons, same as the brochure designs carry. */}
      <div className="sf-float">
        <a className="sf-float-btn sf-float-wa" href={whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp">
          <WhatsAppIcon />
        </a>
        <a className="sf-float-btn sf-float-call" href={`tel:${business.phone}`} aria-label="Call">
          <PhoneIcon />
        </a>
      </div>

      {/* Cart drawer */}
      {cartOpen && (
        <div className="sf-drawer-wrap" role="dialog" aria-label="Your cart">
          <div className="sf-scrim" onClick={() => setCartOpen(false)} />
          <aside className="sf-drawer">
            <div className="sf-drawer-head">
              <h3>Your cart ({itemCount})</h3>
              <button onClick={() => setCartOpen(false)} aria-label="Close cart">
                ✕
              </button>
            </div>

            {cartLines.length === 0 ? (
              <p className="sf-empty">Your cart is empty. Add something tasty.</p>
            ) : (
              <>
                <ul className="sf-drawer-list">
                  {cartLines.map(({ line, product }) => (
                    <li key={product.id}>
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" />
                      ) : (
                        <span className="sf-noimg sf-noimg-sm">{product.name.charAt(0)}</span>
                      )}
                      <div className="sf-drawer-info">
                        <strong>{product.name}</strong>
                        <span>{money(product.priceCents, product.currency)} each</span>
                        <div className="sf-stepper sf-stepper-sm">
                          <button onClick={() => setQuantity(product.id, line.quantity - 1)}>−</button>
                          <span>{line.quantity}</span>
                          <button
                            onClick={() => setQuantity(product.id, line.quantity + 1)}
                            disabled={product.trackStock && line.quantity >= product.stock}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="sf-drawer-right">
                        <strong>{money(product.priceCents * line.quantity, product.currency)}</strong>
                        <button className="sf-link" onClick={() => setQuantity(product.id, 0)}>
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="sf-totals">
                  <p>
                    <span>Subtotal</span>
                    <span>{money(subtotal, currency)}</span>
                  </p>
                  <p>
                    <span>Delivery</span>
                    <span>{deliveryFee === 0 ? "Free" : money(deliveryFee, currency)}</span>
                  </p>
                  {freeAbove != null && subtotal < freeAbove && (
                    <p className="sf-nudge">
                      Add {money(freeAbove - subtotal, currency)} more for free delivery
                    </p>
                  )}
                  <p className="sf-grand">
                    <span>Total</span>
                    <strong>{money(orderTotal, currency)}</strong>
                  </p>
                </div>

                <button
                  className="sf-btn sf-btn-primary sf-checkout-btn"
                  onClick={() => {
                    setCartOpen(false);
                    setView("checkout");
                    window.scrollTo({ top: 0 });
                  }}
                >
                  Proceed to checkout
                </button>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

// --- Checkout ---------------------------------------------------------------

function Checkout({
  slug,
  lines,
  subtotal,
  deliveryFee,
  orderTotal,
  currency,
  defaultCity,
  onBack,
  onPlaced,
}: {
  slug: string;
  lines: { line: CartLine; product: Product }[];
  subtotal: number;
  deliveryFee: number;
  orderTotal: number;
  currency: string;
  defaultCity: string;
  onBack: () => void;
  onPlaced: (order: PlacedOrder) => void;
}) {
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    addressLine1: "",
    addressLine2: "",
    city: defaultCity,
    postalCode: "",
    notes: "",
  });
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPlacing(true);
    setError("");
    try {
      const order = await shopApi.checkout(slug, {
        items: lines.map(({ line }) => ({ productId: line.productId, quantity: line.quantity })),
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerEmail: form.customerEmail.trim() || undefined,
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim() || undefined,
        city: form.city.trim(),
        postalCode: form.postalCode.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      onPlaced(order);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPlacing(false);
    }
  }

  if (lines.length === 0) {
    return (
      <main className="sf-main">
        <p className="sf-empty">Your cart is empty.</p>
        <div className="sf-more">
          <button className="sf-btn sf-btn-ghost" onClick={onBack}>
            Back to the shop
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="sf-main">
      <button className="sf-link sf-back" onClick={onBack}>
        ← Back to the shop
      </button>

      <div className="sf-checkout">
        <form className="sf-form" onSubmit={submit}>
          <h2>Delivery details</h2>
          <div className="sf-row">
            <label>
              Your name *
              <input required value={form.customerName} onChange={(e) => set("customerName", e.target.value)} />
            </label>
            <label>
              Phone number *
              <input
                required
                type="tel"
                value={form.customerPhone}
                onChange={(e) => set("customerPhone", e.target.value)}
              />
            </label>
          </div>
          <label>
            Email (for your receipt)
            <input type="email" value={form.customerEmail} onChange={(e) => set("customerEmail", e.target.value)} />
          </label>
          <label>
            Address *
            <input required value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} />
          </label>
          <label>
            Apartment, landmark (optional)
            <input value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} />
          </label>
          <div className="sf-row">
            <label>
              City *
              <input required value={form.city} onChange={(e) => set("city", e.target.value)} />
            </label>
            <label>
              PIN code
              <input value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
            </label>
          </div>
          <label>
            Notes for the shop
            <textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </label>

          {error && <p className="sf-error">{error}</p>}

          <button className="sf-btn sf-btn-primary sf-place" disabled={placing}>
            {placing ? "Placing your order…" : `Place order · ${money(orderTotal, currency)}`}
          </button>
          <p className="sf-cod">Pay cash on delivery. The shop will call to confirm.</p>
        </form>

        <aside className="sf-summary">
          <h2>Order summary</h2>
          <ul>
            {lines.map(({ line, product }) => (
              <li key={product.id}>
                <span>
                  {line.quantity} × {product.name}
                </span>
                <span>{money(product.priceCents * line.quantity, product.currency)}</span>
              </li>
            ))}
          </ul>
          <p>
            <span>Subtotal</span>
            <span>{money(subtotal, currency)}</span>
          </p>
          <p>
            <span>Delivery</span>
            <span>{deliveryFee === 0 ? "Free" : money(deliveryFee, currency)}</span>
          </p>
          <p className="sf-grand">
            <span>Total</span>
            <strong>{money(orderTotal, currency)}</strong>
          </p>
        </aside>
      </div>
    </main>
  );
}

// --- Icons ------------------------------------------------------------------

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="18" height="18">
      <path d="M7 18a2 2 0 100 4 2 2 0 000-4m10 0a2 2 0 100 4 2 2 0 000-4M7.2 14.6l.03-.13.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49-1.74-.96-3.59 6.48h-6.9L3.27 2H0v2h2l3.6 7.59-1.35 2.44A2 2 0 006 17h12v-2H6.42a.25.25 0 01-.22-.4" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15s-.77.96-.94 1.16c-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35M12.04 21.5h-.01a9.5 9.5 0 01-4.84-1.32l-.35-.21-3.6.94.96-3.5-.23-.36a9.42 9.42 0 01-1.45-5.05c0-5.22 4.27-9.47 9.53-9.47a9.47 9.47 0 019.51 9.48c0 5.22-4.27 9.47-9.52 9.47M20.52 3.5A11.44 11.44 0 0012.04 0C5.69 0 .52 5.15.52 11.47c0 2.02.53 3.99 1.54 5.73L.42 24l6.96-1.82a11.5 11.5 0 004.65 1.03h.01c6.35 0 11.52-5.15 11.52-11.47 0-3.06-1.2-5.94-3.37-8.11" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.24.2 2.45.57 3.57a1 1 0 01-.25 1.02l-2.2 2.2z" />
    </svg>
  );
}

// Written as one string rather than Tailwind classes: the storefront renders
// outside the app shell and is themed entirely from the owner's chosen palette.
const STOREFRONT_CSS = `
.mk-shop{background:var(--sf-bg);color:var(--sf-text);font-family:var(--sf-font);min-height:100vh}
.mk-shop *{box-sizing:border-box}
.mk-shop img{max-width:100%}
.mk-shop a{color:inherit}
.sf-header{position:sticky;top:0;z-index:40;background:var(--sf-header-bg);color:var(--sf-header-text);border-bottom:1px solid var(--sf-line)}
.sf-header-inner{max-width:1200px;margin:0 auto;padding:11px 20px;display:flex;align-items:center;gap:16px}
.sf-brand{display:flex;align-items:center;gap:11px;text-decoration:none;flex:0 0 auto}
.sf-logo{width:44px;height:44px;object-fit:cover;border-radius:calc(var(--sf-radius) * 0.6);flex:0 0 auto}
.sf-logo-text{display:flex;align-items:center;justify-content:center;background:var(--sf-accent);color:var(--sf-on-accent);font-size:20px;font-weight:800}
.sf-brand-text{display:flex;flex-direction:column;line-height:1.25}
.sf-brand-text strong{font-size:16px;font-weight:800;letter-spacing:.3px;font-family:var(--sf-heading)}
.sf-brand-text small{font-size:11.5px;color:var(--sf-muted)}
.sf-search{display:flex;gap:8px;flex:1;max-width:460px;margin:0 auto}
.sf-search input{flex:1;min-width:0;background:var(--sf-surface);border:1px solid var(--sf-line);border-radius:var(--sf-radius);padding:10px 14px;font-size:14px;color:var(--sf-text);font-family:inherit}
.sf-search input:focus{outline:none;border-color:var(--sf-accent)}
.sf-search button{background:transparent;border:1px solid var(--sf-line);border-radius:var(--sf-radius);padding:10px 16px;font-size:13.5px;font-weight:700;color:var(--sf-text);cursor:pointer}
.sf-search button:hover{border-color:var(--sf-accent);color:var(--sf-accent)}
.sf-cart-btn{position:relative;display:inline-flex;align-items:center;gap:8px;background:var(--sf-accent);color:var(--sf-on-accent);border:0;border-radius:999px;padding:11px 20px;font-size:14px;font-weight:700;cursor:pointer;flex:0 0 auto}
.sf-cart-btn:hover{background:var(--sf-accent-alt)}
.sf-badge{position:absolute;top:-6px;right:-6px;min-width:21px;height:21px;padding:0 5px;border-radius:999px;background:var(--sf-text);color:var(--sf-bg);font-size:11.5px;font-weight:800;font-style:normal;display:flex;align-items:center;justify-content:center}
.sf-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--sf-line)}
.sf-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.32}
.sf-hero-body{position:relative;max-width:1200px;margin:0 auto;padding:58px 20px}
.sf-hero h1{margin:0 0 10px;font-size:clamp(26px,4.4vw,46px);font-weight:800;letter-spacing:-.8px;line-height:1.1}
.sf-hero-sub{margin:0 0 16px;max-width:62ch;color:var(--sf-muted);font-size:15.5px;line-height:1.8}
.sf-hero-meta{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:20px}
.sf-pill{background:var(--sf-surface);border:1px solid var(--sf-line);border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:700}
.sf-hero-actions{display:flex;flex-wrap:wrap;gap:10px}
.sf-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:var(--sf-radius);padding:12px 22px;font-size:14px;font-weight:700;text-decoration:none;cursor:pointer;font-family:inherit;transition:background .16s,transform .16s}
.sf-btn-primary{background:var(--sf-accent);color:var(--sf-on-accent)}
.sf-btn-primary:hover{background:var(--sf-accent-alt)}
.sf-btn-ghost{background:transparent;color:var(--sf-text);border:1px solid var(--sf-line)}
.sf-btn-ghost:hover{border-color:var(--sf-accent);color:var(--sf-accent)}
.sf-btn-disabled{background:var(--sf-surface);color:var(--sf-muted);cursor:not-allowed}
.sf-btn:disabled{opacity:.6;cursor:not-allowed}
.sf-main{max-width:1200px;margin:0 auto;padding:44px 20px 70px}
.sf-main-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:22px}
.sf-main-head h2{margin:0;font-size:clamp(20px,2.6vw,28px);font-weight:800;letter-spacing:-.4px}
.sf-count{margin:0;color:var(--sf-muted);font-size:13.5px;display:flex;align-items:center;gap:12px}
.sf-link{background:none;border:0;padding:0;color:var(--sf-accent);font-size:13.5px;font-weight:700;cursor:pointer;text-decoration:none;font-family:inherit}
.sf-link:hover{text-decoration:underline}
.sf-back{margin-bottom:18px;display:inline-block}
.sf-loading{padding:50px 0;display:flex;justify-content:center}
.sf-empty{padding:44px 0;text-align:center;color:var(--sf-muted);font-size:15px}
.sf-error{background:rgba(220,38,38,.1);color:#dc2626;border-radius:var(--sf-radius);padding:11px 15px;font-size:14px;margin:0 0 16px}
.sf-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.sf-card{display:flex;flex-direction:column;background:var(--sf-surface);border:1px solid var(--sf-line);border-radius:var(--sf-radius);overflow:hidden;transition:transform .2s,box-shadow .2s}
.sf-card:hover{transform:translateY(-3px);box-shadow:0 10px 26px rgba(0,0,0,.12)}
.sf-card-img{position:relative;aspect-ratio:1/1;background:var(--sf-bg);overflow:hidden}
.sf-card-img img{width:100%;height:100%;object-fit:cover;display:block}
.sf-noimg{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:44px;font-weight:800;color:var(--sf-line)}
.sf-noimg-sm{width:56px;height:56px;font-size:22px;border-radius:var(--sf-radius);background:var(--sf-bg);flex:0 0 auto}
.sf-soldout,.sf-save{position:absolute;top:10px;left:10px;padding:5px 11px;border-radius:999px;font-size:11.5px;font-weight:800}
.sf-soldout{background:rgba(0,0,0,.72);color:#fff}
.sf-save{background:var(--sf-accent);color:var(--sf-on-accent)}
.sf-card-body{display:flex;flex-direction:column;gap:6px;padding:15px;flex:1}
.sf-card-body h3{margin:0;font-size:15.5px;font-weight:700;line-height:1.35}
.sf-desc{margin:0;color:var(--sf-muted);font-size:13px;line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sf-price{margin:2px 0 0;font-size:18px;font-weight:800;color:var(--sf-accent);display:flex;align-items:baseline;gap:8px}
.sf-price s{color:var(--sf-muted);font-size:13.5px;font-weight:500}
.sf-lowstock{margin:0;font-size:12px;font-weight:700;color:#d97706}
.sf-card-body .sf-btn,.sf-card-body .sf-stepper{margin-top:auto}
.sf-stepper{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--sf-line);border-radius:var(--sf-radius);padding:5px}
.sf-stepper button{width:34px;height:34px;border:0;border-radius:calc(var(--sf-radius) * 0.7);background:var(--sf-accent);color:var(--sf-on-accent);font-size:19px;font-weight:700;cursor:pointer;line-height:1}
.sf-stepper button:disabled{opacity:.4;cursor:not-allowed}
.sf-stepper span{font-size:15px;font-weight:800;min-width:24px;text-align:center}
.sf-stepper-sm{align-self:flex-start;width:104px;padding:3px;gap:6px}
.sf-stepper-sm button{width:26px;height:26px;font-size:16px}
.sf-more{margin-top:32px;text-align:center}
.sf-checkout{display:grid;grid-template-columns:1.4fr 1fr;gap:30px;align-items:start}
.sf-form,.sf-summary{background:var(--sf-surface);border:1px solid var(--sf-line);border-radius:var(--sf-radius);padding:26px}
.sf-form{display:flex;flex-direction:column;gap:14px}
.sf-form h2,.sf-summary h2{margin:0 0 4px;font-size:19px;font-weight:800;font-family:var(--sf-heading)}
.sf-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.sf-form label{display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:700;color:var(--sf-muted)}
.sf-form input,.sf-form textarea{background:var(--sf-bg);border:1px solid var(--sf-line);border-radius:calc(var(--sf-radius) * 0.7);padding:12px 14px;font-size:14.5px;color:var(--sf-text);font-family:inherit;font-weight:400}
.sf-form input:focus,.sf-form textarea:focus{outline:none;border-color:var(--sf-accent)}
.sf-form textarea{resize:vertical}
.sf-place{margin-top:6px;padding:15px}
.sf-cod{margin:0;text-align:center;font-size:12.5px;color:var(--sf-muted)}
.sf-summary ul{list-style:none;margin:0 0 14px;padding:0 0 14px;border-bottom:1px solid var(--sf-line);display:grid;gap:9px}
.sf-summary li,.sf-summary p{display:flex;justify-content:space-between;gap:14px;font-size:14px;margin:0 0 8px;color:var(--sf-muted)}
.sf-summary li{color:var(--sf-text)}
.sf-grand{padding-top:12px;border-top:1px solid var(--sf-line);font-size:16px!important;color:var(--sf-text)!important;font-weight:700}
.sf-grand strong{color:var(--sf-accent);font-size:19px}
.sf-done{max-width:620px}
.sf-done-card{background:var(--sf-surface);border:1px solid var(--sf-line);border-radius:var(--sf-radius);padding:38px;text-align:center}
.sf-tick{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:var(--sf-accent);color:var(--sf-on-accent);font-size:28px;font-weight:800;margin-bottom:16px}
.sf-done-card h2{margin:0 0 8px;font-size:24px;font-weight:800}
.sf-done-num{margin:0 0 20px;color:var(--sf-muted);font-size:15px}
.sf-done-num strong{color:var(--sf-accent);letter-spacing:.6px}
.sf-done-list{list-style:none;margin:0 0 14px;padding:14px 0;border-top:1px solid var(--sf-line);border-bottom:1px solid var(--sf-line);display:grid;gap:8px;text-align:left}
.sf-done-list li{display:flex;justify-content:space-between;gap:14px;font-size:14px}
.sf-done-total{display:flex;justify-content:space-between;gap:14px;font-size:15px;margin:0 0 18px}
.sf-done-total strong{color:var(--sf-accent);font-size:19px}
.sf-done-note{margin:0 0 22px;color:var(--sf-muted);font-size:13.5px;line-height:1.7}
.sf-footer{background:var(--sf-surface);border-top:1px solid var(--sf-line);padding:46px 20px 26px}
.sf-footer-inner{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(3,1fr);gap:34px}
.sf-footer h4{margin:0 0 10px;font-size:13px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--sf-accent)}
.sf-footer p{margin:0 0 6px;color:var(--sf-muted);font-size:14px;line-height:1.7}
.sf-footer a{color:var(--sf-muted);text-decoration:none}
.sf-footer a:hover{color:var(--sf-accent)}
.sf-hours{list-style:none;margin:0;padding:0;display:grid;gap:5px}
.sf-hours li{display:flex;justify-content:space-between;gap:14px;font-size:13.5px;color:var(--sf-muted)}
.sf-map{height:150px;border-radius:calc(var(--sf-radius) * 0.7);overflow:hidden;margin-bottom:9px;border:1px solid var(--sf-line)}
.sf-map iframe{width:100%;height:100%;border:0;display:block}
.sf-copy{max-width:1200px;margin:30px auto 0;padding-top:18px;border-top:1px solid var(--sf-line);text-align:center;color:var(--sf-muted);font-size:12.5px}
.sf-float{position:fixed;right:18px;bottom:20px;display:flex;flex-direction:column;gap:11px;z-index:45}
.sf-float-btn{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.26)}
.sf-float-btn svg{width:26px;height:26px}
.sf-float-btn:hover{transform:scale(1.07)}
.sf-float-wa{background:#25d366}
.sf-float-call{background:var(--sf-accent);color:var(--sf-on-accent)}
.sf-drawer-wrap{position:fixed;inset:0;z-index:60;display:flex;justify-content:flex-end}
.sf-scrim{position:absolute;inset:0;background:rgba(0,0,0,.5)}
.sf-drawer{position:relative;width:min(420px,100%);height:100%;background:var(--sf-bg);border-left:1px solid var(--sf-line);display:flex;flex-direction:column;overflow-y:auto}
.sf-drawer-head{position:sticky;top:0;background:var(--sf-bg);display:flex;align-items:center;justify-content:space-between;gap:14px;padding:18px 20px;border-bottom:1px solid var(--sf-line)}
.sf-drawer-head h3{margin:0;font-size:17px;font-weight:800}
.sf-drawer-head button{background:none;border:0;font-size:19px;color:var(--sf-muted);cursor:pointer;line-height:1}
.sf-drawer-list{list-style:none;margin:0;padding:16px 20px;display:grid;gap:16px}
.sf-drawer-list li{display:flex;gap:12px;align-items:flex-start}
.sf-drawer-list img{width:56px;height:56px;object-fit:cover;border-radius:calc(var(--sf-radius) * 0.6);flex:0 0 auto}
.sf-drawer-info{flex:1;display:flex;flex-direction:column;gap:5px;min-width:0}
.sf-drawer-info strong{font-size:14.5px;line-height:1.35}
.sf-drawer-info span{font-size:12.5px;color:var(--sf-muted)}
.sf-drawer-right{text-align:right;display:flex;flex-direction:column;gap:5px;align-items:flex-end}
.sf-drawer-right strong{font-size:14.5px}
.sf-totals{padding:16px 20px;border-top:1px solid var(--sf-line);display:grid;gap:8px}
.sf-totals p{display:flex;justify-content:space-between;gap:14px;margin:0;font-size:14px;color:var(--sf-muted)}
.sf-nudge{background:var(--sf-surface);border-radius:calc(var(--sf-radius) * 0.7);padding:9px 12px;font-size:12.5px!important;justify-content:center!important;color:var(--sf-accent)!important;font-weight:700}
.sf-checkout-btn{margin:0 20px 22px;padding:15px}
@media(max-width:1024px){.sf-grid{grid-template-columns:repeat(3,1fr)}.sf-checkout{grid-template-columns:1fr}.sf-footer-inner{grid-template-columns:1fr 1fr}}
@media(max-width:760px){.sf-grid{grid-template-columns:repeat(2,1fr);gap:14px}.sf-header-inner{flex-wrap:wrap}.sf-search{order:3;width:100%;max-width:none;flex-basis:100%}.sf-cart-btn{margin-left:auto}.sf-footer-inner{grid-template-columns:1fr}.sf-hero-body{padding:40px 20px}}
@media(max-width:520px){.sf-row{grid-template-columns:1fr}.sf-main{padding:30px 16px 60px}.sf-brand-text strong{font-size:14.5px}}
@media(prefers-reduced-motion:reduce){.sf-card,.sf-btn,.sf-float-btn{transition:none}}
`;
