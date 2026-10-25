import { api, errorMessage } from "../lib/api";
import { $, esc, pageData } from "../lib/ui";

// A working shop: catalogue, cart and checkout. The header, hero and footer
// are server-rendered; this draws the catalogue / checkout / confirmation
// view and the cart drawer, which all depend on the cart.

const shop = pageData("shop-data");
const view = $("[data-shop-view]");
const drawer = $("[data-cart-drawer]");
const drawerBody = $("[data-cart-body]");
const countBadge = $("[data-cart-count]");

const state = {
  products: shop.products,
  total: shop.total,
  page: 1,
  search: "",
  loading: false,
  loadingMore: false,
  error: "",
  view: "shop",
  placed: null,
  checkoutError: "",
  placing: false,
};

function money(cents, currency = "INR") {
  const symbol = currency === "INR" ? "₹" : "";
  return `${symbol}${(cents / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

// A shopper who half-filled a basket and reloaded should still have it.
// Scoped per shop so two storefronts in one browser never share a cart.
const cartKey = `mk-cart:${shop.slug}`;
function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(cartKey) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((l) => typeof l?.productId === "string" && Number.isInteger(l?.quantity) && l.quantity > 0);
  } catch {
    return [];
  }
}
let cart = readCart();
function saveCart() {
  try {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  } catch {
    // storage unavailable — the cart just won't survive a reload
  }
}

const inCart = (id) => cart.find((l) => l.productId === id)?.quantity ?? 0;
function setQuantity(id, quantity) {
  cart = cart.filter((l) => l.productId !== id);
  if (quantity > 0) cart.push({ productId: id, quantity });
  saveCart();
  render();
}

// Products the cart refers to. Anything the shop has since removed simply
// drops out rather than blocking checkout with a stale line.
function cartLines() {
  return cart.map((line) => ({ line, product: state.products.find((p) => p.id === line.productId) })).filter((e) => e.product);
}

function totals() {
  const lines = cartLines();
  const itemCount = lines.reduce((sum, { line }) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, { line, product }) => sum + product.priceCents * line.quantity, 0);
  const currency = state.products[0]?.currency ?? "INR";
  const freeAbove = shop.storefront?.freeDeliveryAboveCents ?? null;
  const baseFee = shop.storefront?.deliveryFeeCents ?? 0;
  const deliveryFee = freeAbove != null && subtotal >= freeAbove ? 0 : baseFee;
  return { lines, itemCount, subtotal, currency, freeAbove, deliveryFee, orderTotal: subtotal + deliveryFee };
}

async function loadProducts(page) {
  if (page === 1) state.loading = true;
  else state.loadingMore = true;
  render();
  try {
    const res = await api.get(`/sites/${shop.slug}/products`, { page, pageSize: shop.pageSize, search: state.search || undefined });
    state.products = page === 1 ? res.data : [...state.products, ...res.data];
    state.total = res.meta.total;
    state.page = page;
    state.error = "";
  } catch (err) {
    state.error = errorMessage(err);
  } finally {
    state.loading = false;
    state.loadingMore = false;
    render();
  }
}

function productCard(product) {
  const qty = inCart(product.id);
  const soldOut = product.trackStock && product.stock <= 0;
  const atLimit = product.trackStock && qty >= product.stock;
  const onSale = product.compareAtCents && product.compareAtCents > product.priceCents;
  let action;
  if (soldOut) action = '<button class="sf-btn sf-btn-disabled" disabled>Sold out</button>';
  else if (qty === 0) action = `<button class="sf-btn sf-btn-primary" data-add="${esc(product.id)}">Add to cart</button>`;
  else
    action = `<div class="sf-stepper">
      <button data-qty="${esc(product.id)}" data-to="${qty - 1}" aria-label="Remove one">−</button>
      <span>${qty}</span>
      <button data-qty="${esc(product.id)}" data-to="${qty + 1}" ${atLimit ? "disabled" : ""} aria-label="Add one">+</button>
    </div>`;

  return `<article class="sf-card">
    <div class="sf-card-img">
      ${product.imageUrl ? `<img src="${esc(product.imageUrl)}" alt="${esc(product.name)}" loading="lazy" />` : `<span class="sf-noimg">${esc(product.name.charAt(0).toUpperCase())}</span>`}
      ${soldOut ? '<span class="sf-soldout">Sold out</span>' : ""}
      ${!soldOut && onSale ? `<span class="sf-save">Save ${money(product.compareAtCents - product.priceCents, product.currency)}</span>` : ""}
    </div>
    <div class="sf-card-body">
      <h3>${esc(product.name)}</h3>
      ${product.description ? `<p class="sf-desc">${esc(product.description)}</p>` : ""}
      <p class="sf-price">${money(product.priceCents, product.currency)}${onSale ? `<s>${money(product.compareAtCents, product.currency)}</s>` : ""}</p>
      ${product.trackStock && !soldOut && product.stock <= 5 ? `<p class="sf-lowstock">Only ${product.stock} left</p>` : ""}
      ${action}
    </div>
  </article>`;
}

function shopView() {
  const heading = state.search ? `Results for “${esc(state.search)}”` : "Shop our products";
  let body;
  if (state.loading) body = '<div class="sf-loading"><p class="sf-empty">Loading products…</p></div>';
  else if (state.products.length === 0)
    body = `<p class="sf-empty">${state.search ? "No products matched your search. Try a different word." : "This shop has not listed any products yet."}</p>`;
  else
    body = `<div class="sf-grid">${state.products.map(productCard).join("")}</div>
      ${
        state.products.length < state.total
          ? `<div class="sf-more"><button class="sf-btn sf-btn-ghost" data-load-more ${state.loadingMore ? "disabled" : ""}>${
              state.loadingMore ? "Loading…" : `Load more (${state.total - state.products.length} left)`
            }</button></div>`
          : ""
      }`;

  return `<main class="sf-main">
    <div class="sf-main-head">
      <h2 style="font-family:${esc(shop.heading)}">${heading}</h2>
      <p class="sf-count">${state.total === 0 ? "Nothing here yet" : `Showing ${state.products.length} of ${state.total}`}
        ${state.search ? '<button class="sf-link" data-clear-search>Clear search</button>' : ""}</p>
    </div>
    ${state.error ? `<p class="sf-error">${esc(state.error)}</p>` : ""}
    ${body}
  </main>`;
}

function checkoutView() {
  const t = totals();
  if (t.lines.length === 0) {
    return `<main class="sf-main"><p class="sf-empty">Your cart is empty.</p>
      <div class="sf-more"><button class="sf-btn sf-btn-ghost" data-back>Back to the shop</button></div></main>`;
  }
  return `<main class="sf-main">
    <button class="sf-link sf-back" data-back>← Back to the shop</button>
    <div class="sf-checkout">
      <form class="sf-form" data-checkout>
        <h2>Delivery details</h2>
        <div class="sf-row">
          <label>Your name *<input required name="customerName" /></label>
          <label>Phone number *<input required type="tel" name="customerPhone" /></label>
        </div>
        <label>Email (for your receipt)<input type="email" name="customerEmail" /></label>
        <label>Address *<input required name="addressLine1" /></label>
        <label>Apartment, landmark (optional)<input name="addressLine2" /></label>
        <div class="sf-row">
          <label>City *<input required name="city" value="${esc(shop.city)}" /></label>
          <label>PIN code<input name="postalCode" /></label>
        </div>
        <label>Notes for the shop<textarea rows="3" name="notes"></textarea></label>
        <p class="sf-error" data-checkout-error hidden></p>
        <button class="sf-btn sf-btn-primary sf-place" data-place>Place order · ${money(t.orderTotal, t.currency)}</button>
        <p class="sf-cod">Pay cash on delivery. The shop will call to confirm.</p>
      </form>
      <aside class="sf-summary">
        <h2>Order summary</h2>
        <ul>${t.lines
          .map(({ line, product }) => `<li><span>${line.quantity} × ${esc(product.name)}</span><span>${money(product.priceCents * line.quantity, product.currency)}</span></li>`)
          .join("")}</ul>
        <p><span>Subtotal</span><span>${money(t.subtotal, t.currency)}</span></p>
        <p><span>Delivery</span><span>${t.deliveryFee === 0 ? "Free" : money(t.deliveryFee, t.currency)}</span></p>
        <p class="sf-grand"><span>Total</span><strong>${money(t.orderTotal, t.currency)}</strong></p>
      </aside>
    </div>
  </main>`;
}

function doneView() {
  const placed = state.placed;
  return `<main class="sf-main sf-done"><div class="sf-done-card">
    <span class="sf-tick">✓</span>
    <h2 style="font-family:${esc(shop.heading)}">Thank you, your order is in</h2>
    <p class="sf-done-num">Order <strong>${esc(placed.orderNumber)}</strong></p>
    <ul class="sf-done-list">${placed.items
      .map((item) => `<li><span>${item.quantity} × ${esc(item.name)}</span><span>${money(item.lineTotalCents, placed.currency)}</span></li>`)
      .join("")}</ul>
    <p class="sf-done-total"><span>Total to pay on delivery</span><strong>${money(placed.totalCents, placed.currency)}</strong></p>
    <p class="sf-done-note">${esc(shop.name)} will call you on the number you gave to confirm. Keep your order number handy.</p>
    <button class="sf-btn sf-btn-primary" data-continue>Continue shopping</button>
  </div></main>`;
}

function drawerView() {
  const t = totals();
  const head = `<div class="sf-drawer-head"><h3>Your cart (${t.itemCount})</h3><button data-close-cart aria-label="Close cart">✕</button></div>`;
  if (t.lines.length === 0) return `${head}<p class="sf-empty">Your cart is empty. Add something tasty.</p>`;
  return `${head}
    <ul class="sf-drawer-list">${t.lines
      .map(
        ({ line, product }) => `<li>
        ${product.imageUrl ? `<img src="${esc(product.imageUrl)}" alt="" />` : `<span class="sf-noimg sf-noimg-sm">${esc(product.name.charAt(0))}</span>`}
        <div class="sf-drawer-info">
          <strong>${esc(product.name)}</strong>
          <span>${money(product.priceCents, product.currency)} each</span>
          <div class="sf-stepper sf-stepper-sm">
            <button data-qty="${esc(product.id)}" data-to="${line.quantity - 1}">−</button>
            <span>${line.quantity}</span>
            <button data-qty="${esc(product.id)}" data-to="${line.quantity + 1}" ${product.trackStock && line.quantity >= product.stock ? "disabled" : ""}>+</button>
          </div>
        </div>
        <div class="sf-drawer-right">
          <strong>${money(product.priceCents * line.quantity, product.currency)}</strong>
          <button class="sf-link" data-qty="${esc(product.id)}" data-to="0">Remove</button>
        </div>
      </li>`,
      )
      .join("")}</ul>
    <div class="sf-totals">
      <p><span>Subtotal</span><span>${money(t.subtotal, t.currency)}</span></p>
      <p><span>Delivery</span><span>${t.deliveryFee === 0 ? "Free" : money(t.deliveryFee, t.currency)}</span></p>
      ${t.freeAbove != null && t.subtotal < t.freeAbove ? `<p class="sf-nudge">Add ${money(t.freeAbove - t.subtotal, t.currency)} more for free delivery</p>` : ""}
      <p class="sf-grand"><span>Total</span><strong>${money(t.orderTotal, t.currency)}</strong></p>
    </div>
    <button class="sf-btn sf-btn-primary sf-checkout-btn" data-go-checkout>Proceed to checkout</button>`;
}

function render() {
  // The checkout form holds what the shopper typed, so it is only drawn
  // when the view changes to it, never on a cart re-render.
  if (state.view !== "checkout" || !$("[data-checkout]", view)) {
    view.innerHTML = state.view === "shop" ? shopView() : state.view === "checkout" ? checkoutView() : doneView();
  }
  if (!drawer.hidden) drawerBody.innerHTML = drawerView();
  const { itemCount } = totals();
  countBadge.textContent = String(itemCount);
  countBadge.hidden = itemCount === 0;
}

// The cart changed during checkout: update the summary and the total on the
// button, keeping whatever the shopper has typed into the form.
function refreshCheckoutSummary() {
  const form = $("[data-checkout]", view);
  if (!form || totals().lines.length === 0) {
    view.innerHTML = checkoutView();
    return;
  }
  const fresh = document.createElement("div");
  fresh.innerHTML = checkoutView();
  $(".sf-summary", view).replaceWith($(".sf-summary", fresh));
  $("[data-place]", form).textContent = $("[data-place]", fresh).textContent;
}

function setView(next) {
  state.view = next;
  view.innerHTML = "";
  render();
  window.scrollTo({ top: 0 });
}

function openCart() {
  drawer.hidden = false;
  drawerBody.innerHTML = drawerView();
}
const closeCart = () => (drawer.hidden = true);

$("[data-open-cart]").addEventListener("click", openCart);

$("[data-shop-search]").addEventListener("submit", (e) => {
  e.preventDefault();
  state.search = e.currentTarget.search.value.trim();
  if (state.view !== "shop") state.view = "shop";
  loadProducts(1);
});

document.addEventListener("click", (e) => {
  const target = e.target.closest("button, [data-close-cart]");
  if (!target) return;
  if (target.matches("[data-close-cart]")) return closeCart();
  if (target.dataset.add) {
    const product = state.products.find((p) => p.id === target.dataset.add);
    const next = inCart(product.id) + 1;
    if (product.trackStock && next > product.stock) return;
    setQuantity(product.id, next);
    openCart();
    return;
  }
  if (target.dataset.qty) {
    setQuantity(target.dataset.qty, Number(target.dataset.to));
    if (state.view === "checkout") refreshCheckoutSummary();
    return;
  }
  if (target.matches("[data-load-more]")) return loadProducts(state.page + 1);
  if (target.matches("[data-clear-search]")) {
    state.search = "";
    $("[data-shop-search]").search.value = "";
    return loadProducts(1);
  }
  if (target.matches("[data-go-checkout]")) {
    closeCart();
    return setView("checkout");
  }
  if (target.matches("[data-back]")) return setView("shop");
  if (target.matches("[data-continue]")) {
    state.placed = null;
    state.search = "";
    setView("shop");
    return loadProducts(1);
  }
});

view.addEventListener("submit", async (e) => {
  if (!e.target.matches("[data-checkout]")) return;
  e.preventDefault();
  const form = e.target;
  const f = Object.fromEntries(new FormData(form));
  const place = $("[data-place]", form);
  const errorBox = $("[data-checkout-error]", form);
  const label = place.textContent;
  place.disabled = true;
  place.textContent = "Placing your order…";
  errorBox.hidden = true;
  try {
    const { data: order } = await api.post(`/sites/${shop.slug}/orders`, {
      items: cartLines().map(({ line }) => ({ productId: line.productId, quantity: line.quantity })),
      customerName: f.customerName.trim(),
      customerPhone: f.customerPhone.trim(),
      customerEmail: f.customerEmail.trim() || undefined,
      addressLine1: f.addressLine1.trim(),
      addressLine2: f.addressLine2.trim() || undefined,
      city: f.city.trim(),
      postalCode: f.postalCode.trim() || undefined,
      notes: f.notes.trim() || undefined,
    });
    state.placed = order;
    cart = [];
    saveCart();
    closeCart();
    setView("done");
  } catch (err) {
    errorBox.textContent = errorMessage(err);
    errorBox.hidden = false;
    place.disabled = false;
    place.textContent = label;
  }
});

render();
