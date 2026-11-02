import{a as n,e as d}from"./api-3HrlSN3j.js";import{$ as t,i as o,e as l,a as i}from"./ui-DIxCFilW.js";import{s as m,d as c,i as p,e as r,r as u,f as h}from"./widgets-C8CkmAH9.js";import"./channels-CvUWVcU_.js";import"./_commonjsHelpers-CqkleIqs.js";m();c();p();(function(){let s=null;try{s=JSON.parse(sessionStorage.getItem("mk-owner-creds")||"null"),sessionStorage.removeItem("mk-owner-creds")}catch{s=null}const a=t("[data-owner-creds]");!s||!a||(a.innerHTML=`<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4">
    <div class="flex items-start justify-between gap-3">
      <p class="min-w-0 break-words font-bold text-emerald-800 flex items-start gap-1.5"><span class="mt-0.5 shrink-0">${o("key-round",{size:16})}</span> <span class="min-w-0">Login for “${l(s.businessName)}”</span></p>
      <button type="button" data-dismiss-creds class="shrink-0 text-xs text-emerald-700/70 hover:text-emerald-900 underline">Dismiss</button>
    </div>
    <p class="text-xs text-emerald-700/90 mt-1 mb-3">${s.created?"A welcome email with these login details has been sent to the owner. You can also share them directly — the password won't be shown here again.":"This listing was linked to an existing account — the business team signs in with the username below and their existing password. A welcome email has been sent."}</p>
    <div class="space-y-2.5">
      ${r("Username",s.username)}
      ${s.created?r("Password",s.password):""}
    </div>
  </div>`,t("[data-dismiss-creds]",a).addEventListener("click",()=>a.innerHTML=""))})();i("[data-reset-password]").forEach(e=>e.addEventListener("click",()=>u(JSON.parse(e.dataset.resetPassword))));i("[data-status-update]").forEach(e=>{let s=e.value;e.addEventListener("change",async()=>{try{await n.patch(e.dataset.statusUpdate,{status:e.value}),e.className=`badge border-0 shrink-0 ${h(e.value)}`,s=e.value}catch(a){e.value=s,e.title=d(a)}})});
