import{a as n,e as o}from"./api-CKI2Ca7L.js";import{i as d}from"./commission-charts-B4yi6lxM.js";import{$ as t,i as m,e as l,a as i}from"./ui-DIxCFilW.js";import{s as p,e as c,i as h,f as r,w as u,r as w,h as b}from"./widgets-DeVL3D-m.js";import"./channels-CvUWVcU_.js";import"./_commonjsHelpers-CqkleIqs.js";p();c();h();(function(){let e=null;try{e=JSON.parse(sessionStorage.getItem("mk-owner-creds")||"null"),sessionStorage.removeItem("mk-owner-creds")}catch{e=null}const a=t("[data-owner-creds]");!e||!a||(a.innerHTML=`<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4">
    <div class="flex items-start justify-between gap-3">
      <p class="min-w-0 break-words font-bold text-emerald-800 flex items-start gap-1.5"><span class="mt-0.5 shrink-0">${m("key-round",{size:16})}</span> <span class="min-w-0">Login for “${l(e.businessName)}”</span></p>
      <button type="button" data-dismiss-creds class="shrink-0 text-xs text-emerald-700/70 hover:text-emerald-900 underline">Dismiss</button>
    </div>
    <p class="text-xs text-emerald-700/90 mt-1 mb-3">${e.created?"A welcome email with these login details has been sent to the owner. You can also share them directly — the password won't be shown here again.":"This listing was linked to an existing account — the business team signs in with the username below and their existing password. A welcome email has been sent."}</p>
    <div class="space-y-2.5">
      ${r("Username",e.username)}
      ${e.created?r("Password",e.password):""}
      ${u({businessName:e.businessName,username:e.username,password:e.created?e.password:"",phone:e.phone})}
    </div>
  </div>`,t("[data-dismiss-creds]",a).addEventListener("click",()=>a.innerHTML=""))})();i("[data-reset-password]").forEach(s=>s.addEventListener("click",()=>w(JSON.parse(s.dataset.resetPassword))));i("[data-status-update]").forEach(s=>{let e=s.value;s.addEventListener("change",async()=>{try{await n.patch(s.dataset.statusUpdate,{status:s.value}),s.className=`badge border-0 shrink-0 ${b(s.value)}`,e=s.value}catch(a){s.value=e,s.title=o(a)}})});d();
