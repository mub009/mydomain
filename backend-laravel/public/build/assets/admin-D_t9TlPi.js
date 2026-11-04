import{a as p,e as y}from"./api-3HrlSN3j.js";import{r as j,b as V,d as Y,a as Z}from"./channels-CvUWVcU_.js";import{$ as i,a as d,o as v,e as l,i as x,b as E,p as M,f as ee}from"./ui-DIxCFilW.js";import{i as te}from"./searchable-select-Ci9s0_RU.js";import{s as ae,i as se}from"./state-city-D2K26BbD.js";import{s as ne,i as ie,r as re,a as f,b as A}from"./widgets-DR4AA6UJ.js";import"./_commonjsHelpers-CqkleIqs.js";const z=["CUSTOMER","BUSINESS_OWNER","DEALER","ADMIN"],oe=["ACTIVE","SUSPENDED","PENDING_VERIFICATION"],de=["DRAFT","PENDING_APPROVAL","PUBLISHED","SUSPENDED"],le={MANAGE_LISTINGS:"Manage listings",MANAGE_LEADS:"Manage leads",MANAGE_BOOKINGS:"Manage bookings"},J=e=>e.replace("_"," "),T=i("[data-error]"),k=e=>A(T,y(e));ne();ie();d("[data-autosubmit-check]").forEach(e=>e.addEventListener("change",()=>e.form.submit()));function D(e,t){return e.map(a=>`<option value="${a}" ${a===t?"selected":""}>${J(a)}</option>`).join("")}function Q(e){return`<div data-privileges>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Dealer privileges</label>
    <div class="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      ${Object.entries(le).map(([t,a])=>`<label class="flex items-center gap-2 text-sm text-ink-700 cursor-pointer"><input type="checkbox" name="privileges" value="${t}" ${e.includes(t)?"checked":""} /> ${a}</label>`).join("")}
      <p class="text-xs text-ink-400 pt-1">Controls which dashboard features this dealer can access.</p>
    </div>
  </div>`}function ce(e){const t=M("admin-pricing-groups")??[];return t.length?`<div data-when-dealer>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Pricing group</label>
    <select class="input" name="pricingGroupId">
      ${t.map(a=>{const s=a.isDefault?"":a.id,r=e?e===a.id:a.isDefault;return`<option value="${l(s)}" ${r?"selected":""}>${l(a.name)}${a.isDefault?" (default)":""}</option>`}).join("")}
    </select>
    <p class="text-xs text-ink-500 mt-1">The feature prices this dealer pays. Set them in Feature Pricing.</p>
  </div>`:""}function W(e){const t=()=>{const a=e.role.value==="DEALER";i("[data-privileges]",e).hidden=!a,d("[data-when-dealer]",e).forEach(s=>s.hidden=!a),e.phone.required=a,e.email.required=!a};e.role.addEventListener("change",t),t()}async function N(e,t,a,s){const r=t.textContent;t.disabled=!0,t.textContent=a,i("[data-form-error]",e).innerHTML="";try{await s()}catch(n){i("[data-form-error]",e).innerHTML=E(y(n)),t.disabled=!1,t.textContent=r}}var G;(G=i("[data-create-user]"))==null||G.addEventListener("click",()=>{const e=v("Add a user",`<form class="space-y-3">
      <div data-form-error></div>
      <div class="flex gap-3">
        <input required class="input" name="firstName" placeholder="First name" />
        <input required class="input" name="lastName" placeholder="Last name" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">Mobile number <span data-when-dealer>(login username)</span></label>
        <input class="input" type="tel" name="phone" inputmode="numeric" maxlength="14" placeholder="9876543210" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">Email <span data-when-dealer>(optional)</span></label>
        <input class="input" type="email" name="email" placeholder="name@example.com" />
      </div>
      <input required minlength="8" class="input" type="password" name="password" placeholder="Password (min 8 chars)" />
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">Role</label>
        <select class="input" name="role">${D(z,"DEALER")}</select>
        <p class="text-xs text-ink-500 mt-1">Dealers can add and manage stores on behalf of businesses.</p>
      </div>
      ${Q(["MANAGE_LISTINGS"])}
      <button class="btn-primary w-full py-2.5" data-submit>Create user</button>
    </form>`),t=i("form",e.body);W(t),t.addEventListener("submit",a=>{a.preventDefault();const s=Object.fromEntries(new FormData(t)),r=new FormData(t).getAll("privileges");N(t,i("[data-submit]",t),"Creating…",async()=>{await p.post("/admin/users",{firstName:s.firstName,lastName:s.lastName,email:s.email.trim()||null,phone:s.phone.trim()||null,password:s.password,role:s.role,...s.role==="DEALER"?{privileges:r}:{}}),f(s.role==="DEALER"?`Dealer created — they sign in with ${s.phone.trim()}.`:"User created.")})})});d("[data-edit-user]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.editUser),a=v(`Edit ${t.firstName} ${t.lastName}`,`<form class="space-y-3">
        <div data-form-error></div>
        <div class="flex gap-3">
          <input class="input" name="firstName" value="${l(t.firstName)}" placeholder="First name" />
          <input class="input" name="lastName" value="${l(t.lastName)}" placeholder="Last name" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-ink-700 mb-1">Mobile number <span data-when-dealer>(login username)</span></label>
          <input class="input" type="tel" name="phone" inputmode="numeric" maxlength="14" value="${l(t.phone??"")}" placeholder="9876543210" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-ink-700 mb-1">Email <span data-when-dealer>(optional)</span></label>
          <input class="input" type="email" name="email" value="${l(t.email??"")}" placeholder="name@example.com" />
        </div>
        <div class="flex gap-3">
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Role</label>
            <select class="input" name="role">${D(z,t.role)}</select>
          </div>
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select class="input" name="status">${D(oe,t.status)}</select>
          </div>
        </div>
        ${Q(t.privileges??[])}
        ${ce(t.pricingGroupId??null)}
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`),s=i("form",a.body);W(s),s.addEventListener("submit",r=>{r.preventDefault();const n=Object.fromEntries(new FormData(s)),m=new FormData(s).getAll("privileges");N(s,i("[data-submit]",s),"Saving…",async()=>{await p.patch(`/admin/users/${t.id}`,{firstName:n.firstName,lastName:n.lastName,email:n.email.trim()||null,phone:n.phone.trim()||null,role:n.role,status:n.status,...n.role==="DEALER"?{privileges:m,pricingGroupId:n.pricingGroupId||null}:{}}),f("User updated.")})})}));d("[data-reset-password]").forEach(e=>e.addEventListener("click",()=>re(JSON.parse(e.dataset.resetPassword))));const me={ADMIN_GRANT:["Granted","bg-emerald-50 text-emerald-700"],ADMIN_DEDUCTION:["Deducted","bg-red-50 text-red-700"],BUSINESS_CREATED:["Business registered","bg-brand-50 text-brand-700"],BUSINESS_DELETED:["Business deleted (refund)","bg-gray-100 text-gray-600"],FEATURE_ADDED:["Feature added","bg-brand-50 text-brand-700"],FEATURE_REMOVED:["Feature removed (refund)","bg-gray-100 text-gray-600"],FEATURE_RENEWED:["Feature renewed","bg-amber-50 text-amber-700"]};d("[data-points]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.points);let a=t.points??0,s="grant",r=!1;const m=v(`Points — ${t.firstName} ${t.lastName}`,`<div class="space-y-4">
        <div class="rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-4 text-white">
          <p class="text-white/80 text-xs flex items-center gap-1.5">${x("coins",{size:14})} Current balance</p>
          <p class="text-3xl font-extrabold mt-0.5" data-balance></p>
          <p class="text-white/80 text-xs mt-1" data-balance-note></p>
        </div>
        <form class="space-y-3">
          <div data-form-error></div>
          <div class="flex gap-2">
            <button type="button" data-mode="grant" class="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors">${x("plus",{size:14,className:"inline -mt-0.5 mr-1"})} Add points</button>
            <button type="button" data-mode="deduct" class="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors">${x("minus",{size:14,className:"inline -mt-0.5 mr-1"})} Deduct</button>
          </div>
          <div>
            <label class="block text-xs font-semibold text-ink-700 mb-1">Amount</label>
            <input required type="number" min="1" class="input" name="amount" value="10" />
            <div class="flex gap-2 mt-2">${[5,10,25,50].map(o=>`<button type="button" data-quick="${o}" class="badge bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700"></button>`).join("")}</div>
          </div>
          <input class="input" name="note" placeholder="Note (optional, e.g. payment received)" />
          <button class="btn-primary w-full py-2.5" data-submit></button>
        </form>
        <div data-history></div>
      </div>`,{onClose:()=>r&&window.location.reload()}).body,u=i("form",m);function g(){i("[data-balance]",m).textContent=String(a),i("[data-balance-note]",m).textContent=`Can register ${a} more ${a===1?"business":"businesses"} (1 point each).`,d("[data-mode]",m).forEach(o=>{const c=o.dataset.mode===s;o.className=`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${c?s==="grant"?"bg-emerald-600 text-white border-emerald-600":"bg-red-600 text-white border-red-600":"border-gray-300 text-ink-600 hover:bg-gray-50"}`}),d("[data-quick]",m).forEach(o=>o.textContent=`${s==="grant"?"+":"−"}${o.dataset.quick}`),i("[data-submit]",m).textContent=`${s==="grant"?"Add":"Deduct"} ${u.amount.value||0} points`}async function h(){try{const{data:o}=await p.get(`/admin/users/${t.id}/points/transactions`,{pageSize:8});i("[data-history]",m).innerHTML=o.length?`<p class="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">Recent activity</p>
            <div class="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">${o.map(c=>{const[$,w]=me[c.type]??[c.type,"bg-gray-100 text-gray-600"];return`<div class="px-3 py-2 flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <span class="badge ${w}">${l($)}</span>
                    ${c.note?`<p class="text-xs text-ink-500 truncate mt-1">${l(c.note)}</p>`:""}
                    <p class="text-[11px] text-ink-400">${l(ee(c.createdAt))}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="font-bold text-sm ${c.amount>0?"text-emerald-700":"text-red-600"}">${c.amount>0?`+${c.amount}`:c.amount}</p>
                    <p class="text-[11px] text-ink-400">bal ${c.balanceAfter}</p>
                  </div>
                </div>`}).join("")}</div>`:""}catch{}}d("[data-mode]",m).forEach(o=>o.addEventListener("click",()=>{s=o.dataset.mode,g()})),d("[data-quick]",m).forEach(o=>o.addEventListener("click",()=>{u.amount.value=o.dataset.quick,g()})),u.amount.addEventListener("input",g),u.addEventListener("submit",async o=>{o.preventDefault();const c=Number(u.amount.value),$=i("[data-form-error]",u);if(!Number.isFinite(c)||c<=0){$.innerHTML=E("Enter a number greater than zero");return}const w=i("[data-submit]",u);w.disabled=!0,w.textContent="Saving…",$.innerHTML="";try{const{data:I}=await p.patch(`/admin/users/${t.id}/points`,{amount:s==="grant"?c:-c,note:u.note.value||void 0});a=I.points??0,r=!0,u.note.value="",h()}catch(I){$.innerHTML=E(y(I))}finally{w.disabled=!1,g()}}),g(),h()}));d("[data-business-action]").forEach(e=>e.addEventListener("click",async()=>{e.disabled=!0;try{await p.post(`/admin/businesses/${e.dataset.id}/${e.dataset.businessAction}`),window.location.reload()}catch(t){e.disabled=!1,k(t)}}));d("[data-edit-business]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.editBusiness),a=M("admin-categories")??[],s=v(`Edit ${t.name}`,`<form class="space-y-3">
        <div data-form-error></div>
        <input class="input" name="name" value="${l(t.name)}" placeholder="Business name" />
        <select class="input" name="categoryId" data-search-select data-search-placeholder="Search category…">
          <option value="">Select category</option>
          ${a.map(n=>{var m;return`<option value="${l(n.id)}" ${n.id===((m=t.category)==null?void 0:m.id)?"selected":""}>${l(n.name)}</option>`}).join("")}
        </select>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          ${ae({state:t.state,city:t.city})}
        </div>
        <input class="input" name="phone" value="${l(t.phone)}" placeholder="Phone" />
        <div class="flex gap-3">
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select class="input" name="status">${D(de,t.status)}</select>
          </div>
          <label class="w-1/2 flex items-end gap-2 pb-2.5 text-sm text-ink-700">
            <input type="checkbox" name="isVerified" ${t.isVerified?"checked":""} /> Verified business
          </label>
        </div>
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`),r=i("form",s.body);se(r),te(r),r.addEventListener("submit",n=>{n.preventDefault(),N(r,i("[data-submit]",r),"Saving…",async()=>{await p.patch(`/admin/businesses/${t.id}`,{name:r.name.value,categoryId:r.categoryId.value,city:r.city.value,state:r.state.value,phone:r.phone.value,status:r.status.value,isVerified:r.isVerified.checked}),f("Business updated.")})})}));d("[data-reassign]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.reassign),a=v(`Reassign “${t.name}”`,`<p class="text-sm text-ink-500 mb-3">Current owner: <span class="font-medium text-ink-800">${l(t.owner?`${t.owner.firstName} ${t.owner.lastName}`:"—")}</span>. Choose a new owner (business owner, dealer, or admin).</p>
      <div data-form-error></div>
      <div class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 mb-3">
        ${x("search",{size:16,className:"text-gray-400"})}
        <input data-owner-search placeholder="Search owners/dealers…" class="w-full py-2.5 text-sm focus:outline-none" />
      </div>
      <div class="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg" data-candidates></div>`),s=i("[data-candidates]",a.body),r=u=>({ADMIN:"bg-brand-50 text-brand-700",DEALER:"bg-violet-50 text-violet-700",BUSINESS_OWNER:"bg-sky-50 text-sky-700"})[u]??"bg-gray-100 text-gray-600";async function n(u){s.innerHTML=`<div class="flex items-center justify-center gap-2 py-8 text-sm text-ink-500">${x("loader-2",{size:16,className:"animate-spin"})} Searching…</div>`;try{const{data:g}=await p.get("/admin/users",{search:u||void 0}),h=g.filter(o=>{var c;return["BUSINESS_OWNER","DEALER","ADMIN"].includes(o.role)&&o.id!==((c=t.owner)==null?void 0:c.id)});s.innerHTML=h.length?h.map(o=>`<div class="p-3 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-ink-900 truncate">${l(o.firstName)} ${l(o.lastName)} <span class="badge ${r(o.role)} !px-1.5 !py-0">${J(o.role)}</span></p>
                  <p class="text-xs text-ink-500 truncate">${l(o.email??o.phone??"")}</p>
                </div>
                <button type="button" data-assign="${l(o.id)}" class="btn-primary px-3 py-1.5 text-sm shrink-0">Assign</button>
              </div>`).join(""):'<div class="p-6 text-center text-sm text-ink-500">No eligible owners found.</div>'}catch(g){s.innerHTML=E(y(g))}}let m;i("[data-owner-search]",a.body).addEventListener("input",u=>{clearTimeout(m),m=setTimeout(()=>n(u.target.value),250)}),s.addEventListener("click",async u=>{const g=u.target.closest("[data-assign]");if(g){d("[data-assign]",s).forEach(h=>h.disabled=!0),g.textContent="…";try{await p.post(`/admin/businesses/${t.id}/reassign`,{ownerId:g.dataset.assign}),f("Business reassigned.")}catch(h){i("[data-form-error]",a.body).innerHTML=E(y(h)),d("[data-assign]",s).forEach(o=>o.disabled=!1),g.textContent="Assign"}}}),n("")}));function K(e,t,a){const s=v(`${e.length} QR ${e.length===1?"board":"boards"} ready to print`,`<p class="mb-3 text-sm text-ink-600">Print these and hand them out. A shop scans one, confirms the code, and attaches it to their listing.</p>
    <div id="qr-board" class="grid grid-cols-2 gap-4"><p class="col-span-2 py-6 text-center text-sm text-ink-500">Rendering codes…</p></div>
    <button type="button" data-print class="btn-primary mt-4 w-full py-2.5">${x("printer",{size:15})} Print sheet</button>`,{onClose:a});Promise.all(e.map(r=>j(V(r),320).then(n=>({code:r,dataUrl:n})))).then(r=>{i("#qr-board",s.body).innerHTML=r.map(n=>`<div class="rounded-xl border-2 border-dashed border-gray-200 p-3 text-center">
          <p class="text-[9px] font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
          <p class="text-[11px] font-semibold text-ink-700">${l(Z(t))}</p>
          <img src="${n.dataUrl}" alt="${l(n.code)}" class="mx-auto my-1.5 h-28 w-28" />
          <p class="font-mono text-xs font-bold text-ink-900">${l(n.code)}</p>
          <p class="text-[8px] uppercase tracking-wider text-ink-400">Powered by Markkito</p>
        </div>`).join("")}).catch(()=>{}),i("[data-print]",s.body).addEventListener("click",()=>window.print())}d("[data-print-codes]").forEach(e=>e.addEventListener("click",()=>K(JSON.parse(e.dataset.printCodes),e.dataset.purpose||null)));d("[data-qr-png]").forEach(e=>e.addEventListener("click",()=>j(V(e.dataset.qrPng)).then(t=>Y(t,`${e.dataset.qrPng}-qr.png`)).catch(()=>A(T,"Could not generate that QR image."))));d("[data-qr-update]").forEach(e=>e.addEventListener("click",async()=>{try{await p.patch(`/admin/qr-codes/${e.dataset.qrUpdate}`,JSON.parse(e.dataset.payload)),f(e.dataset.message)}catch(t){k(t)}}));var U;(U=i("[data-generate-boards]"))==null||U.addEventListener("click",()=>{const e=v("Generate QR boards",`<form class="space-y-3">
      <div data-form-error></div>
      <p class="text-sm text-ink-600">Each board gets a unique code. Print them and hand them out — the dealer or shop chooses what the board points at when they attach it to a listing.</p>
      <div>
        <label class="mb-1 block text-xs font-semibold text-ink-700">How many boards? (max 500)</label>
        <input required type="number" min="1" max="500" class="input" name="count" value="20" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-semibold text-ink-700">Batch label (optional)</label>
        <input class="input" name="batchLabel" placeholder="e.g. Kochi run 1" />
      </div>
      <button class="btn-primary w-full py-2.5" data-submit>Generate 20 boards</button>
    </form>`),t=i("form",e.body),a=i("[data-submit]",t);t.count.addEventListener("input",()=>a.textContent=`Generate ${t.count.value||0} boards`),t.addEventListener("submit",s=>{s.preventDefault(),N(t,a,"Generating…",async()=>{const{data:r}=await p.post("/admin/qr-codes/batch",{count:Number(t.count.value),batchLabel:t.batchLabel.value||void 0});e.close(),K(r.codes,null,()=>f(`Generated ${r.created} new QR boards.`))})})});function pe(e){const t=Math.max(0,Math.floor((Date.now()-new Date(e).getTime())/1e3));if(t<60)return`${t}s ago`;const a=Math.floor(t/60);return a<60?`${a}m ago`:`${Math.floor(a/60)}h ago`}const P=(e=document)=>d("[data-time-ago]",e).forEach(t=>t.textContent=pe(t.dataset.timeAgo)),L=i("[data-online-list]");L&&(P(L),setInterval(async()=>{try{const e=await fetch("/admin/online",{headers:{Accept:"text/html"},credentials:"same-origin"});if(!e.ok)return;L.innerHTML=await e.text(),i("[data-online-count]").textContent=`${e.headers.get("X-Online-Count")??0} active`,P(L)}catch{}},15e3));async function R(e,t,a,s){A(T,"");const r=e.innerHTML;e.disabled=!0,e.textContent=t;try{const{data:n}=await a();f(s(n))}catch(n){k(n),e.disabled=!1,e.innerHTML=r}}var q;(q=i("[data-seo-run]"))==null||q.addEventListener("click",e=>R(e.currentTarget,"Syncing…",()=>p.post("/admin/seo/run"),t=>t.configured?`Synced with Google: ${t.submitted} submitted, ${t.checked} checked${t.failed?`, ${t.failed} failed`:""}.`:`Google is not connected — ${t.tracked} new page(s) tracked, nothing submitted.`));d("[data-seo-check]").forEach(e=>e.addEventListener("click",()=>R(e,"Checking…",()=>p.post(`/admin/seo/pages/${e.dataset.seoCheck}/check`),t=>t.indexStatus==="INDEXED"?"The page is on Google.":`Not on Google yet: ${t.coverageState??"no details"}.`)));d("[data-seo-submit]").forEach(e=>e.addEventListener("click",()=>R(e,"Sending…",()=>p.post(`/admin/seo/pages/${e.dataset.seoSubmit}/submit`),()=>"Sent to Google — it usually crawls within a day or two.")));d("[data-plan]").forEach(e=>{const t=i('[name="months"]',e);t.addEventListener("change",()=>d('[data-renewal-field="1"]',e).forEach(a=>a.disabled=t.value===""))});const S=(e,t)=>{const a=i(`[name="${t}"]`,e).value;return a===""?null:Number(a)};var F;(F=i("[data-feature-plans]"))==null||F.addEventListener("submit",async e=>{e.preventDefault();const t=e.currentTarget,a=i("[data-plans-saved]",t),s=i('button[type="submit"]',t),r=d("[data-plan]",t).map(n=>({feature:n.dataset.plan,points:Number(i('[name="points"]',n).value),renewalPoints:Number(i('[name="renewalPoints"]',n).value),price:S(n,"price"),commission:S(n,"commission"),renewalPrice:S(n,"renewalPrice"),renewalCommission:S(n,"renewalCommission"),months:i('[name="months"]',n).value===""?null:Number(i('[name="months"]',n).value)}));A(T,""),a.textContent="",s.disabled=!0;try{await p.put("/admin/feature-plans",{groupId:t.dataset.groupId,plans:r}),a.textContent="Pricing saved."}catch(n){k(n)}finally{s.disabled=!1}});const b=M("pricing-group-data"),C=e=>`/admin?tab=${encodeURIComponent("Feature Pricing")}${e?`&group=${e}`:""}`;function X(e,t,a,s){const r=v(e,`<form class="space-y-3">
      <div data-form-error></div>
      <input required maxlength="80" class="input" name="name" value="${l(t)}" placeholder="e.g. Gold dealers" />
      <button class="btn-primary w-full py-2.5" data-submit>${l(a)}</button>
    </form>`),n=i("form",r.body);n.name.focus(),n.addEventListener("submit",m=>{m.preventDefault(),N(n,i("[data-submit]",n),"Saving…",()=>s(n.name.value.trim()))})}var O;(O=i("[data-group-new]"))==null||O.addEventListener("click",()=>X("New pricing group","","Create group",async e=>{var a,s;const{data:t}=await p.post("/admin/pricing-groups",{name:e,copyFrom:(a=b==null?void 0:b.group)==null?void 0:a.id});f(`Created “${e}” with ${((s=b==null?void 0:b.group)==null?void 0:s.name)??"the default"} prices. Change them below, then put dealers in it from Users.`,C(t.id))}));var H;(H=i("[data-group-rename]"))==null||H.addEventListener("click",()=>X("Rename pricing group",b.group.name,"Save name",async e=>{await p.patch(`/admin/pricing-groups/${b.group.id}`,{name:e}),f("Group renamed.",C(b.group.id))}));var _;(_=i("[data-group-default]"))==null||_.addEventListener("click",async e=>{const t=e.currentTarget;t.disabled=!0;try{await p.patch(`/admin/pricing-groups/${b.group.id}`,{isDefault:!0}),f(`“${b.group.name}” is now the default: dealers in no group pay its prices.`,C(b.group.id))}catch(a){k(a),t.disabled=!1}});var B;(B=i("[data-group-delete]"))==null||B.addEventListener("click",()=>{var a;const e=((a=b.groups.find(s=>s.id===b.group.id))==null?void 0:a.dealers)??0,t=v(`Delete “${b.group.name}”?`,`<div class="space-y-3">
      <div data-form-error></div>
      <p class="text-sm text-ink-600">${e?`Its ${e} ${e===1?"dealer moves":"dealers move"} to the default group and pay its prices from now on.`:"No dealers are in this group."} Features already bought keep their end dates.</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary px-4 py-2 text-sm" data-close>Keep it</button>
        <button type="button" class="btn-primary !bg-red-600 hover:!bg-red-700 px-4 py-2 text-sm" data-confirm>Delete group</button>
      </div>
    </div>`);i("[data-confirm]",t.body).addEventListener("click",async s=>{s.currentTarget.disabled=!0;try{await p.delete(`/admin/pricing-groups/${b.group.id}`),f("Group deleted.",C(null))}catch(r){i("[data-form-error]",t.body).innerHTML=E(y(r)),s.currentTarget.disabled=!1}})});
