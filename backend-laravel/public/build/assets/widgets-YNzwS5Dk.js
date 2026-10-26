import{a as y,e as x,u as g}from"./api-3HrlSN3j.js";import{a as v,r as k,d as $,b as E}from"./channels-CvUWVcU_.js";import{$ as o,a as f,o as h,e as i,i as l,b as C,c as L}from"./ui-DIxCFilW.js";function U(){f("[data-live-search]").forEach(e=>{let t,s=e.value.trim();e.addEventListener("input",()=>{clearTimeout(t),t=setTimeout(()=>{e.value.trim()!==s&&(s=e.value.trim(),e.form.submit())},400)}),e.value&&document.activeElement===document.body&&new URL(window.location.href).searchParams.has("search")&&(e.focus(),e.setSelectionRange(e.value.length,e.value.length))})}const b="mk-flash";function T(e,t){try{sessionStorage.setItem(b,e)}catch{}t?window.location.href=t:window.location.reload()}function R(e=o("[data-flash]")){let t=null;try{t=sessionStorage.getItem(b),sessionStorage.removeItem(b)}catch{}t&&e&&(e.textContent=t,e.hidden=!1,setTimeout(()=>e.hidden=!0,4e3))}function N(e,t){e&&(e.textContent=t,e.hidden=!t)}function z(e=document){f("[data-upload-field]",e).forEach(t=>{if(t.dataset.wired)return;t.dataset.wired="1";const s=o("[data-upload-url]",t),n=o("[data-upload-button]",t),a=o("[data-upload-file]",t),d=o("[data-upload-error]",t);n.addEventListener("click",()=>a.click()),a.addEventListener("change",async()=>{var c;const r=(c=a.files)==null?void 0:c[0];if(r){d.hidden=!0,n.disabled=!0,o("span",n).textContent="Uploading…";try{s.value=await g(r,t.dataset.uploadField),s.dispatchEvent(new Event("input",{bubbles:!0}))}catch(p){d.textContent=x(p),d.hidden=!1}finally{n.disabled=!1,o("span",n).textContent="Upload",a.value=""}}})})}function m(){const e="ABCDEFGHJKLMNPQRSTUVWXYZ",t="abcdefghijkmnpqrstuvwxyz",s="23456789",n=e+t+s,a=r=>r[Math.floor(Math.random()*r.length)];let d=a(e)+a(t)+a(s);for(let r=0;r<7;r++)d+=a(n);return d.split("").sort(()=>Math.random()-.5).join("")}function u(e,t){return`<div>
    <label class="block text-[11px] font-medium text-emerald-700/80 mb-1">${i(e)}</label>
    <div class="flex items-center gap-2">
      <code class="flex-1 min-w-0 truncate rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-mono text-ink-900">${i(t)}</code>
      <button type="button" class="btn-secondary px-3 py-2 text-sm whitespace-nowrap" data-copy="${i(t)}">${l("copy",{size:14})} <span>Copy</span></button>
    </div>
  </div>`}document.addEventListener("click",e=>{var s;const t=e.target.closest("[data-copy]");t&&((s=navigator.clipboard)==null||s.writeText(t.dataset.copy).then(()=>{const n=o("span",t);if(!n)return;const a=n.textContent;n.textContent="Copied",setTimeout(()=>n.textContent=a,1500)},()=>{}))});function A(e){const t=h(`Reset password — ${e.firstName} ${e.lastName}`,`<form class="space-y-3">
      <div data-error></div>
      <p class="text-sm text-ink-600">Set a new login password for <span class="font-semibold text-ink-900">${i(e.email??e.phone)}</span>. Their current password stops working immediately.</p>
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">New password (min 8 chars)</label>
        <div class="flex gap-2">
          <input required minlength="8" type="text" name="password" class="input font-mono" value="${i(m())}" />
          <button type="button" data-generate class="btn-secondary px-3 py-2 text-sm whitespace-nowrap">${l("refresh-cw",{size:14})} Generate</button>
        </div>
      </div>
      <button class="btn-primary w-full py-2.5" data-submit>Reset password</button>
    </form>`),s=o("form",t.body);o("[data-generate]",s).addEventListener("click",()=>s.password.value=m()),s.addEventListener("submit",async n=>{n.preventDefault();const a=s.password.value,d=o("[data-submit]",s);d.disabled=!0,d.textContent="Resetting…";try{await y.patch(`/users/${e.id}/password`,{password:a}),t.body.innerHTML=`<div class="space-y-3">
        <p class="text-sm text-emerald-800 bg-emerald-50 rounded-md px-3 py-2">Password reset. Their old sessions are signed out — share the new login below. The password won't be shown again.</p>
        ${u("Username",e.email??e.phone)}
        ${u("New password",a)}
        <button type="button" class="btn-primary w-full py-2.5" data-close>Done</button>
      </div>`}catch(r){o("[data-error]",s).innerHTML=C(x(r)),d.disabled=!1,d.textContent="Reset password"}})}function I(e,t,s){const n=E(e),a=h(`QR board ${e}`,`<div id="qr-board" class="rounded-xl border-2 border-dashed border-gray-200 bg-white p-6 text-center">
      <p class="text-xs font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
      <h4 class="mt-1 text-xl font-extrabold text-ink-900">${i(t)}</h4>
      <p class="mt-0.5 text-sm text-ink-500">${i(v(s))}</p>
      <div class="mx-auto mt-3 flex h-52 w-52 items-center justify-center" data-qr>${L("")}</div>
      <p class="mt-2 font-mono text-sm font-bold text-ink-900">${i(e)}</p>
      <p class="mt-0.5 text-xs text-ink-400">Point your camera at the code</p>
      <p class="mt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Powered by Markkito</p>
    </div>
    <p class="mt-2 break-all text-[11px] text-ink-400">${i(n)}</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled data-download class="btn-primary flex-1 py-2.5 disabled:opacity-50">${l("download",{size:15})} Download PNG</button>
      <button type="button" data-print class="btn-secondary flex-1 py-2.5">${l("printer",{size:15})} Print</button>
      <button type="button" data-copy="${i(n)}" class="btn-secondary flex-1 py-2.5">${l("copy",{size:15})} <span>Copy link</span></button>
    </div>`);let d="";k(n).then(r=>{d=r,o("[data-qr]",a.body).outerHTML=`<img src="${r}" alt="QR code ${i(e)}" class="mx-auto mt-3 h-52 w-52" />`,o("[data-download]",a.body).disabled=!1}).catch(()=>{}),o("[data-download]",a.body).addEventListener("click",()=>d&&$(d,`${e}-qr.png`)),o("[data-print]",a.body).addEventListener("click",()=>window.print())}const D={PUBLISHED:"bg-emerald-50 text-emerald-700",CONFIRMED:"bg-emerald-50 text-emerald-700",CONVERTED:"bg-emerald-50 text-emerald-700",COMPLETED:"bg-emerald-50 text-emerald-700",PENDING_APPROVAL:"bg-amber-50 text-amber-700",PENDING:"bg-amber-50 text-amber-700",NEW:"bg-brand-50 text-brand-700",CONTACTED:"bg-sky-50 text-sky-700",QUALIFIED:"bg-violet-50 text-violet-700",DRAFT:"bg-gray-100 text-gray-600",SUSPENDED:"bg-red-50 text-red-700",CANCELLED:"bg-red-50 text-red-700",LOST:"bg-red-50 text-red-700",NO_SHOW:"bg-red-50 text-red-700"};function q(e){return D[e]??"bg-gray-100 text-gray-600"}function F(){f("[data-clone-business]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.cloneBusiness);let s=null;const n=h("Clone business",`<form class="space-y-3" data-clone-form>
          <div>
            <p class="text-sm text-ink-700">Make a copy of <strong>${i(t.name)}</strong>.</p>
            <p class="mt-1 text-xs text-ink-500">The copy gets its details, hours, services, photos, slider, gallery, products and website, starts as a draft named “${i(t.name)} (Copy)” and uses 1 point. Reviews, leads, bookings, orders and QR boards stay with the original.</p>
          </div>
          <div class="rounded-lg border border-gray-200 p-3 space-y-2">
            <p class="text-sm font-semibold text-ink-900 flex items-center gap-1.5">${l("key-round",{size:14})} Login for the copy</p>
            <p class="text-[11px] text-ink-500">The copy is assigned to this account so its business team can sign in. If the username already has an account, the copy is linked to it and the password is ignored.</p>
            <div class="flex gap-2">
              <input class="input" name="firstName" placeholder="Contact first name" required />
              <input class="input" name="lastName" placeholder="Contact last name" required />
            </div>
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
        </form>`,{onClose:()=>s&&T(`This is the copy, “${s.name}” — change what you need, then publish it.`,`/dashboard/businesses/${s.id}`)}),a=o("[data-clone-form]",n.body);a.password.value=m(),o("[data-clone-generate]",a).addEventListener("click",()=>a.password.value=m()),a.addEventListener("submit",async d=>{d.preventDefault();const r=o("[data-clone-confirm]",a);r.disabled=!0,r.textContent="Cloning…";const c={firstName:a.firstName.value.trim(),lastName:a.lastName.value.trim(),username:a.username.value.trim(),password:a.password.value,phone:a.phone.value.trim()||void 0};try{({data:s}=await y.post(`/businesses/${t.id}/clone`,{owner:c}))}catch(w){N(o("[data-clone-error]",a),x(w)),r.disabled=!1,r.innerHTML=`${l("copy",{size:14})} Clone`;return}const p=s.ownerAccount;n.body.innerHTML=`<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p class="font-bold text-emerald-800 flex items-center gap-1.5">${l("check-circle-2",{size:16})} Cloned “${i(s.name)}”</p>
            <p class="text-xs text-emerald-700/90 mt-1 mb-3">${p.created?"Share this login with the business team. The password won't be shown again.":"The copy was linked to an existing account — its team signs in with this username and their existing password."}</p>
            <div class="space-y-2.5">
              ${u("Username",p.username)}
              ${p.created?u("Password",c.password):""}
            </div>
          </div>
          <div class="mt-4 flex justify-end">
            <button type="button" class="btn-primary px-4 py-2 text-sm" data-close>${l("arrow-right",{size:14})} Open the copy</button>
          </div>`})}))}export{T as a,N as b,F as c,u as d,q as e,z as f,m as g,I as h,U as i,A as r,R as s};
