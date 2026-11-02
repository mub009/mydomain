import{a as y,e as w,u as $}from"./api-3HrlSN3j.js";import{a as k,r as E,d as C,b as L}from"./channels-CvUWVcU_.js";import{$ as r,a as f,o as g,e as d,i as l,b as T,d as S}from"./ui-ZjACusSH.js";function I(){f("[data-live-search]").forEach(e=>{let t,a=e.value.trim();e.addEventListener("input",()=>{clearTimeout(t),t=setTimeout(()=>{e.value.trim()!==a&&(a=e.value.trim(),e.form.submit())},400)}),e.value&&document.activeElement===document.body&&new URL(window.location.href).searchParams.has("search")&&(e.focus(),e.setSelectionRange(e.value.length,e.value.length))})}const x="mk-flash";function D(e,t){try{sessionStorage.setItem(x,e)}catch{}t?window.location.href=t:window.location.reload()}function z(e=r("[data-flash]")){let t=null;try{t=sessionStorage.getItem(x),sessionStorage.removeItem(x)}catch{}t&&e&&(e.textContent=t,e.hidden=!1,setTimeout(()=>e.hidden=!0,4e3))}function u(e,t){e&&(e.textContent=t,e.hidden=!t)}function F(e=document){f("[data-upload-field]",e).forEach(t=>{if(t.dataset.wired)return;t.dataset.wired="1";const a=r("[data-upload-url]",t),s=r("[data-upload-button]",t),n=r("[data-upload-file]",t),i=r("[data-upload-error]",t);s.addEventListener("click",()=>n.click());const o=r("[data-upload-clear]",t);if(o){const c=()=>o.hidden=!a.value.trim();a.addEventListener("input",c),o.addEventListener("click",()=>{a.value="",i.hidden=!0,a.dispatchEvent(new Event("input",{bubbles:!0})),t.dispatchEvent(new CustomEvent("upload:cleared"))})}n.addEventListener("change",async()=>{var p;const c=(p=n.files)==null?void 0:p[0];if(c){i.hidden=!0,s.disabled=!0,r("span",s).textContent="Uploading…";try{a.value=await $(c,t.dataset.uploadField),a.dispatchEvent(new Event("input",{bubbles:!0})),t.dispatchEvent(new CustomEvent("upload:done",{detail:{url:a.value}}))}catch(h){i.textContent=w(h),i.hidden=!1}finally{s.disabled=!1,r("span",s).textContent="Upload",n.value=""}}})})}function m(){const e="ABCDEFGHJKLMNPQRSTUVWXYZ",t="abcdefghijkmnpqrstuvwxyz",a="23456789",s=e+t+a,n=o=>o[Math.floor(Math.random()*o.length)];let i=n(e)+n(t)+n(a);for(let o=0;o<7;o++)i+=n(s);return i.split("").sort(()=>Math.random()-.5).join("")}function b(e,t){return`<div>
    <label class="block text-[11px] font-medium text-emerald-700/80 mb-1">${d(e)}</label>
    <div class="flex items-center gap-2">
      <code class="flex-1 min-w-0 truncate rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-mono text-ink-900">${d(t)}</code>
      <button type="button" class="btn-secondary px-3 py-2 text-sm whitespace-nowrap" data-copy="${d(t)}">${l("copy",{size:14})} <span>Copy</span></button>
    </div>
  </div>`}document.addEventListener("click",e=>{var a;const t=e.target.closest("[data-copy]");t&&((a=navigator.clipboard)==null||a.writeText(t.dataset.copy).then(()=>{const s=r("span",t);if(!s)return;const n=s.textContent;s.textContent="Copied",setTimeout(()=>s.textContent=n,1500)},()=>{}))});function H(e){const t=g(`Reset password — ${e.firstName} ${e.lastName}`,`<form class="space-y-3">
      <div data-error></div>
      <p class="text-sm text-ink-600">Set a new login password for <span class="font-semibold text-ink-900">${d(e.email??e.phone)}</span>. Their current password stops working immediately.</p>
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">New password (min 8 chars)</label>
        <div class="flex gap-2">
          <input required minlength="8" type="text" name="password" class="input font-mono" value="${d(m())}" />
          <button type="button" data-generate class="btn-secondary px-3 py-2 text-sm whitespace-nowrap">${l("refresh-cw",{size:14})} Generate</button>
        </div>
      </div>
      <button class="btn-primary w-full py-2.5" data-submit>Reset password</button>
    </form>`),a=r("form",t.body);r("[data-generate]",a).addEventListener("click",()=>a.password.value=m()),a.addEventListener("submit",async s=>{s.preventDefault();const n=a.password.value,i=r("[data-submit]",a);i.disabled=!0,i.textContent="Resetting…";try{await y.patch(`/users/${e.id}/password`,{password:n}),t.body.innerHTML=`<div class="space-y-3">
        <p class="text-sm text-emerald-800 bg-emerald-50 rounded-md px-3 py-2">Password reset. Their old sessions are signed out — share the new login below. The password won't be shown again.</p>
        ${b("Username",e.email??e.phone)}
        ${b("New password",n)}
        ${v({businessName:[e.firstName,e.lastName].filter(Boolean).join(" "),username:e.email??e.phone,password:n,phone:e.phone,reset:!0})}
        <button type="button" class="btn-secondary w-full py-2.5" data-close>Done</button>
      </div>`}catch(o){r("[data-error]",a).innerHTML=T(w(o)),i.disabled=!1,i.textContent="Reset password"}})}function O(e,t,a){const s=L(e),n=g(`QR board ${e}`,`<div id="qr-board" class="rounded-xl border-2 border-dashed border-gray-200 bg-white p-6 text-center">
      <p class="text-xs font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
      <h4 class="mt-1 text-xl font-extrabold text-ink-900">${d(t)}</h4>
      <p class="mt-0.5 text-sm text-ink-500">${d(k(a))}</p>
      <div class="mx-auto mt-3 flex h-52 w-52 items-center justify-center" data-qr>${S("")}</div>
      <p class="mt-2 font-mono text-sm font-bold text-ink-900">${d(e)}</p>
      <p class="mt-0.5 text-xs text-ink-400">Point your camera at the code</p>
      <p class="mt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Powered by Markkito</p>
    </div>
    <p class="mt-2 break-all text-[11px] text-ink-400">${d(s)}</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled data-download class="btn-primary flex-1 py-2.5 disabled:opacity-50">${l("download",{size:15})} Download PNG</button>
      <button type="button" data-print class="btn-secondary flex-1 py-2.5">${l("printer",{size:15})} Print</button>
      <button type="button" data-copy="${d(s)}" class="btn-secondary flex-1 py-2.5">${l("copy",{size:15})} <span>Copy link</span></button>
    </div>`);let i="";E(s).then(o=>{i=o,r("[data-qr]",n.body).outerHTML=`<img src="${o}" alt="QR code ${d(e)}" class="mx-auto mt-3 h-52 w-52" />`,r("[data-download]",n.body).disabled=!1}).catch(()=>{}),r("[data-download]",n.body).addEventListener("click",()=>i&&C(i,`${e}-qr.png`)),r("[data-print]",n.body).addEventListener("click",()=>window.print())}const P={PUBLISHED:"bg-emerald-50 text-emerald-700",CONFIRMED:"bg-emerald-50 text-emerald-700",CONVERTED:"bg-emerald-50 text-emerald-700",COMPLETED:"bg-emerald-50 text-emerald-700",PENDING_APPROVAL:"bg-amber-50 text-amber-700",PENDING:"bg-amber-50 text-amber-700",NEW:"bg-brand-50 text-brand-700",CONTACTED:"bg-sky-50 text-sky-700",QUALIFIED:"bg-violet-50 text-violet-700",DRAFT:"bg-gray-100 text-gray-600",SUSPENDED:"bg-red-50 text-red-700",CANCELLED:"bg-red-50 text-red-700",LOST:"bg-red-50 text-red-700",NO_SHOW:"bg-red-50 text-red-700"};function B(e){return P[e]??"bg-gray-100 text-gray-600"}function j(){f("[data-clone-business]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.cloneBusiness);let a=null;const s=g("Clone business",`<form class="space-y-3" data-clone-form>
          <div>
            <p class="text-sm text-ink-700">Make a copy of <strong>${d(t.name)}</strong>.</p>
            <p class="mt-1 text-xs text-ink-500">The copy gets its details, hours, services, photos, slider, gallery, products and website, starts as a draft named “${d(t.name)} (Copy)” and uses 1 point. Reviews, leads, bookings, orders and QR boards stay with the original.</p>
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
        </form>`,{onClose:()=>a&&D(`This is the copy, “${a.name}” — change what you need, then publish it.`,`/dashboard/businesses/${a.id}`)}),n=r("[data-clone-form]",s.body);n.password.value=m(),r("[data-clone-generate]",n).addEventListener("click",()=>n.password.value=m()),n.addEventListener("submit",async i=>{i.preventDefault();const o=r("[data-clone-confirm]",n);o.disabled=!0,o.textContent="Cloning…";const c={username:n.username.value.trim(),password:n.password.value,phone:n.phone.value.trim()||void 0};try{({data:a}=await y.post(`/businesses/${t.id}/clone`,{owner:c}))}catch(h){u(r("[data-clone-error]",n),w(h)),o.disabled=!1,o.innerHTML=`${l("copy",{size:14})} Clone`;return}const p=a.ownerAccount;s.body.innerHTML=`<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p class="font-bold text-emerald-800 flex items-center gap-1.5">${l("check-circle-2",{size:16})} Cloned “${d(a.name)}”</p>
            <p class="text-xs text-emerald-700/90 mt-1 mb-3">${p.created?"Share this login with the business team. The password won't be shown again.":"The copy was linked to an existing account — its team signs in with this username and their existing password."}</p>
            <div class="space-y-2.5">
              ${b("Username",p.username)}
              ${p.created?b("Password",c.password):""}
              ${v({businessName:a.name.replace(/ \(Copy\)$/,""),username:p.username,password:p.created?c.password:"",phone:c.phone})}
            </div>
          </div>
          <div class="mt-4 flex justify-end">
            <button type="button" class="btn-primary px-4 py-2 text-sm" data-close>${l("arrow-right",{size:14})} Open the copy</button>
          </div>`})}))}function q(e){const t=e&&r("[data-detect-location]",e);if(!t||t.dataset.wired)return;t.dataset.wired="1";const a=r("[data-location-error]",e),s=r("span",t),n=s.textContent,i=(o=n)=>{t.disabled=!1,s.textContent=o};t.addEventListener("click",()=>{if(u(a,""),!navigator.geolocation)return u(a,"Location isn't supported by this browser.");if(!window.isSecureContext)return u(a,"Location only works on an https:// address.");t.disabled=!0,s.textContent="Fetching location…",navigator.geolocation.getCurrentPosition(o=>{e.latitude.value=o.coords.latitude.toFixed(6),e.longitude.value=o.coords.longitude.toFixed(6),e.latitude.dispatchEvent(new Event("input",{bubbles:!0})),i("Location updated ✓"),setTimeout(()=>s.textContent=n,2500)},o=>{i(),u(a,o.code===o.PERMISSION_DENIED?"Location access is blocked. Allow location for this site in the browser, then try again.":"Couldn't fetch your location. Turn on GPS / location and try again.")},{enableHighAccuracy:!0,timeout:15e3,maximumAge:0})})}function N(...e){for(const t of e){const a=String(t??"").replace(/\D/g,"");if(/^[6-9]\d{9}$/.test(a))return`91${a}`;if(/^91[6-9]\d{9}$/.test(a))return a}return""}function M({businessName:e,username:t,password:a,phone:s,reset:n=!1}){const i=[n?`Hello! The Markkito login password${e?` for *${e}*`:""} has been reset.`:`Hello! Your business${e?` *${e}*`:""} is now listed on Markkito.`,"",`Login: ${window.location.origin}/login`,`Username: ${t}`,a?`Password: ${a}`:"Password: your existing Markkito password","",n?"Please sign in with the new password.":"Sign in to update your phone, address, photos, opening hours and more."];return`https://wa.me/${N(t,s)}?text=${encodeURIComponent(i.join(`
`))}`}function v(e){return`<a href="${d(M(e))}" target="_blank" rel="noopener" class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1ebe5b]">
    ${l("message-square",{size:16})} Share login on WhatsApp
  </a>`}export{D as a,u as b,q as c,F as d,j as e,b as f,m as g,B as h,I as i,O as j,H as r,z as s,v as w};
