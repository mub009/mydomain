import{a as $,e as f,b as C}from"./api-B_riRJ0q.js";import{a as L,r as T,d as N,b as S}from"./channels-CvUWVcU_.js";import{$ as r,a as y,o as v,e as d,i as l,b as D,c as P}from"./ui-DIxCFilW.js";function B(){y("[data-live-search]").forEach(e=>{let t,a=e.value.trim();e.addEventListener("input",()=>{clearTimeout(t),t=setTimeout(()=>{e.value.trim()!==a&&(a=e.value.trim(),e.form.submit())},400)}),e.value&&document.activeElement===document.body&&new URL(window.location.href).searchParams.has("search")&&(e.focus(),e.setSelectionRange(e.value.length,e.value.length))})}const w="mk-flash";function M(e,t){try{sessionStorage.setItem(w,e)}catch{}t?window.location.href=t:window.location.reload()}function H(e=r("[data-flash]")){let t=null;try{t=sessionStorage.getItem(w),sessionStorage.removeItem(w)}catch{}t&&e&&(e.textContent=t,e.hidden=!1,setTimeout(()=>e.hidden=!0,4e3))}function m(e,t){e&&(e.textContent=t,e.hidden=!t)}function q(e=document){y("[data-upload-field]",e).forEach(t=>{if(t.dataset.wired)return;t.dataset.wired="1";const a=r("[data-upload-url]",t),s=r("[data-upload-button]",t),n=r("[data-upload-file]",t),i=r("[data-upload-error]",t);s.addEventListener("click",()=>n.click());const o=r("[data-upload-clear]",t);if(o){const c=()=>o.hidden=!a.value.trim();a.addEventListener("input",c),o.addEventListener("click",()=>{a.value="",i.hidden=!0,a.dispatchEvent(new Event("input",{bubbles:!0})),t.dispatchEvent(new CustomEvent("upload:cleared"))})}n.addEventListener("change",async()=>{var p,b;const c=(p=n.files)==null?void 0:p[0];if(c){i.hidden=!0,s.disabled=!0,r("span",s).textContent=(b=r("[data-upload-remove-bg]",t))!=null&&b.checked?"Enhancing with AI…":"Uploading…";try{const u=r("[data-upload-remove-bg]",t),g=await C(c,t.dataset.uploadField,u?{removeBackground:u.checked}:{});if(a.value=g.url,a.dispatchEvent(new Event("input",{bubbles:!0})),u!=null&&u.checked){const k=r("[data-upload-saved]",t);k.textContent=g.method==="ai"?"Background removed and redrawn in high quality by AI. Check it matches your logo.":g.backgroundRemoved?"Background removed and quality enhanced (AI wasn't available).":"Quality enhanced. The background couldn't be removed.",k.hidden=!1}t.dispatchEvent(new CustomEvent("upload:done",{detail:{url:a.value}}))}catch(u){i.textContent=f(u),i.hidden=!1}finally{s.disabled=!1,r("span",s).textContent="Upload",n.value=""}}})})}function h(){const e="ABCDEFGHJKLMNPQRSTUVWXYZ",t="abcdefghijkmnpqrstuvwxyz",a="23456789",s=e+t+a,n=o=>o[Math.floor(Math.random()*o.length)];let i=n(e)+n(t)+n(a);for(let o=0;o<7;o++)i+=n(s);return i.split("").sort(()=>Math.random()-.5).join("")}function x(e,t){return`<div>
    <label class="block text-[11px] font-medium text-emerald-700/80 mb-1">${d(e)}</label>
    <div class="flex items-center gap-2">
      <code class="flex-1 min-w-0 truncate rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-mono text-ink-900">${d(t)}</code>
      <button type="button" class="btn-secondary px-3 py-2 text-sm whitespace-nowrap" data-copy="${d(t)}">${l("copy",{size:14})} <span>Copy</span></button>
    </div>
  </div>`}document.addEventListener("click",e=>{var a;const t=e.target.closest("[data-copy]");t&&((a=navigator.clipboard)==null||a.writeText(t.dataset.copy).then(()=>{const s=r("span",t);if(!s)return;const n=s.textContent;s.textContent="Copied",setTimeout(()=>s.textContent=n,1500)},()=>{}))});function O(e){const t=v(`Reset password — ${e.firstName} ${e.lastName}`,`<form class="space-y-3">
      <div data-error></div>
      <p class="text-sm text-ink-600">Set a new login password for <span class="font-semibold text-ink-900">${d(e.email??e.phone)}</span>. Their current password stops working immediately.</p>
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">New password (min 8 chars)</label>
        <div class="flex gap-2">
          <input required minlength="8" type="text" name="password" class="input font-mono" value="${d(h())}" />
          <button type="button" data-generate class="btn-secondary px-3 py-2 text-sm whitespace-nowrap">${l("refresh-cw",{size:14})} Generate</button>
        </div>
      </div>
      <button class="btn-primary w-full py-2.5" data-submit>Reset password</button>
    </form>`),a=r("form",t.body);r("[data-generate]",a).addEventListener("click",()=>a.password.value=h()),a.addEventListener("submit",async s=>{s.preventDefault();const n=a.password.value,i=r("[data-submit]",a);i.disabled=!0,i.textContent="Resetting…";try{await $.patch(`/users/${e.id}/password`,{password:n}),t.body.innerHTML=`<div class="space-y-3">
        <p class="text-sm text-emerald-800 bg-emerald-50 rounded-md px-3 py-2">Password reset. Their old sessions are signed out — share the new login below. The password won't be shown again.</p>
        ${x("Username",e.email??e.phone)}
        ${x("New password",n)}
        ${E({businessName:[e.firstName,e.lastName].filter(Boolean).join(" "),username:e.email??e.phone,password:n,phone:e.phone,reset:!0})}
        <button type="button" class="btn-secondary w-full py-2.5" data-close>Done</button>
      </div>`}catch(o){r("[data-error]",a).innerHTML=D(f(o)),i.disabled=!1,i.textContent="Reset password"}})}function j(e,t,a){const s=S(e),n=v(`QR board ${e}`,`<div id="qr-board" class="rounded-xl border-2 border-dashed border-gray-200 bg-white p-6 text-center">
      <p class="text-xs font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
      <h4 class="mt-1 text-xl font-extrabold text-ink-900">${d(t)}</h4>
      <p class="mt-0.5 text-sm text-ink-500">${d(L(a))}</p>
      <div class="mx-auto mt-3 flex h-52 w-52 items-center justify-center" data-qr>${P("")}</div>
      <p class="mt-2 font-mono text-sm font-bold text-ink-900">${d(e)}</p>
      <p class="mt-0.5 text-xs text-ink-400">Point your camera at the code</p>
      <p class="mt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Powered by Markkito</p>
    </div>
    <p class="mt-2 break-all text-[11px] text-ink-400">${d(s)}</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled data-download class="btn-primary flex-1 py-2.5 disabled:opacity-50">${l("download",{size:15})} Download PNG</button>
      <button type="button" data-print class="btn-secondary flex-1 py-2.5">${l("printer",{size:15})} Print</button>
      <button type="button" data-copy="${d(s)}" class="btn-secondary flex-1 py-2.5">${l("copy",{size:15})} <span>Copy link</span></button>
    </div>`);let i="";T(s).then(o=>{i=o,r("[data-qr]",n.body).outerHTML=`<img src="${o}" alt="QR code ${d(e)}" class="mx-auto mt-3 h-52 w-52" />`,r("[data-download]",n.body).disabled=!1}).catch(()=>{}),r("[data-download]",n.body).addEventListener("click",()=>i&&N(i,`${e}-qr.png`)),r("[data-print]",n.body).addEventListener("click",()=>window.print())}const U={PUBLISHED:"bg-emerald-50 text-emerald-700",CONFIRMED:"bg-emerald-50 text-emerald-700",CONVERTED:"bg-emerald-50 text-emerald-700",COMPLETED:"bg-emerald-50 text-emerald-700",PENDING_APPROVAL:"bg-amber-50 text-amber-700",PENDING:"bg-amber-50 text-amber-700",NEW:"bg-brand-50 text-brand-700",CONTACTED:"bg-sky-50 text-sky-700",QUALIFIED:"bg-violet-50 text-violet-700",DRAFT:"bg-gray-100 text-gray-600",SUSPENDED:"bg-red-50 text-red-700",CANCELLED:"bg-red-50 text-red-700",LOST:"bg-red-50 text-red-700",NO_SHOW:"bg-red-50 text-red-700"};function G(e){return U[e]??"bg-gray-100 text-gray-600"}function Q(){y("[data-clone-business]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.cloneBusiness);let a=null;const s=v("Clone business",`<form class="space-y-3" data-clone-form>
          <div>
            <p class="text-sm text-ink-700">Make a copy of <strong>${d(t.name)}</strong>.</p>
            <p class="mt-1 text-xs text-ink-500">The copy gets its details, hours, services, photos, slider, gallery, products and website, starts as a draft under the name you give it and uses 1 point. Reviews, leads, bookings, orders and QR boards stay with the original.</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-ink-700 mb-1">Business name</label>
            <input class="input" name="businessName" minlength="2" maxlength="150" placeholder="Name of the new business" autocomplete="off" required />
          </div>
          <div class="rounded-lg border border-gray-200 p-3 space-y-2">
            <p class="text-sm font-semibold text-ink-900 flex items-center gap-1.5">${l("key-round",{size:14})} Login for the copy</p>
            <p class="text-[11px] text-ink-500">The copy is assigned to this account so its business team can sign in. If the username already has an account, the copy is linked to it and the password is ignored.</p>
            <div>
              <label class="block text-[11px] font-medium text-ink-600 mb-1">Username (email or mobile number)</label>
              <input class="input" name="username" placeholder="owner@business.com or 9876543210" autocomplete="off" required />
            </div>
            <div>
              <label class="block text-[11px] font-medium text-ink-600 mb-1">Password (min 8 characters)</label>
              <div class="flex gap-2">
                <input class="input font-mono" name="password" minlength="8" maxlength="72" autocomplete="off" required />
                <button type="button" class="btn-secondary px-3 py-2 text-sm whitespace-nowrap" data-clone-generate>${l("refresh-cw",{size:14})} Generate</button>
              </div>
            </div>
            <input class="input" name="phone" minlength="7" maxlength="20" placeholder="Contact phone (optional)" />
          </div>
          <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-clone-error hidden></p>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn-secondary px-4 py-2 text-sm" data-close>Cancel</button>
            <button class="btn-primary px-4 py-2 text-sm" data-clone-confirm>${l("copy",{size:14})} Clone</button>
          </div>
        </form>`,{onClose:()=>a&&M(`This is the copy, “${a.name}” — change what you need, then publish it.`,`/dashboard/businesses/${a.id}`)}),n=r("[data-clone-form]",s.body);n.password.value=h(),n.businessName.focus(),r("[data-clone-generate]",n).addEventListener("click",()=>n.password.value=h()),n.addEventListener("submit",async i=>{i.preventDefault();const o=r("[data-clone-confirm]",n);o.disabled=!0,o.textContent="Cloning…";const c={username:n.username.value.trim(),password:n.password.value,phone:n.phone.value.trim()||void 0};try{({data:a}=await $.post(`/businesses/${t.id}/clone`,{name:n.businessName.value.trim(),owner:c}))}catch(b){m(r("[data-clone-error]",n),f(b)),o.disabled=!1,o.innerHTML=`${l("copy",{size:14})} Clone`;return}const p=a.ownerAccount;s.body.innerHTML=`<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p class="font-bold text-emerald-800 flex items-center gap-1.5">${l("check-circle-2",{size:16})} Cloned “${d(a.name)}”</p>
            <p class="text-xs text-emerald-700/90 mt-1 mb-3">${p.created?"Share this login with the business team. The password won't be shown again.":"The copy was linked to an existing account — its team signs in with this username and their existing password."}</p>
            <div class="space-y-2.5">
              ${x("Username",p.username)}
              ${p.created?x("Password",c.password):""}
              ${E({businessName:a.name.replace(/ \(Copy\)$/,""),username:p.username,password:p.created?c.password:"",phone:c.phone})}
            </div>
          </div>
          <div class="mt-4 flex justify-end">
            <button type="button" class="btn-primary px-4 py-2 text-sm" data-close>${l("arrow-right",{size:14})} Open the copy</button>
          </div>`})}))}function _(e){const t=e&&r("[data-detect-location]",e);if(!t||t.dataset.wired)return;t.dataset.wired="1";const a=r("[data-location-error]",e),s=r("span",t),n=s.textContent,i=(o=n)=>{t.disabled=!1,s.textContent=o};t.addEventListener("click",()=>{if(m(a,""),!navigator.geolocation)return m(a,"Location isn't supported by this browser.");if(!window.isSecureContext)return m(a,"Location only works on an https:// address.");t.disabled=!0,s.textContent="Fetching location…",navigator.geolocation.getCurrentPosition(o=>{e.latitude.value=o.coords.latitude.toFixed(6),e.longitude.value=o.coords.longitude.toFixed(6),e.latitude.dispatchEvent(new Event("input",{bubbles:!0})),i("Location updated ✓"),setTimeout(()=>s.textContent=n,2500)},o=>{i(),m(a,o.code===o.PERMISSION_DENIED?"Location access is blocked. Allow location for this site in the browser, then try again.":"Couldn't fetch your location. Turn on GPS / location and try again.")},{enableHighAccuracy:!0,timeout:15e3,maximumAge:0})})}function A(...e){for(const t of e){const a=String(t??"").replace(/\D/g,"");if(/^[6-9]\d{9}$/.test(a))return`91${a}`;if(/^91[6-9]\d{9}$/.test(a))return a}return""}function I({businessName:e,username:t,password:a,phone:s,reset:n=!1}){const i=[n?`Hello! The Markkito login password${e?` for *${e}*`:""} has been reset.`:`Hello! Your business${e?` *${e}*`:""} is now listed on Markkito.`,"",`Login: ${window.location.origin}/login`,`Username: ${t}`,a?`Password: ${a}`:"Password: your existing Markkito password","",n?"Please sign in with the new password.":"Sign in to update your phone, address, photos, opening hours and more."];return`https://wa.me/${A(t,s)}?text=${encodeURIComponent(i.join(`
`))}`}function E(e){return`<a href="${d(I(e))}" target="_blank" rel="noopener" class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1ebe5b]">
    ${l("message-square",{size:16})} Share login on WhatsApp
  </a>`}export{M as a,m as b,_ as c,q as d,Q as e,x as f,h as g,G as h,B as i,j,O as r,H as s,E as w};
