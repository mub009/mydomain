import{a as w,e as h,u as v}from"./api-3HrlSN3j.js";import{a as g,r as k,d as E,b as $}from"./channels-CvUWVcU_.js";import{$ as o,a as f,o as y,e as i,i as l,b as C,c as L}from"./ui-DIxCFilW.js";function U(){f("[data-live-search]").forEach(e=>{let t,a=e.value.trim();e.addEventListener("input",()=>{clearTimeout(t),t=setTimeout(()=>{e.value.trim()!==a&&(a=e.value.trim(),e.form.submit())},400)}),e.value&&document.activeElement===document.body&&new URL(window.location.href).searchParams.has("search")&&(e.focus(),e.setSelectionRange(e.value.length,e.value.length))})}const x="mk-flash";function T(e,t){try{sessionStorage.setItem(x,e)}catch{}t?window.location.href=t:window.location.reload()}function R(e=o("[data-flash]")){let t=null;try{t=sessionStorage.getItem(x),sessionStorage.removeItem(x)}catch{}t&&e&&(e.textContent=t,e.hidden=!1,setTimeout(()=>e.hidden=!0,4e3))}function N(e,t){e&&(e.textContent=t,e.hidden=!t)}function z(e=document){f("[data-upload-field]",e).forEach(t=>{if(t.dataset.wired)return;t.dataset.wired="1";const a=o("[data-upload-url]",t),n=o("[data-upload-button]",t),s=o("[data-upload-file]",t),d=o("[data-upload-error]",t);n.addEventListener("click",()=>s.click());const r=o("[data-upload-clear]",t);if(r){const c=()=>r.hidden=!a.value.trim();a.addEventListener("input",c),r.addEventListener("click",()=>{a.value="",d.hidden=!0,a.dispatchEvent(new Event("input",{bubbles:!0})),t.dispatchEvent(new CustomEvent("upload:cleared"))})}s.addEventListener("change",async()=>{var p;const c=(p=s.files)==null?void 0:p[0];if(c){d.hidden=!0,n.disabled=!0,o("span",n).textContent="Uploading…";try{a.value=await v(c,t.dataset.uploadField),a.dispatchEvent(new Event("input",{bubbles:!0})),t.dispatchEvent(new CustomEvent("upload:done",{detail:{url:a.value}}))}catch(b){d.textContent=h(b),d.hidden=!1}finally{n.disabled=!1,o("span",n).textContent="Upload",s.value=""}}})})}function m(){const e="ABCDEFGHJKLMNPQRSTUVWXYZ",t="abcdefghijkmnpqrstuvwxyz",a="23456789",n=e+t+a,s=r=>r[Math.floor(Math.random()*r.length)];let d=s(e)+s(t)+s(a);for(let r=0;r<7;r++)d+=s(n);return d.split("").sort(()=>Math.random()-.5).join("")}function u(e,t){return`<div>
    <label class="block text-[11px] font-medium text-emerald-700/80 mb-1">${i(e)}</label>
    <div class="flex items-center gap-2">
      <code class="flex-1 min-w-0 truncate rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-mono text-ink-900">${i(t)}</code>
      <button type="button" class="btn-secondary px-3 py-2 text-sm whitespace-nowrap" data-copy="${i(t)}">${l("copy",{size:14})} <span>Copy</span></button>
    </div>
  </div>`}document.addEventListener("click",e=>{var a;const t=e.target.closest("[data-copy]");t&&((a=navigator.clipboard)==null||a.writeText(t.dataset.copy).then(()=>{const n=o("span",t);if(!n)return;const s=n.textContent;n.textContent="Copied",setTimeout(()=>n.textContent=s,1500)},()=>{}))});function A(e){const t=y(`Reset password — ${e.firstName} ${e.lastName}`,`<form class="space-y-3">
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
    </form>`),a=o("form",t.body);o("[data-generate]",a).addEventListener("click",()=>a.password.value=m()),a.addEventListener("submit",async n=>{n.preventDefault();const s=a.password.value,d=o("[data-submit]",a);d.disabled=!0,d.textContent="Resetting…";try{await w.patch(`/users/${e.id}/password`,{password:s}),t.body.innerHTML=`<div class="space-y-3">
        <p class="text-sm text-emerald-800 bg-emerald-50 rounded-md px-3 py-2">Password reset. Their old sessions are signed out — share the new login below. The password won't be shown again.</p>
        ${u("Username",e.email??e.phone)}
        ${u("New password",s)}
        <button type="button" class="btn-primary w-full py-2.5" data-close>Done</button>
      </div>`}catch(r){o("[data-error]",a).innerHTML=C(h(r)),d.disabled=!1,d.textContent="Reset password"}})}function I(e,t,a){const n=$(e),s=y(`QR board ${e}`,`<div id="qr-board" class="rounded-xl border-2 border-dashed border-gray-200 bg-white p-6 text-center">
      <p class="text-xs font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
      <h4 class="mt-1 text-xl font-extrabold text-ink-900">${i(t)}</h4>
      <p class="mt-0.5 text-sm text-ink-500">${i(g(a))}</p>
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
    </div>`);let d="";k(n).then(r=>{d=r,o("[data-qr]",s.body).outerHTML=`<img src="${r}" alt="QR code ${i(e)}" class="mx-auto mt-3 h-52 w-52" />`,o("[data-download]",s.body).disabled=!1}).catch(()=>{}),o("[data-download]",s.body).addEventListener("click",()=>d&&E(d,`${e}-qr.png`)),o("[data-print]",s.body).addEventListener("click",()=>window.print())}const D={PUBLISHED:"bg-emerald-50 text-emerald-700",CONFIRMED:"bg-emerald-50 text-emerald-700",CONVERTED:"bg-emerald-50 text-emerald-700",COMPLETED:"bg-emerald-50 text-emerald-700",PENDING_APPROVAL:"bg-amber-50 text-amber-700",PENDING:"bg-amber-50 text-amber-700",NEW:"bg-brand-50 text-brand-700",CONTACTED:"bg-sky-50 text-sky-700",QUALIFIED:"bg-violet-50 text-violet-700",DRAFT:"bg-gray-100 text-gray-600",SUSPENDED:"bg-red-50 text-red-700",CANCELLED:"bg-red-50 text-red-700",LOST:"bg-red-50 text-red-700",NO_SHOW:"bg-red-50 text-red-700"};function q(e){return D[e]??"bg-gray-100 text-gray-600"}function F(){f("[data-clone-business]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.cloneBusiness);let a=null;const n=y("Clone business",`<form class="space-y-3" data-clone-form>
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
        </form>`,{onClose:()=>a&&T(`This is the copy, “${a.name}” — change what you need, then publish it.`,`/dashboard/businesses/${a.id}`)}),s=o("[data-clone-form]",n.body);s.password.value=m(),o("[data-clone-generate]",s).addEventListener("click",()=>s.password.value=m()),s.addEventListener("submit",async d=>{d.preventDefault();const r=o("[data-clone-confirm]",s);r.disabled=!0,r.textContent="Cloning…";const c={firstName:s.firstName.value.trim(),lastName:s.lastName.value.trim(),username:s.username.value.trim(),password:s.password.value,phone:s.phone.value.trim()||void 0};try{({data:a}=await w.post(`/businesses/${t.id}/clone`,{owner:c}))}catch(b){N(o("[data-clone-error]",s),h(b)),r.disabled=!1,r.innerHTML=`${l("copy",{size:14})} Clone`;return}const p=a.ownerAccount;n.body.innerHTML=`<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p class="font-bold text-emerald-800 flex items-center gap-1.5">${l("check-circle-2",{size:16})} Cloned “${i(a.name)}”</p>
            <p class="text-xs text-emerald-700/90 mt-1 mb-3">${p.created?"Share this login with the business team. The password won't be shown again.":"The copy was linked to an existing account — its team signs in with this username and their existing password."}</p>
            <div class="space-y-2.5">
              ${u("Username",p.username)}
              ${p.created?u("Password",c.password):""}
            </div>
          </div>
          <div class="mt-4 flex justify-end">
            <button type="button" class="btn-primary px-4 py-2 text-sm" data-close>${l("arrow-right",{size:14})} Open the copy</button>
          </div>`})}))}export{T as a,N as b,F as c,u as d,q as e,z as f,m as g,I as h,U as i,A as r,R as s};
