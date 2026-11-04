import{a as b,e as E}from"./api-3HrlSN3j.js";import{r as O,b as U,d as j,a as V}from"./channels-CvUWVcU_.js";import{$ as i,a as d,o as h,e as c,i as f,b as $,p as z,f as J}from"./ui-DIxCFilW.js";import{i as Q}from"./searchable-select-Ci9s0_RU.js";import{s as W,i as K}from"./state-city-D2K26BbD.js";import{s as X,i as Y,r as Z,a as v,b as S}from"./widgets-DR4AA6UJ.js";import"./_commonjsHelpers-CqkleIqs.js";const G=["CUSTOMER","BUSINESS_OWNER","DEALER","ADMIN"],ee=["ACTIVE","SUSPENDED","PENDING_VERIFICATION"],te=["DRAFT","PENDING_APPROVAL","PUBLISHED","SUSPENDED"],ae={MANAGE_LISTINGS:"Manage listings",MANAGE_LEADS:"Manage leads",MANAGE_BOOKINGS:"Manage bookings"},F=t=>t.replace("_"," "),L=i("[data-error]"),D=t=>S(L,E(t));X();Y();d("[data-autosubmit-check]").forEach(t=>t.addEventListener("change",()=>t.form.submit()));function N(t,e){return t.map(a=>`<option value="${a}" ${a===e?"selected":""}>${F(a)}</option>`).join("")}function _(t){return`<div data-privileges>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Dealer privileges</label>
    <div class="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      ${Object.entries(ae).map(([e,a])=>`<label class="flex items-center gap-2 text-sm text-ink-700 cursor-pointer"><input type="checkbox" name="privileges" value="${e}" ${t.includes(e)?"checked":""} /> ${a}</label>`).join("")}
      <p class="text-xs text-ink-400 pt-1">Controls which dashboard features this dealer can access.</p>
    </div>
  </div>`}function B(t){const e=()=>{const a=t.role.value==="DEALER";i("[data-privileges]",t).hidden=!a,d("[data-when-dealer]",t).forEach(s=>s.hidden=!a),t.phone.required=a,t.email.required=!a};t.role.addEventListener("change",e),e()}async function A(t,e,a,s){const r=e.textContent;e.disabled=!0,e.textContent=a,i("[data-form-error]",t).innerHTML="";try{await s()}catch(n){i("[data-form-error]",t).innerHTML=$(E(n)),e.disabled=!1,e.textContent=r}}var R;(R=i("[data-create-user]"))==null||R.addEventListener("click",()=>{const t=h("Add a user",`<form class="space-y-3">
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
        <select class="input" name="role">${N(G,"DEALER")}</select>
        <p class="text-xs text-ink-500 mt-1">Dealers can add and manage stores on behalf of businesses.</p>
      </div>
      ${_(["MANAGE_LISTINGS"])}
      <button class="btn-primary w-full py-2.5" data-submit>Create user</button>
    </form>`),e=i("form",t.body);B(e),e.addEventListener("submit",a=>{a.preventDefault();const s=Object.fromEntries(new FormData(e)),r=new FormData(e).getAll("privileges");A(e,i("[data-submit]",e),"Creating…",async()=>{await b.post("/admin/users",{firstName:s.firstName,lastName:s.lastName,email:s.email.trim()||null,phone:s.phone.trim()||null,password:s.password,role:s.role,...s.role==="DEALER"?{privileges:r}:{}}),v(s.role==="DEALER"?`Dealer created — they sign in with ${s.phone.trim()}.`:"User created.")})})});d("[data-edit-user]").forEach(t=>t.addEventListener("click",()=>{const e=JSON.parse(t.dataset.editUser),a=h(`Edit ${e.firstName} ${e.lastName}`,`<form class="space-y-3">
        <div data-form-error></div>
        <div class="flex gap-3">
          <input class="input" name="firstName" value="${c(e.firstName)}" placeholder="First name" />
          <input class="input" name="lastName" value="${c(e.lastName)}" placeholder="Last name" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-ink-700 mb-1">Mobile number <span data-when-dealer>(login username)</span></label>
          <input class="input" type="tel" name="phone" inputmode="numeric" maxlength="14" value="${c(e.phone??"")}" placeholder="9876543210" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-ink-700 mb-1">Email <span data-when-dealer>(optional)</span></label>
          <input class="input" type="email" name="email" value="${c(e.email??"")}" placeholder="name@example.com" />
        </div>
        <div class="flex gap-3">
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Role</label>
            <select class="input" name="role">${N(G,e.role)}</select>
          </div>
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select class="input" name="status">${N(ee,e.status)}</select>
          </div>
        </div>
        ${_(e.privileges??[])}
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`),s=i("form",a.body);B(s),s.addEventListener("submit",r=>{r.preventDefault();const n=Object.fromEntries(new FormData(s)),m=new FormData(s).getAll("privileges");A(s,i("[data-submit]",s),"Saving…",async()=>{await b.patch(`/admin/users/${e.id}`,{firstName:n.firstName,lastName:n.lastName,email:n.email.trim()||null,phone:n.phone.trim()||null,role:n.role,status:n.status,...n.role==="DEALER"?{privileges:m}:{}}),v("User updated.")})})}));d("[data-reset-password]").forEach(t=>t.addEventListener("click",()=>Z(JSON.parse(t.dataset.resetPassword))));const se={ADMIN_GRANT:["Granted","bg-emerald-50 text-emerald-700"],ADMIN_DEDUCTION:["Deducted","bg-red-50 text-red-700"],BUSINESS_CREATED:["Business registered","bg-brand-50 text-brand-700"],BUSINESS_DELETED:["Business deleted (refund)","bg-gray-100 text-gray-600"],FEATURE_ADDED:["Feature added","bg-brand-50 text-brand-700"],FEATURE_REMOVED:["Feature removed (refund)","bg-gray-100 text-gray-600"],FEATURE_RENEWED:["Feature renewed","bg-amber-50 text-amber-700"]};d("[data-points]").forEach(t=>t.addEventListener("click",()=>{const e=JSON.parse(t.dataset.points);let a=e.points??0,s="grant",r=!1;const m=h(`Points — ${e.firstName} ${e.lastName}`,`<div class="space-y-4">
        <div class="rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-4 text-white">
          <p class="text-white/80 text-xs flex items-center gap-1.5">${f("coins",{size:14})} Current balance</p>
          <p class="text-3xl font-extrabold mt-0.5" data-balance></p>
          <p class="text-white/80 text-xs mt-1" data-balance-note></p>
        </div>
        <form class="space-y-3">
          <div data-form-error></div>
          <div class="flex gap-2">
            <button type="button" data-mode="grant" class="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors">${f("plus",{size:14,className:"inline -mt-0.5 mr-1"})} Add points</button>
            <button type="button" data-mode="deduct" class="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors">${f("minus",{size:14,className:"inline -mt-0.5 mr-1"})} Deduct</button>
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
      </div>`,{onClose:()=>r&&window.location.reload()}).body,p=i("form",m);function u(){i("[data-balance]",m).textContent=String(a),i("[data-balance-note]",m).textContent=`Can register ${a} more ${a===1?"business":"businesses"} (1 point each).`,d("[data-mode]",m).forEach(o=>{const l=o.dataset.mode===s;o.className=`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${l?s==="grant"?"bg-emerald-600 text-white border-emerald-600":"bg-red-600 text-white border-red-600":"border-gray-300 text-ink-600 hover:bg-gray-50"}`}),d("[data-quick]",m).forEach(o=>o.textContent=`${s==="grant"?"+":"−"}${o.dataset.quick}`),i("[data-submit]",m).textContent=`${s==="grant"?"Add":"Deduct"} ${p.amount.value||0} points`}async function g(){try{const{data:o}=await b.get(`/admin/users/${e.id}/points/transactions`,{pageSize:8});i("[data-history]",m).innerHTML=o.length?`<p class="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">Recent activity</p>
            <div class="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">${o.map(l=>{const[x,y]=se[l.type]??[l.type,"bg-gray-100 text-gray-600"];return`<div class="px-3 py-2 flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <span class="badge ${y}">${c(x)}</span>
                    ${l.note?`<p class="text-xs text-ink-500 truncate mt-1">${c(l.note)}</p>`:""}
                    <p class="text-[11px] text-ink-400">${c(J(l.createdAt))}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="font-bold text-sm ${l.amount>0?"text-emerald-700":"text-red-600"}">${l.amount>0?`+${l.amount}`:l.amount}</p>
                    <p class="text-[11px] text-ink-400">bal ${l.balanceAfter}</p>
                  </div>
                </div>`}).join("")}</div>`:""}catch{}}d("[data-mode]",m).forEach(o=>o.addEventListener("click",()=>{s=o.dataset.mode,u()})),d("[data-quick]",m).forEach(o=>o.addEventListener("click",()=>{p.amount.value=o.dataset.quick,u()})),p.amount.addEventListener("input",u),p.addEventListener("submit",async o=>{o.preventDefault();const l=Number(p.amount.value),x=i("[data-form-error]",p);if(!Number.isFinite(l)||l<=0){x.innerHTML=$("Enter a number greater than zero");return}const y=i("[data-submit]",p);y.disabled=!0,y.textContent="Saving…",x.innerHTML="";try{const{data:T}=await b.patch(`/admin/users/${e.id}/points`,{amount:s==="grant"?l:-l,note:p.note.value||void 0});a=T.points??0,r=!0,p.note.value="",g()}catch(T){x.innerHTML=$(E(T))}finally{y.disabled=!1,u()}}),u(),g()}));d("[data-business-action]").forEach(t=>t.addEventListener("click",async()=>{t.disabled=!0;try{await b.post(`/admin/businesses/${t.dataset.id}/${t.dataset.businessAction}`),window.location.reload()}catch(e){t.disabled=!1,D(e)}}));d("[data-edit-business]").forEach(t=>t.addEventListener("click",()=>{const e=JSON.parse(t.dataset.editBusiness),a=z("admin-categories")??[],s=h(`Edit ${e.name}`,`<form class="space-y-3">
        <div data-form-error></div>
        <input class="input" name="name" value="${c(e.name)}" placeholder="Business name" />
        <select class="input" name="categoryId" data-search-select data-search-placeholder="Search category…">
          <option value="">Select category</option>
          ${a.map(n=>{var m;return`<option value="${c(n.id)}" ${n.id===((m=e.category)==null?void 0:m.id)?"selected":""}>${c(n.name)}</option>`}).join("")}
        </select>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          ${W({state:e.state,city:e.city})}
        </div>
        <input class="input" name="phone" value="${c(e.phone)}" placeholder="Phone" />
        <div class="flex gap-3">
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select class="input" name="status">${N(te,e.status)}</select>
          </div>
          <label class="w-1/2 flex items-end gap-2 pb-2.5 text-sm text-ink-700">
            <input type="checkbox" name="isVerified" ${e.isVerified?"checked":""} /> Verified business
          </label>
        </div>
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`),r=i("form",s.body);K(r),Q(r),r.addEventListener("submit",n=>{n.preventDefault(),A(r,i("[data-submit]",r),"Saving…",async()=>{await b.patch(`/admin/businesses/${e.id}`,{name:r.name.value,categoryId:r.categoryId.value,city:r.city.value,state:r.state.value,phone:r.phone.value,status:r.status.value,isVerified:r.isVerified.checked}),v("Business updated.")})})}));d("[data-reassign]").forEach(t=>t.addEventListener("click",()=>{const e=JSON.parse(t.dataset.reassign),a=h(`Reassign “${e.name}”`,`<p class="text-sm text-ink-500 mb-3">Current owner: <span class="font-medium text-ink-800">${c(e.owner?`${e.owner.firstName} ${e.owner.lastName}`:"—")}</span>. Choose a new owner (business owner, dealer, or admin).</p>
      <div data-form-error></div>
      <div class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 mb-3">
        ${f("search",{size:16,className:"text-gray-400"})}
        <input data-owner-search placeholder="Search owners/dealers…" class="w-full py-2.5 text-sm focus:outline-none" />
      </div>
      <div class="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg" data-candidates></div>`),s=i("[data-candidates]",a.body),r=p=>({ADMIN:"bg-brand-50 text-brand-700",DEALER:"bg-violet-50 text-violet-700",BUSINESS_OWNER:"bg-sky-50 text-sky-700"})[p]??"bg-gray-100 text-gray-600";async function n(p){s.innerHTML=`<div class="flex items-center justify-center gap-2 py-8 text-sm text-ink-500">${f("loader-2",{size:16,className:"animate-spin"})} Searching…</div>`;try{const{data:u}=await b.get("/admin/users",{search:p||void 0}),g=u.filter(o=>{var l;return["BUSINESS_OWNER","DEALER","ADMIN"].includes(o.role)&&o.id!==((l=e.owner)==null?void 0:l.id)});s.innerHTML=g.length?g.map(o=>`<div class="p-3 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-ink-900 truncate">${c(o.firstName)} ${c(o.lastName)} <span class="badge ${r(o.role)} !px-1.5 !py-0">${F(o.role)}</span></p>
                  <p class="text-xs text-ink-500 truncate">${c(o.email??o.phone??"")}</p>
                </div>
                <button type="button" data-assign="${c(o.id)}" class="btn-primary px-3 py-1.5 text-sm shrink-0">Assign</button>
              </div>`).join(""):'<div class="p-6 text-center text-sm text-ink-500">No eligible owners found.</div>'}catch(u){s.innerHTML=$(E(u))}}let m;i("[data-owner-search]",a.body).addEventListener("input",p=>{clearTimeout(m),m=setTimeout(()=>n(p.target.value),250)}),s.addEventListener("click",async p=>{const u=p.target.closest("[data-assign]");if(u){d("[data-assign]",s).forEach(g=>g.disabled=!0),u.textContent="…";try{await b.post(`/admin/businesses/${e.id}/reassign`,{ownerId:u.dataset.assign}),v("Business reassigned.")}catch(g){i("[data-form-error]",a.body).innerHTML=$(E(g)),d("[data-assign]",s).forEach(o=>o.disabled=!1),u.textContent="Assign"}}}),n("")}));function H(t,e,a){const s=h(`${t.length} QR ${t.length===1?"board":"boards"} ready to print`,`<p class="mb-3 text-sm text-ink-600">Print these and hand them out. A shop scans one, confirms the code, and attaches it to their listing.</p>
    <div id="qr-board" class="grid grid-cols-2 gap-4"><p class="col-span-2 py-6 text-center text-sm text-ink-500">Rendering codes…</p></div>
    <button type="button" data-print class="btn-primary mt-4 w-full py-2.5">${f("printer",{size:15})} Print sheet</button>`,{onClose:a});Promise.all(t.map(r=>O(U(r),320).then(n=>({code:r,dataUrl:n})))).then(r=>{i("#qr-board",s.body).innerHTML=r.map(n=>`<div class="rounded-xl border-2 border-dashed border-gray-200 p-3 text-center">
          <p class="text-[9px] font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
          <p class="text-[11px] font-semibold text-ink-700">${c(V(e))}</p>
          <img src="${n.dataUrl}" alt="${c(n.code)}" class="mx-auto my-1.5 h-28 w-28" />
          <p class="font-mono text-xs font-bold text-ink-900">${c(n.code)}</p>
          <p class="text-[8px] uppercase tracking-wider text-ink-400">Powered by Markkito</p>
        </div>`).join("")}).catch(()=>{}),i("[data-print]",s.body).addEventListener("click",()=>window.print())}d("[data-print-codes]").forEach(t=>t.addEventListener("click",()=>H(JSON.parse(t.dataset.printCodes),t.dataset.purpose||null)));d("[data-qr-png]").forEach(t=>t.addEventListener("click",()=>O(U(t.dataset.qrPng)).then(e=>j(e,`${t.dataset.qrPng}-qr.png`)).catch(()=>S(L,"Could not generate that QR image."))));d("[data-qr-update]").forEach(t=>t.addEventListener("click",async()=>{try{await b.patch(`/admin/qr-codes/${t.dataset.qrUpdate}`,JSON.parse(t.dataset.payload)),v(t.dataset.message)}catch(e){D(e)}}));var I;(I=i("[data-generate-boards]"))==null||I.addEventListener("click",()=>{const t=h("Generate QR boards",`<form class="space-y-3">
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
    </form>`),e=i("form",t.body),a=i("[data-submit]",e);e.count.addEventListener("input",()=>a.textContent=`Generate ${e.count.value||0} boards`),e.addEventListener("submit",s=>{s.preventDefault(),A(e,a,"Generating…",async()=>{const{data:r}=await b.post("/admin/qr-codes/batch",{count:Number(e.count.value),batchLabel:e.batchLabel.value||void 0});t.close(),H(r.codes,null,()=>v(`Generated ${r.created} new QR boards.`))})})});function ne(t){const e=Math.max(0,Math.floor((Date.now()-new Date(t).getTime())/1e3));if(e<60)return`${e}s ago`;const a=Math.floor(e/60);return a<60?`${a}m ago`:`${Math.floor(a/60)}h ago`}const C=(t=document)=>d("[data-time-ago]",t).forEach(e=>e.textContent=ne(e.dataset.timeAgo)),w=i("[data-online-list]");w&&(C(w),setInterval(async()=>{try{const t=await fetch("/admin/online",{headers:{Accept:"text/html"},credentials:"same-origin"});if(!t.ok)return;w.innerHTML=await t.text(),i("[data-online-count]").textContent=`${t.headers.get("X-Online-Count")??0} active`,C(w)}catch{}},15e3));async function M(t,e,a,s){S(L,"");const r=t.innerHTML;t.disabled=!0,t.textContent=e;try{const{data:n}=await a();v(s(n))}catch(n){D(n),t.disabled=!1,t.innerHTML=r}}var P;(P=i("[data-seo-run]"))==null||P.addEventListener("click",t=>M(t.currentTarget,"Syncing…",()=>b.post("/admin/seo/run"),e=>e.configured?`Synced with Google: ${e.submitted} submitted, ${e.checked} checked${e.failed?`, ${e.failed} failed`:""}.`:`Google is not connected — ${e.tracked} new page(s) tracked, nothing submitted.`));d("[data-seo-check]").forEach(t=>t.addEventListener("click",()=>M(t,"Checking…",()=>b.post(`/admin/seo/pages/${t.dataset.seoCheck}/check`),e=>e.indexStatus==="INDEXED"?"The page is on Google.":`Not on Google yet: ${e.coverageState??"no details"}.`)));d("[data-seo-submit]").forEach(t=>t.addEventListener("click",()=>M(t,"Sending…",()=>b.post(`/admin/seo/pages/${t.dataset.seoSubmit}/submit`),()=>"Sent to Google — it usually crawls within a day or two.")));d("[data-plan]").forEach(t=>{const e=i('[name="months"]',t);e.addEventListener("change",()=>d('[data-renewal-field="1"]',t).forEach(a=>a.disabled=e.value===""))});const k=(t,e)=>{const a=i(`[name="${e}"]`,t).value;return a===""?null:Number(a)};var q;(q=i("[data-feature-plans]"))==null||q.addEventListener("submit",async t=>{t.preventDefault();const e=t.currentTarget,a=i("[data-plans-saved]",e),s=i('button[type="submit"]',e),r=d("[data-plan]",e).map(n=>({feature:n.dataset.plan,points:Number(i('[name="points"]',n).value),renewalPoints:Number(i('[name="renewalPoints"]',n).value),price:k(n,"price"),commission:k(n,"commission"),renewalPrice:k(n,"renewalPrice"),renewalCommission:k(n,"renewalCommission"),months:i('[name="months"]',n).value===""?null:Number(i('[name="months"]',n).value)}));S(L,""),a.textContent="",s.disabled=!0;try{await b.put("/admin/feature-plans",{plans:r}),a.textContent="Pricing saved."}catch(n){D(n)}finally{s.disabled=!1}});
