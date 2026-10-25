import{a as w,e as u,u as y}from"./api-3HrlSN3j.js";import{a as g,r as h,d as v,b as k}from"./channels-e-xcKH2w.js";import{$ as o,o as x,e as i,i as l,b as E,a as $,c as C}from"./ui-D0zQHRcp.js";const c="mk-flash";function P(t,e){try{sessionStorage.setItem(c,t)}catch{}e?window.location.href=e:window.location.reload()}function M(t=o("[data-flash]")){let e=null;try{e=sessionStorage.getItem(c),sessionStorage.removeItem(c)}catch{}e&&t&&(t.textContent=e,t.hidden=!1,setTimeout(()=>t.hidden=!0,4e3))}function S(t,e){t&&(t.textContent=e,t.hidden=!e)}function U(t=document){$("[data-upload-field]",t).forEach(e=>{if(e.dataset.wired)return;e.dataset.wired="1";const n=o("[data-upload-url]",e),s=o("[data-upload-button]",e),a=o("[data-upload-file]",e),r=o("[data-upload-error]",e);s.addEventListener("click",()=>a.click()),a.addEventListener("change",async()=>{var p;const d=(p=a.files)==null?void 0:p[0];if(d){r.hidden=!0,s.disabled=!0,o("span",s).textContent="Uploading…";try{n.value=await y(d,e.dataset.uploadField),n.dispatchEvent(new Event("input",{bubbles:!0}))}catch(f){r.textContent=u(f),r.hidden=!1}finally{s.disabled=!1,o("span",s).textContent="Upload",a.value=""}}})})}function b(){const t="ABCDEFGHJKLMNPQRSTUVWXYZ",e="abcdefghijkmnpqrstuvwxyz",n="23456789",s=t+e+n,a=d=>d[Math.floor(Math.random()*d.length)];let r=a(t)+a(e)+a(n);for(let d=0;d<7;d++)r+=a(s);return r.split("").sort(()=>Math.random()-.5).join("")}function m(t,e){return`<div>
    <label class="block text-[11px] font-medium text-emerald-700/80 mb-1">${i(t)}</label>
    <div class="flex items-center gap-2">
      <code class="flex-1 min-w-0 truncate rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-mono text-ink-900">${i(e)}</code>
      <button type="button" class="btn-secondary px-3 py-2 text-sm whitespace-nowrap" data-copy="${i(e)}">${l("copy",{size:14})} <span>Copy</span></button>
    </div>
  </div>`}document.addEventListener("click",t=>{var n;const e=t.target.closest("[data-copy]");e&&((n=navigator.clipboard)==null||n.writeText(e.dataset.copy).then(()=>{const s=o("span",e);if(!s)return;const a=s.textContent;s.textContent="Copied",setTimeout(()=>s.textContent=a,1500)},()=>{}))});function R(t){const e=x(`Reset password — ${t.firstName} ${t.lastName}`,`<form class="space-y-3">
      <div data-error></div>
      <p class="text-sm text-ink-600">Set a new login password for <span class="font-semibold text-ink-900">${i(t.email??t.phone)}</span>. Their current password stops working immediately.</p>
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">New password (min 8 chars)</label>
        <div class="flex gap-2">
          <input required minlength="8" type="text" name="password" class="input font-mono" value="${i(b())}" />
          <button type="button" data-generate class="btn-secondary px-3 py-2 text-sm whitespace-nowrap">${l("refresh-cw",{size:14})} Generate</button>
        </div>
      </div>
      <button class="btn-primary w-full py-2.5" data-submit>Reset password</button>
    </form>`),n=o("form",e.body);o("[data-generate]",n).addEventListener("click",()=>n.password.value=b()),n.addEventListener("submit",async s=>{s.preventDefault();const a=n.password.value,r=o("[data-submit]",n);r.disabled=!0,r.textContent="Resetting…";try{await w.patch(`/users/${t.id}/password`,{password:a}),e.body.innerHTML=`<div class="space-y-3">
        <p class="text-sm text-emerald-800 bg-emerald-50 rounded-md px-3 py-2">Password reset. Their old sessions are signed out — share the new login below. The password won't be shown again.</p>
        ${m("Username",t.email??t.phone)}
        ${m("New password",a)}
        <button type="button" class="btn-primary w-full py-2.5" data-close>Done</button>
      </div>`}catch(d){o("[data-error]",n).innerHTML=E(u(d)),r.disabled=!1,r.textContent="Reset password"}})}function A(t,e,n){const s=k(t),a=x(`QR board ${t}`,`<div id="qr-board" class="rounded-xl border-2 border-dashed border-gray-200 bg-white p-6 text-center">
      <p class="text-xs font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
      <h4 class="mt-1 text-xl font-extrabold text-ink-900">${i(e)}</h4>
      <p class="mt-0.5 text-sm text-ink-500">${i(g(n))}</p>
      <div class="mx-auto mt-3 flex h-52 w-52 items-center justify-center" data-qr>${C("")}</div>
      <p class="mt-2 font-mono text-sm font-bold text-ink-900">${i(t)}</p>
      <p class="mt-0.5 text-xs text-ink-400">Point your camera at the code</p>
      <p class="mt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Powered by Markkito</p>
    </div>
    <p class="mt-2 break-all text-[11px] text-ink-400">${i(s)}</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled data-download class="btn-primary flex-1 py-2.5 disabled:opacity-50">${l("download",{size:15})} Download PNG</button>
      <button type="button" data-print class="btn-secondary flex-1 py-2.5">${l("printer",{size:15})} Print</button>
      <button type="button" data-copy="${i(s)}" class="btn-secondary flex-1 py-2.5">${l("copy",{size:15})} <span>Copy link</span></button>
    </div>`);let r="";h(s).then(d=>{r=d,o("[data-qr]",a.body).outerHTML=`<img src="${d}" alt="QR code ${i(t)}" class="mx-auto mt-3 h-52 w-52" />`,o("[data-download]",a.body).disabled=!1}).catch(()=>{}),o("[data-download]",a.body).addEventListener("click",()=>r&&v(r,`${t}-qr.png`)),o("[data-print]",a.body).addEventListener("click",()=>window.print())}const L={PUBLISHED:"bg-emerald-50 text-emerald-700",CONFIRMED:"bg-emerald-50 text-emerald-700",CONVERTED:"bg-emerald-50 text-emerald-700",COMPLETED:"bg-emerald-50 text-emerald-700",PENDING_APPROVAL:"bg-amber-50 text-amber-700",PENDING:"bg-amber-50 text-amber-700",NEW:"bg-brand-50 text-brand-700",CONTACTED:"bg-sky-50 text-sky-700",QUALIFIED:"bg-violet-50 text-violet-700",DRAFT:"bg-gray-100 text-gray-600",SUSPENDED:"bg-red-50 text-red-700",CANCELLED:"bg-red-50 text-red-700",LOST:"bg-red-50 text-red-700",NO_SHOW:"bg-red-50 text-red-700"};function F(t){return L[t]??"bg-gray-100 text-gray-600"}export{P as a,S as b,m as c,F as d,A as e,b as g,U as i,R as r,M as s};
