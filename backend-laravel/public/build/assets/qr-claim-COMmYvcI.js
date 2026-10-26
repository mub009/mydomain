import{a as l,e as p}from"./api-3HrlSN3j.js";import{M as m,C as b,c as h}from"./channels-CvUWVcU_.js";import{p as f,$ as r,i as c,e as s,c as x}from"./ui-DIxCFilW.js";import"./_commonjsHelpers-CqkleIqs.js";const o=f("qr-claim-data"),n=r("[data-qr-claim]"),t={code:o.code??"",lookup:null,businesses:[],businessId:"",channel:"",claimed:null,loading:!!o.code,saving:!1,error:o.unknown?"That QR board was not recognised.":""};async function u(e){if(e.trim()){Object.assign(t,{loading:!0,error:"",lookup:null}),i();try{const{data:a}=await l.get(`/qr-codes/lookup/${encodeURIComponent(e.trim())}`);t.lookup=a,t.channel=a.channel??""}catch(a){t.error=p(a)}finally{t.loading=!1,i()}}}async function g(){var e;if(!t.businessId)return t.error="Choose which business this board belongs to",i();t.saving=!0,t.error="",i();try{const{data:a}=await l.post("/qr-codes/claim",{code:((e=t.lookup)==null?void 0:e.code)??t.code,businessId:t.businessId,channel:t.channel||void 0});t.claimed=a}catch(a){t.error=p(a)}finally{t.saving=!1,i()}}function v(e){var a;return`<div class="card p-7 text-center">
    <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">${c("check-circle-2",{size:30})}</span>
    <h1 class="mt-4 text-xl font-extrabold text-ink-900">QR board activated</h1>
    <p class="mt-1 text-sm text-ink-600"><span class="font-mono font-semibold">${s(e.code)}</span> is now attached to <span class="font-semibold text-ink-900">${s((a=e.business)==null?void 0:a.name)}</span>.</p>
    ${e.needsReviewLinks?`<div class="mt-4 rounded-lg bg-amber-50 p-3 text-left">
            <p class="flex items-center gap-1.5 text-sm font-bold text-amber-800">${c("alert-triangle",{size:15})} One step left</p>
            <p class="mt-1 text-xs text-amber-800/90">Add your Google, Instagram or Facebook review page so scans land on the right place. Until then, scans open your Markkito listing.</p>
          </div>`:`<div class="mt-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-left">
            <p class="text-xs font-semibold text-emerald-800">Scans now open ${s(e.effectiveChannel?b[e.effectiveChannel]:"your default channel")}</p>
            ${e.effectiveUrl?`<p class="mt-0.5 break-all text-[11px] text-emerald-700/80">${s(e.effectiveUrl)}</p>`:""}
          </div>`}
    <div class="mt-5 flex gap-2">
      <a href="/dashboard" class="btn-primary flex-1 py-2.5">Go to dashboard</a>
      <a href="/qr" class="btn-secondary flex-1 py-2.5">Activate another</a>
    </div>
  </div>`}function k(){if(!o.canClaim)return`<div class="mt-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">Sign in with your business account to attach this board.
      <a href="/login?next=${encodeURIComponent(window.location.pathname)}" class="ml-1 font-semibold underline">Log in</a></div>`;if(t.businesses.length===0)return`<div class="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">${o.role==="DEALER"?"You have not registered any businesses yet. Register one first, then attach this board.":"You don't have a business listing yet. Create one first, then attach this board."}</div>`;const e=t.channel&&m.includes(t.channel)?"Sends customers to this shop's own Markkito page — nothing to set up first.":"Uses your own link for that platform. You can change this later from your dashboard.";return`<div class="mt-4 space-y-3">
    <div>
      <label class="mb-1 block text-xs font-semibold text-ink-700">${c("store",{size:12,className:"mr-1 inline -mt-0.5"})}Attach to which business?</label>
      <select class="input" data-business>
        <option value="">Select a business</option>
        ${t.businesses.map(a=>`<option value="${s(a.id)}" ${a.id===t.businessId?"selected":""}>${s(a.name)} — ${s(a.city)}</option>`).join("")}
      </select>
    </div>
    <div>
      <label class="mb-1 block text-xs font-semibold text-ink-700">Where should a scan send customers?</label>
      <select class="input" data-channel>${h(t.channel)}</select>
      <p class="mt-1 text-[11px] text-ink-400" data-channel-hint>${e}</p>
    </div>
    <button data-claim ${t.saving||!t.businessId?"disabled":""} class="btn-primary w-full py-2.5 disabled:opacity-50">${t.saving?"Activating…":"Confirm &amp; activate board"}</button>
  </div>`}function y(e){var d;let a="";return e.status==="ASSIGNED"?a=`<p class="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">This board is already attached to <span class="font-semibold">${s((d=e.business)==null?void 0:d.name)}</span>. Contact the admin if it needs to be moved.</p>`:e.status==="DISABLED"?a='<p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">This board has been disabled. Please ask the admin for a replacement.</p>':e.status==="UNASSIGNED"&&(a=k()),`<div class="mt-4">
    <div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p class="text-xs text-ink-500">Board code</p>
      <p class="font-mono text-lg font-bold text-ink-900">${s(e.code)}</p>
      <p class="mt-1 text-xs text-ink-600">Purpose: <span class="font-semibold text-ink-900">${s(e.channel?b[e.channel]:"Your default channel")}</span></p>
      ${e.batchLabel?`<p class="mt-0.5 text-xs text-ink-400">Batch: ${s(e.batchLabel)}</p>`:""}
    </div>
    ${a}
  </div>`}function i(){var a,d;if(t.claimed){n.innerHTML=v(t.claimed);return}const e=(d=(a=document.activeElement)==null?void 0:a.matches)==null?void 0:d.call(a,"[data-code]");n.innerHTML=`<div class="card p-7">
    <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">${c("qr-code",{size:30})}</span>
    <h1 class="mt-4 text-center text-xl font-extrabold text-ink-900">Activate your review QR board</h1>
    <p class="mt-1 text-center text-sm text-ink-600">Scan the board with your camera, or type the code printed on it.</p>
    <div class="mt-5">
      <label class="mb-1 block text-xs font-semibold text-ink-700">Board code</label>
      <div class="flex gap-2">
        <input class="input font-mono uppercase" placeholder="MK-XXXXXX" value="${s(t.code)}" data-code />
        <button type="button" data-check class="btn-secondary whitespace-nowrap px-3 py-2">Check</button>
      </div>
    </div>
    ${t.error?`<p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">${s(t.error)}</p>`:""}
    ${t.loading?x("Checking code…"):""}
    ${t.lookup&&!t.loading?y(t.lookup):""}
  </div>`,e&&r("[data-code]",n).focus()}n.addEventListener("input",e=>{e.target.matches("[data-code]")&&(e.target.value=e.target.value.toUpperCase(),t.code=e.target.value)});n.addEventListener("keydown",e=>{e.target.matches("[data-code]")&&e.key==="Enter"&&(e.preventDefault(),u(t.code))});n.addEventListener("change",e=>{e.target.matches("[data-business]")&&(t.businessId=e.target.value,r("[data-claim]",n).disabled=!t.businessId),e.target.matches("[data-channel]")&&(t.channel=e.target.value,r("[data-channel-hint]",n).textContent=t.channel&&m.includes(t.channel)?"Sends customers to this shop's own Markkito page — nothing to set up first.":"Uses your own link for that platform. You can change this later from your dashboard.")});n.addEventListener("click",e=>{e.target.closest("[data-check]")&&u(t.code),e.target.closest("[data-claim]")&&g()});o.canClaim&&l.get("/qr-codes/assignable-businesses").then(({data:e})=>{t.businesses=e,e.length===1&&(t.businessId=e[0].id),i()}).catch(()=>{});i();o.code&&u(o.code);
