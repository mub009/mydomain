import{a as y,e as p,u as h}from"./api-3HrlSN3j.js";import{a as g,r as v,d as k,b as $}from"./channels-e-xcKH2w.js";import{$ as o,o as b,e as i,i as l,b as E,a as f,c as C}from"./ui-D0zQHRcp.js";const c="mk-flash";function L(t,e){try{sessionStorage.setItem(c,t)}catch{}e?window.location.href=e:window.location.reload()}function S(t=o("[data-flash]")){let e=null;try{e=sessionStorage.getItem(c),sessionStorage.removeItem(c)}catch{}e&&t&&(t.textContent=e,t.hidden=!1,setTimeout(()=>t.hidden=!0,4e3))}function T(t,e){t&&(t.textContent=e,t.hidden=!e)}function R(t=document){f("[data-upload-field]",t).forEach(e=>{if(e.dataset.wired)return;e.dataset.wired="1";const n=o("[data-upload-url]",e),a=o("[data-upload-button]",e),s=o("[data-upload-file]",e),d=o("[data-upload-error]",e);a.addEventListener("click",()=>s.click()),s.addEventListener("change",async()=>{var m;const r=(m=s.files)==null?void 0:m[0];if(r){d.hidden=!0,a.disabled=!0,o("span",a).textContent="Uploading…";try{n.value=await h(r,e.dataset.uploadField),n.dispatchEvent(new Event("input",{bubbles:!0}))}catch(w){d.textContent=p(w),d.hidden=!1}finally{a.disabled=!1,o("span",a).textContent="Upload",s.value=""}}})})}function u(){const t="ABCDEFGHJKLMNPQRSTUVWXYZ",e="abcdefghijkmnpqrstuvwxyz",n="23456789",a=t+e+n,s=r=>r[Math.floor(Math.random()*r.length)];let d=s(t)+s(e)+s(n);for(let r=0;r<7;r++)d+=s(a);return d.split("").sort(()=>Math.random()-.5).join("")}function x(t,e){return`<div>
    <label class="block text-[11px] font-medium text-emerald-700/80 mb-1">${i(t)}</label>
    <div class="flex items-center gap-2">
      <code class="flex-1 min-w-0 truncate rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-mono text-ink-900">${i(e)}</code>
      <button type="button" class="btn-secondary px-3 py-2 text-sm whitespace-nowrap" data-copy="${i(e)}">${l("copy",{size:14})} <span>Copy</span></button>
    </div>
  </div>`}document.addEventListener("click",t=>{var n;const e=t.target.closest("[data-copy]");e&&((n=navigator.clipboard)==null||n.writeText(e.dataset.copy).then(()=>{const a=o("span",e);if(!a)return;const s=a.textContent;a.textContent="Copied",setTimeout(()=>a.textContent=s,1500)},()=>{}))});function U(t){const e=b(`Reset password — ${t.firstName} ${t.lastName}`,`<form class="space-y-3">
      <div data-error></div>
      <p class="text-sm text-ink-600">Set a new login password for <span class="font-semibold text-ink-900">${i(t.email??t.phone)}</span>. Their current password stops working immediately.</p>
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">New password (min 8 chars)</label>
        <div class="flex gap-2">
          <input required minlength="8" type="text" name="password" class="input font-mono" value="${i(u())}" />
          <button type="button" data-generate class="btn-secondary px-3 py-2 text-sm whitespace-nowrap">${l("refresh-cw",{size:14})} Generate</button>
        </div>
      </div>
      <button class="btn-primary w-full py-2.5" data-submit>Reset password</button>
    </form>`),n=o("form",e.body);o("[data-generate]",n).addEventListener("click",()=>n.password.value=u()),n.addEventListener("submit",async a=>{a.preventDefault();const s=n.password.value,d=o("[data-submit]",n);d.disabled=!0,d.textContent="Resetting…";try{await y.patch(`/users/${t.id}/password`,{password:s}),e.body.innerHTML=`<div class="space-y-3">
        <p class="text-sm text-emerald-800 bg-emerald-50 rounded-md px-3 py-2">Password reset. Their old sessions are signed out — share the new login below. The password won't be shown again.</p>
        ${x("Username",t.email??t.phone)}
        ${x("New password",s)}
        <button type="button" class="btn-primary w-full py-2.5" data-close>Done</button>
      </div>`}catch(r){o("[data-error]",n).innerHTML=E(p(r)),d.disabled=!1,d.textContent="Reset password"}})}function I(t,e,n){const a=$(t),s=b(`QR board ${t}`,`<div id="qr-board" class="rounded-xl border-2 border-dashed border-gray-200 bg-white p-6 text-center">
      <p class="text-xs font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
      <h4 class="mt-1 text-xl font-extrabold text-ink-900">${i(e)}</h4>
      <p class="mt-0.5 text-sm text-ink-500">${i(g(n))}</p>
      <div class="mx-auto mt-3 flex h-52 w-52 items-center justify-center" data-qr>${C("")}</div>
      <p class="mt-2 font-mono text-sm font-bold text-ink-900">${i(t)}</p>
      <p class="mt-0.5 text-xs text-ink-400">Point your camera at the code</p>
      <p class="mt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Powered by Markkito</p>
    </div>
    <p class="mt-2 break-all text-[11px] text-ink-400">${i(a)}</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled data-download class="btn-primary flex-1 py-2.5 disabled:opacity-50">${l("download",{size:15})} Download PNG</button>
      <button type="button" data-print class="btn-secondary flex-1 py-2.5">${l("printer",{size:15})} Print</button>
      <button type="button" data-copy="${i(a)}" class="btn-secondary flex-1 py-2.5">${l("copy",{size:15})} <span>Copy link</span></button>
    </div>`);let d="";v(a).then(r=>{d=r,o("[data-qr]",s.body).outerHTML=`<img src="${r}" alt="QR code ${i(t)}" class="mx-auto mt-3 h-52 w-52" />`,o("[data-download]",s.body).disabled=!1}).catch(()=>{}),o("[data-download]",s.body).addEventListener("click",()=>d&&k(d,`${t}-qr.png`)),o("[data-print]",s.body).addEventListener("click",()=>window.print())}const D={PUBLISHED:"bg-emerald-50 text-emerald-700",CONFIRMED:"bg-emerald-50 text-emerald-700",CONVERTED:"bg-emerald-50 text-emerald-700",COMPLETED:"bg-emerald-50 text-emerald-700",PENDING_APPROVAL:"bg-amber-50 text-amber-700",PENDING:"bg-amber-50 text-amber-700",NEW:"bg-brand-50 text-brand-700",CONTACTED:"bg-sky-50 text-sky-700",QUALIFIED:"bg-violet-50 text-violet-700",DRAFT:"bg-gray-100 text-gray-600",SUSPENDED:"bg-red-50 text-red-700",CANCELLED:"bg-red-50 text-red-700",LOST:"bg-red-50 text-red-700",NO_SHOW:"bg-red-50 text-red-700"};function A(t){return D[t]??"bg-gray-100 text-gray-600"}function F(){f("[data-clone-business]").forEach(t=>t.addEventListener("click",()=>{const e=JSON.parse(t.dataset.cloneBusiness),n=b("Clone business",`<p class="text-sm text-ink-700">Make a copy of <strong>${i(e.name)}</strong>?</p>
        <p class="mt-2 text-sm text-ink-500">The copy gets its details, hours, services, photos, slider, gallery, products and website. It starts as a draft named “${i(e.name)} (Copy)” and uses 1 point.</p>
        <p class="mt-2 text-xs text-ink-400">Reviews, leads, bookings, orders and QR boards stay with the original.</p>
        <p class="mt-3 text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-clone-error hidden></p>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="btn-secondary px-4 py-2 text-sm" data-close>Cancel</button>
          <button type="button" class="btn-primary px-4 py-2 text-sm" data-clone-confirm>${l("copy",{size:14})} Clone</button>
        </div>`),a=o("[data-clone-confirm]",n.body);a.addEventListener("click",async()=>{a.disabled=!0,a.textContent="Cloning…";try{const{data:s}=await y.post(`/businesses/${e.id}/clone`);L(`Cloned. This is the copy, “${s.name}” — change what you need, then publish it.`,`/dashboard/businesses/${s.id}`)}catch(s){T(o("[data-clone-error]",n.body),p(s)),a.disabled=!1,a.innerHTML=`${l("copy",{size:14})} Clone`}})}))}export{L as a,T as b,x as c,A as d,R as e,I as f,u as g,F as i,U as r,S as s};
