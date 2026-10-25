import{a as A,e as N}from"./api-3HrlSN3j.js";import{p as H,$ as c,e as r}from"./ui-D0zQHRcp.js";const l=H("shop-data"),u=c("[data-shop-view]"),w=c("[data-cart-drawer]"),I=c("[data-cart-body]"),S=c("[data-cart-count]"),a={products:l.products,total:l.total,page:1,search:"",loading:!1,loadingMore:!1,error:"",view:"shop",placed:null,checkoutError:"",placing:!1};function o(t,e="INR"){return`${e==="INR"?"₹":""}${(t/100).toLocaleString("en-IN",{maximumFractionDigits:2})}`}const x=`mk-cart:${l.slug}`;function R(){try{const t=JSON.parse(localStorage.getItem(x)||"[]");return Array.isArray(t)?t.filter(e=>typeof(e==null?void 0:e.productId)=="string"&&Number.isInteger(e==null?void 0:e.quantity)&&e.quantity>0):[]}catch{return[]}}let p=R();function M(){try{localStorage.setItem(x,JSON.stringify(p))}catch{}}const E=t=>{var e;return((e=p.find(s=>s.productId===t))==null?void 0:e.quantity)??0};function T(t,e){p=p.filter(s=>s.productId!==t),e>0&&p.push({productId:t,quantity:e}),M(),h()}function F(){return p.map(t=>({line:t,product:a.products.find(e=>e.id===t.productId)})).filter(t=>t.product)}function g(){var m,q,L;const t=F(),e=t.reduce(($,{line:v})=>$+v.quantity,0),s=t.reduce(($,{line:v,product:O})=>$+O.priceCents*v.quantity,0),n=((m=a.products[0])==null?void 0:m.currency)??"INR",i=((q=l.storefront)==null?void 0:q.freeDeliveryAboveCents)??null,d=((L=l.storefront)==null?void 0:L.deliveryFeeCents)??0,f=i!=null&&s>=i?0:d;return{lines:t,itemCount:e,subtotal:s,currency:n,freeAbove:i,deliveryFee:f,orderTotal:s+f}}async function y(t){t===1?a.loading=!0:a.loadingMore=!0,h();try{const e=await A.get(`/sites/${l.slug}/products`,{page:t,pageSize:l.pageSize,search:a.search||void 0});a.products=t===1?e.data:[...a.products,...e.data],a.total=e.meta.total,a.page=t,a.error=""}catch(e){a.error=N(e)}finally{a.loading=!1,a.loadingMore=!1,h()}}function j(t){const e=E(t.id),s=t.trackStock&&t.stock<=0,n=t.trackStock&&e>=t.stock,i=t.compareAtCents&&t.compareAtCents>t.priceCents;let d;return s?d='<button class="sf-btn sf-btn-disabled" disabled>Sold out</button>':e===0?d=`<button class="sf-btn sf-btn-primary" data-add="${r(t.id)}">Add to cart</button>`:d=`<div class="sf-stepper">
      <button data-qty="${r(t.id)}" data-to="${e-1}" aria-label="Remove one">−</button>
      <span>${e}</span>
      <button data-qty="${r(t.id)}" data-to="${e+1}" ${n?"disabled":""} aria-label="Add one">+</button>
    </div>`,`<article class="sf-card">
    <div class="sf-card-img">
      ${t.imageUrl?`<img src="${r(t.imageUrl)}" alt="${r(t.name)}" loading="lazy" />`:`<span class="sf-noimg">${r(t.name.charAt(0).toUpperCase())}</span>`}
      ${s?'<span class="sf-soldout">Sold out</span>':""}
      ${!s&&i?`<span class="sf-save">Save ${o(t.compareAtCents-t.priceCents,t.currency)}</span>`:""}
    </div>
    <div class="sf-card-body">
      <h3>${r(t.name)}</h3>
      ${t.description?`<p class="sf-desc">${r(t.description)}</p>`:""}
      <p class="sf-price">${o(t.priceCents,t.currency)}${i?`<s>${o(t.compareAtCents,t.currency)}</s>`:""}</p>
      ${t.trackStock&&!s&&t.stock<=5?`<p class="sf-lowstock">Only ${t.stock} left</p>`:""}
      ${d}
    </div>
  </article>`}function B(){const t=a.search?`Results for “${r(a.search)}”`:"Shop our products";let e;return a.loading?e='<div class="sf-loading"><p class="sf-empty">Loading products…</p></div>':a.products.length===0?e=`<p class="sf-empty">${a.search?"No products matched your search. Try a different word.":"This shop has not listed any products yet."}</p>`:e=`<div class="sf-grid">${a.products.map(j).join("")}</div>
      ${a.products.length<a.total?`<div class="sf-more"><button class="sf-btn sf-btn-ghost" data-load-more ${a.loadingMore?"disabled":""}>${a.loadingMore?"Loading…":`Load more (${a.total-a.products.length} left)`}</button></div>`:""}`,`<main class="sf-main">
    <div class="sf-main-head">
      <h2 style="font-family:${r(l.heading)}">${t}</h2>
      <p class="sf-count">${a.total===0?"Nothing here yet":`Showing ${a.products.length} of ${a.total}`}
        ${a.search?'<button class="sf-link" data-clear-search>Clear search</button>':""}</p>
    </div>
    ${a.error?`<p class="sf-error">${r(a.error)}</p>`:""}
    ${e}
  </main>`}function k(){const t=g();return t.lines.length===0?`<main class="sf-main"><p class="sf-empty">Your cart is empty.</p>
      <div class="sf-more"><button class="sf-btn sf-btn-ghost" data-back>Back to the shop</button></div></main>`:`<main class="sf-main">
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
          <label>City *<input required name="city" value="${r(l.city)}" /></label>
          <label>PIN code<input name="postalCode" /></label>
        </div>
        <label>Notes for the shop<textarea rows="3" name="notes"></textarea></label>
        <p class="sf-error" data-checkout-error hidden></p>
        <button class="sf-btn sf-btn-primary sf-place" data-place>Place order · ${o(t.orderTotal,t.currency)}</button>
        <p class="sf-cod">Pay cash on delivery. The shop will call to confirm.</p>
      </form>
      <aside class="sf-summary">
        <h2>Order summary</h2>
        <ul>${t.lines.map(({line:e,product:s})=>`<li><span>${e.quantity} × ${r(s.name)}</span><span>${o(s.priceCents*e.quantity,s.currency)}</span></li>`).join("")}</ul>
        <p><span>Subtotal</span><span>${o(t.subtotal,t.currency)}</span></p>
        <p><span>Delivery</span><span>${t.deliveryFee===0?"Free":o(t.deliveryFee,t.currency)}</span></p>
        <p class="sf-grand"><span>Total</span><strong>${o(t.orderTotal,t.currency)}</strong></p>
      </aside>
    </div>
  </main>`}function U(){const t=a.placed;return`<main class="sf-main sf-done"><div class="sf-done-card">
    <span class="sf-tick">✓</span>
    <h2 style="font-family:${r(l.heading)}">Thank you, your order is in</h2>
    <p class="sf-done-num">Order <strong>${r(t.orderNumber)}</strong></p>
    <ul class="sf-done-list">${t.items.map(e=>`<li><span>${e.quantity} × ${r(e.name)}</span><span>${o(e.lineTotalCents,t.currency)}</span></li>`).join("")}</ul>
    <p class="sf-done-total"><span>Total to pay on delivery</span><strong>${o(t.totalCents,t.currency)}</strong></p>
    <p class="sf-done-note">${r(l.name)} will call you on the number you gave to confirm. Keep your order number handy.</p>
    <button class="sf-btn sf-btn-primary" data-continue>Continue shopping</button>
  </div></main>`}function P(){const t=g(),e=`<div class="sf-drawer-head"><h3>Your cart (${t.itemCount})</h3><button data-close-cart aria-label="Close cart">✕</button></div>`;return t.lines.length===0?`${e}<p class="sf-empty">Your cart is empty. Add something tasty.</p>`:`${e}
    <ul class="sf-drawer-list">${t.lines.map(({line:s,product:n})=>`<li>
        ${n.imageUrl?`<img src="${r(n.imageUrl)}" alt="" />`:`<span class="sf-noimg sf-noimg-sm">${r(n.name.charAt(0))}</span>`}
        <div class="sf-drawer-info">
          <strong>${r(n.name)}</strong>
          <span>${o(n.priceCents,n.currency)} each</span>
          <div class="sf-stepper sf-stepper-sm">
            <button data-qty="${r(n.id)}" data-to="${s.quantity-1}">−</button>
            <span>${s.quantity}</span>
            <button data-qty="${r(n.id)}" data-to="${s.quantity+1}" ${n.trackStock&&s.quantity>=n.stock?"disabled":""}>+</button>
          </div>
        </div>
        <div class="sf-drawer-right">
          <strong>${o(n.priceCents*s.quantity,n.currency)}</strong>
          <button class="sf-link" data-qty="${r(n.id)}" data-to="0">Remove</button>
        </div>
      </li>`).join("")}</ul>
    <div class="sf-totals">
      <p><span>Subtotal</span><span>${o(t.subtotal,t.currency)}</span></p>
      <p><span>Delivery</span><span>${t.deliveryFee===0?"Free":o(t.deliveryFee,t.currency)}</span></p>
      ${t.freeAbove!=null&&t.subtotal<t.freeAbove?`<p class="sf-nudge">Add ${o(t.freeAbove-t.subtotal,t.currency)} more for free delivery</p>`:""}
      <p class="sf-grand"><span>Total</span><strong>${o(t.orderTotal,t.currency)}</strong></p>
    </div>
    <button class="sf-btn sf-btn-primary sf-checkout-btn" data-go-checkout>Proceed to checkout</button>`}function h(){(a.view!=="checkout"||!c("[data-checkout]",u))&&(u.innerHTML=a.view==="shop"?B():a.view==="checkout"?k():U()),w.hidden||(I.innerHTML=P());const{itemCount:t}=g();S.textContent=String(t),S.hidden=t===0}function V(){const t=c("[data-checkout]",u);if(!t||g().lines.length===0){u.innerHTML=k();return}const e=document.createElement("div");e.innerHTML=k(),c(".sf-summary",u).replaceWith(c(".sf-summary",e)),c("[data-place]",t).textContent=c("[data-place]",e).textContent}function b(t){a.view=t,u.innerHTML="",h(),window.scrollTo({top:0})}function D(){w.hidden=!1,I.innerHTML=P()}const C=()=>w.hidden=!0;c("[data-open-cart]").addEventListener("click",D);c("[data-shop-search]").addEventListener("submit",t=>{t.preventDefault(),a.search=t.currentTarget.search.value.trim(),a.view!=="shop"&&(a.view="shop"),y(1)});document.addEventListener("click",t=>{const e=t.target.closest("button, [data-close-cart]");if(e){if(e.matches("[data-close-cart]"))return C();if(e.dataset.add){const s=a.products.find(i=>i.id===e.dataset.add),n=E(s.id)+1;if(s.trackStock&&n>s.stock)return;T(s.id,n),D();return}if(e.dataset.qty){T(e.dataset.qty,Number(e.dataset.to)),a.view==="checkout"&&V();return}if(e.matches("[data-load-more]"))return y(a.page+1);if(e.matches("[data-clear-search]"))return a.search="",c("[data-shop-search]").search.value="",y(1);if(e.matches("[data-go-checkout]"))return C(),b("checkout");if(e.matches("[data-back]"))return b("shop");if(e.matches("[data-continue]"))return a.placed=null,a.search="",b("shop"),y(1)}});u.addEventListener("submit",async t=>{if(!t.target.matches("[data-checkout]"))return;t.preventDefault();const e=t.target,s=Object.fromEntries(new FormData(e)),n=c("[data-place]",e),i=c("[data-checkout-error]",e),d=n.textContent;n.disabled=!0,n.textContent="Placing your order…",i.hidden=!0;try{const{data:f}=await A.post(`/sites/${l.slug}/orders`,{items:F().map(({line:m})=>({productId:m.productId,quantity:m.quantity})),customerName:s.customerName.trim(),customerPhone:s.customerPhone.trim(),customerEmail:s.customerEmail.trim()||void 0,addressLine1:s.addressLine1.trim(),addressLine2:s.addressLine2.trim()||void 0,city:s.city.trim(),postalCode:s.postalCode.trim()||void 0,notes:s.notes.trim()||void 0});a.placed=f,p=[],M(),C(),b("done")}catch(f){i.textContent=N(f),i.hidden=!1,n.disabled=!1,n.textContent=d}});h();
