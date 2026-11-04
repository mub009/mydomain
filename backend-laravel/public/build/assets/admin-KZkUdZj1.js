import{a as b,e as h}from"./api-3HrlSN3j.js";import{r as V,b as z,d as Z,a as ee}from"./channels-CvUWVcU_.js";import{$ as i,a as c,o as x,e as l,i as w,b as y,p as R,f as te}from"./ui-DIxCFilW.js";import{i as ae}from"./searchable-select-Ci9s0_RU.js";import{s as se,i as ne}from"./state-city-D2K26BbD.js";import{s as ie,i as re,r as de,a as f,b as A}from"./widgets-DR4AA6UJ.js";import"./_commonjsHelpers-CqkleIqs.js";const J=["CUSTOMER","BUSINESS_OWNER","DEALER","ADMIN"],oe=["ACTIVE","SUSPENDED","PENDING_VERIFICATION"],le=["DRAFT","PENDING_APPROVAL","PUBLISHED","SUSPENDED"],ce={MANAGE_LISTINGS:"Manage listings",MANAGE_LEADS:"Manage leads",MANAGE_BOOKINGS:"Manage bookings"},W=e=>e.replace("_"," "),M=i("[data-error]"),L=e=>A(M,h(e));ie();re();c("[data-autosubmit-check]").forEach(e=>e.addEventListener("change",()=>e.form.submit()));function T(e,t){return e.map(a=>`<option value="${a}" ${a===t?"selected":""}>${W(a)}</option>`).join("")}function Q(e){return`<div data-privileges>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Dealer privileges</label>
    <div class="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      ${Object.entries(ce).map(([t,a])=>`<label class="flex items-center gap-2 text-sm text-ink-700 cursor-pointer"><input type="checkbox" name="privileges" value="${t}" ${e.includes(t)?"checked":""} /> ${a}</label>`).join("")}
      <p class="text-xs text-ink-400 pt-1">Controls which dashboard features this dealer can access.</p>
    </div>
  </div>`}function me(e){const t=R("admin-pricing-groups")??[];return t.length?`<div data-when-dealer>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Pricing group</label>
    <select class="input" name="pricingGroupId">
      ${t.map(a=>{const n=a.isDefault?"":a.id,d=e?e===a.id:a.isDefault;return`<option value="${l(n)}" ${d?"selected":""}>${l(a.name)}${a.isDefault?" (default)":""}</option>`}).join("")}
    </select>
    <p class="text-xs text-ink-500 mt-1">The feature prices this dealer pays. Set them in Feature Pricing.</p>
  </div>`:""}function K(e){const t=()=>{const a=e.role.value==="DEALER";i("[data-privileges]",e).hidden=!a,c("[data-when-dealer]",e).forEach(n=>n.hidden=!a),e.phone.required=a,e.email.required=!a};e.role.addEventListener("change",t),t()}async function N(e,t,a,n){const d=t.textContent;t.disabled=!0,t.textContent=a,i("[data-form-error]",e).innerHTML="";try{await n()}catch(s){i("[data-form-error]",e).innerHTML=y(h(s)),t.disabled=!1,t.textContent=d}}var O;(O=i("[data-create-user]"))==null||O.addEventListener("click",()=>{const e=x("Add a user",`<form class="space-y-3">
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
        <select class="input" name="role">${T(J,"DEALER")}</select>
        <p class="text-xs text-ink-500 mt-1">Dealers can add and manage stores on behalf of businesses.</p>
      </div>
      ${Q(["MANAGE_LISTINGS"])}
      <button class="btn-primary w-full py-2.5" data-submit>Create user</button>
    </form>`),t=i("form",e.body);K(t),t.addEventListener("submit",a=>{a.preventDefault();const n=Object.fromEntries(new FormData(t)),d=new FormData(t).getAll("privileges");N(t,i("[data-submit]",t),"Creating…",async()=>{await b.post("/admin/users",{firstName:n.firstName,lastName:n.lastName,email:n.email.trim()||null,phone:n.phone.trim()||null,password:n.password,role:n.role,...n.role==="DEALER"?{privileges:d}:{}}),f(n.role==="DEALER"?`Dealer created — they sign in with ${n.phone.trim()}.`:"User created.")})})});c("[data-edit-user]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.editUser),a=x(`Edit ${t.firstName} ${t.lastName}`,`<form class="space-y-3">
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
            <select class="input" name="role">${T(J,t.role)}</select>
          </div>
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select class="input" name="status">${T(oe,t.status)}</select>
          </div>
        </div>
        ${Q(t.privileges??[])}
        ${me(t.pricingGroupId??null)}
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`),n=i("form",a.body);K(n),n.addEventListener("submit",d=>{d.preventDefault();const s=Object.fromEntries(new FormData(n)),m=new FormData(n).getAll("privileges");N(n,i("[data-submit]",n),"Saving…",async()=>{await b.patch(`/admin/users/${t.id}`,{firstName:s.firstName,lastName:s.lastName,email:s.email.trim()||null,phone:s.phone.trim()||null,role:s.role,status:s.status,...s.role==="DEALER"?{privileges:m,pricingGroupId:s.pricingGroupId||null}:{}}),f("User updated.")})})}));c("[data-reset-password]").forEach(e=>e.addEventListener("click",()=>de(JSON.parse(e.dataset.resetPassword))));const pe={ADMIN_GRANT:["Granted","bg-emerald-50 text-emerald-700"],ADMIN_DEDUCTION:["Deducted","bg-red-50 text-red-700"],BUSINESS_CREATED:["Business registered","bg-brand-50 text-brand-700"],BUSINESS_DELETED:["Business deleted (refund)","bg-gray-100 text-gray-600"],FEATURE_ADDED:["Feature added","bg-brand-50 text-brand-700"],FEATURE_REMOVED:["Feature removed (refund)","bg-gray-100 text-gray-600"],FEATURE_RENEWED:["Feature renewed","bg-amber-50 text-amber-700"]};c("[data-points]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.points);let a=t.points??0,n="grant",d=!1;const m=x(`Points — ${t.firstName} ${t.lastName}`,`<div class="space-y-4">
        <div class="rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-4 text-white">
          <p class="text-white/80 text-xs flex items-center gap-1.5">${w("coins",{size:14})} Current balance</p>
          <p class="text-3xl font-extrabold mt-0.5" data-balance></p>
          <p class="text-white/80 text-xs mt-1" data-balance-note></p>
        </div>
        <form class="space-y-3">
          <div data-form-error></div>
          <div class="flex gap-2">
            <button type="button" data-mode="grant" class="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors">${w("plus",{size:14,className:"inline -mt-0.5 mr-1"})} Add points</button>
            <button type="button" data-mode="deduct" class="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors">${w("minus",{size:14,className:"inline -mt-0.5 mr-1"})} Deduct</button>
          </div>
          <div>
            <label class="block text-xs font-semibold text-ink-700 mb-1">Amount</label>
            <input required type="number" min="1" class="input" name="amount" value="10" />
            <div class="flex gap-2 mt-2">${[5,10,25,50].map(r=>`<button type="button" data-quick="${r}" class="badge bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700"></button>`).join("")}</div>
          </div>
          <input class="input" name="note" placeholder="Note (optional, e.g. payment received)" />
          <button class="btn-primary w-full py-2.5" data-submit></button>
        </form>
        <div data-history></div>
      </div>`,{onClose:()=>d&&window.location.reload()}).body,u=i("form",m);function g(){i("[data-balance]",m).textContent=String(a),i("[data-balance-note]",m).textContent=`Can register ${a} more ${a===1?"business":"businesses"} (1 point each).`,c("[data-mode]",m).forEach(r=>{const o=r.dataset.mode===n;r.className=`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${o?n==="grant"?"bg-emerald-600 text-white border-emerald-600":"bg-red-600 text-white border-red-600":"border-gray-300 text-ink-600 hover:bg-gray-50"}`}),c("[data-quick]",m).forEach(r=>r.textContent=`${n==="grant"?"+":"−"}${r.dataset.quick}`),i("[data-submit]",m).textContent=`${n==="grant"?"Add":"Deduct"} ${u.amount.value||0} points`}async function p(){try{const{data:r}=await b.get(`/admin/users/${t.id}/points/transactions`,{pageSize:8});i("[data-history]",m).innerHTML=r.length?`<p class="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">Recent activity</p>
            <div class="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">${r.map(o=>{const[E,k]=pe[o.type]??[o.type,"bg-gray-100 text-gray-600"];return`<div class="px-3 py-2 flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <span class="badge ${k}">${l(E)}</span>
                    ${o.note?`<p class="text-xs text-ink-500 truncate mt-1">${l(o.note)}</p>`:""}
                    <p class="text-[11px] text-ink-400">${l(te(o.createdAt))}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="font-bold text-sm ${o.amount>0?"text-emerald-700":"text-red-600"}">${o.amount>0?`+${o.amount}`:o.amount}</p>
                    <p class="text-[11px] text-ink-400">bal ${o.balanceAfter}</p>
                  </div>
                </div>`}).join("")}</div>`:""}catch{}}c("[data-mode]",m).forEach(r=>r.addEventListener("click",()=>{n=r.dataset.mode,g()})),c("[data-quick]",m).forEach(r=>r.addEventListener("click",()=>{u.amount.value=r.dataset.quick,g()})),u.amount.addEventListener("input",g),u.addEventListener("submit",async r=>{r.preventDefault();const o=Number(u.amount.value),E=i("[data-form-error]",u);if(!Number.isFinite(o)||o<=0){E.innerHTML=y("Enter a number greater than zero");return}const k=i("[data-submit]",u);k.disabled=!0,k.textContent="Saving…",E.innerHTML="";try{const{data:I}=await b.patch(`/admin/users/${t.id}/points`,{amount:n==="grant"?o:-o,note:u.note.value||void 0});a=I.points??0,d=!0,u.note.value="",p()}catch(I){E.innerHTML=y(h(I))}finally{k.disabled=!1,g()}}),g(),p()}));c("[data-business-action]").forEach(e=>e.addEventListener("click",async()=>{e.disabled=!0;try{await b.post(`/admin/businesses/${e.dataset.id}/${e.dataset.businessAction}`),window.location.reload()}catch(t){e.disabled=!1,L(t)}}));c("[data-edit-business]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.editBusiness),a=R("admin-categories")??[],n=x(`Edit ${t.name}`,`<form class="space-y-3">
        <div data-form-error></div>
        <input class="input" name="name" value="${l(t.name)}" placeholder="Business name" />
        <select class="input" name="categoryId" data-search-select data-search-placeholder="Search category…">
          <option value="">Select category</option>
          ${a.map(s=>{var m;return`<option value="${l(s.id)}" ${s.id===((m=t.category)==null?void 0:m.id)?"selected":""}>${l(s.name)}</option>`}).join("")}
        </select>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          ${se({state:t.state,city:t.city})}
        </div>
        <input class="input" name="phone" value="${l(t.phone)}" placeholder="Phone" />
        <div class="flex gap-3">
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select class="input" name="status">${T(le,t.status)}</select>
          </div>
          <label class="w-1/2 flex items-end gap-2 pb-2.5 text-sm text-ink-700">
            <input type="checkbox" name="isVerified" ${t.isVerified?"checked":""} /> Verified business
          </label>
        </div>
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`),d=i("form",n.body);ne(d),ae(d),d.addEventListener("submit",s=>{s.preventDefault(),N(d,i("[data-submit]",d),"Saving…",async()=>{await b.patch(`/admin/businesses/${t.id}`,{name:d.name.value,categoryId:d.categoryId.value,city:d.city.value,state:d.state.value,phone:d.phone.value,status:d.status.value,isVerified:d.isVerified.checked}),f("Business updated.")})})}));c("[data-reassign]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.reassign),a=x(`Reassign “${t.name}”`,`<p class="text-sm text-ink-500 mb-3">Current owner: <span class="font-medium text-ink-800">${l(t.owner?`${t.owner.firstName} ${t.owner.lastName}`:"—")}</span>. Choose a new owner (business owner, dealer, or admin).</p>
      <div data-form-error></div>
      <div class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 mb-3">
        ${w("search",{size:16,className:"text-gray-400"})}
        <input data-owner-search placeholder="Search owners/dealers…" class="w-full py-2.5 text-sm focus:outline-none" />
      </div>
      <div class="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg" data-candidates></div>`),n=i("[data-candidates]",a.body),d=u=>({ADMIN:"bg-brand-50 text-brand-700",DEALER:"bg-violet-50 text-violet-700",BUSINESS_OWNER:"bg-sky-50 text-sky-700"})[u]??"bg-gray-100 text-gray-600";async function s(u){n.innerHTML=`<div class="flex items-center justify-center gap-2 py-8 text-sm text-ink-500">${w("loader-2",{size:16,className:"animate-spin"})} Searching…</div>`;try{const{data:g}=await b.get("/admin/users",{search:u||void 0}),p=g.filter(r=>{var o;return["BUSINESS_OWNER","DEALER","ADMIN"].includes(r.role)&&r.id!==((o=t.owner)==null?void 0:o.id)});n.innerHTML=p.length?p.map(r=>`<div class="p-3 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-ink-900 truncate">${l(r.firstName)} ${l(r.lastName)} <span class="badge ${d(r.role)} !px-1.5 !py-0">${W(r.role)}</span></p>
                  <p class="text-xs text-ink-500 truncate">${l(r.email??r.phone??"")}</p>
                </div>
                <button type="button" data-assign="${l(r.id)}" class="btn-primary px-3 py-1.5 text-sm shrink-0">Assign</button>
              </div>`).join(""):'<div class="p-6 text-center text-sm text-ink-500">No eligible owners found.</div>'}catch(g){n.innerHTML=y(h(g))}}let m;i("[data-owner-search]",a.body).addEventListener("input",u=>{clearTimeout(m),m=setTimeout(()=>s(u.target.value),250)}),n.addEventListener("click",async u=>{const g=u.target.closest("[data-assign]");if(g){c("[data-assign]",n).forEach(p=>p.disabled=!0),g.textContent="…";try{await b.post(`/admin/businesses/${t.id}/reassign`,{ownerId:g.dataset.assign}),f("Business reassigned.")}catch(p){i("[data-form-error]",a.body).innerHTML=y(h(p)),c("[data-assign]",n).forEach(r=>r.disabled=!1),g.textContent="Assign"}}}),s("")}));function X(e,t,a){const n=x(`${e.length} QR ${e.length===1?"board":"boards"} ready to print`,`<p class="mb-3 text-sm text-ink-600">Print these and hand them out. A shop scans one, confirms the code, and attaches it to their listing.</p>
    <div id="qr-board" class="grid grid-cols-2 gap-4"><p class="col-span-2 py-6 text-center text-sm text-ink-500">Rendering codes…</p></div>
    <button type="button" data-print class="btn-primary mt-4 w-full py-2.5">${w("printer",{size:15})} Print sheet</button>`,{onClose:a});Promise.all(e.map(d=>V(z(d),320).then(s=>({code:d,dataUrl:s})))).then(d=>{i("#qr-board",n.body).innerHTML=d.map(s=>`<div class="rounded-xl border-2 border-dashed border-gray-200 p-3 text-center">
          <p class="text-[9px] font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
          <p class="text-[11px] font-semibold text-ink-700">${l(ee(t))}</p>
          <img src="${s.dataUrl}" alt="${l(s.code)}" class="mx-auto my-1.5 h-28 w-28" />
          <p class="font-mono text-xs font-bold text-ink-900">${l(s.code)}</p>
          <p class="text-[8px] uppercase tracking-wider text-ink-400">Powered by Markkito</p>
        </div>`).join("")}).catch(()=>{}),i("[data-print]",n.body).addEventListener("click",()=>window.print())}c("[data-print-codes]").forEach(e=>e.addEventListener("click",()=>X(JSON.parse(e.dataset.printCodes),e.dataset.purpose||null)));c("[data-qr-png]").forEach(e=>e.addEventListener("click",()=>V(z(e.dataset.qrPng)).then(t=>Z(t,`${e.dataset.qrPng}-qr.png`)).catch(()=>A(M,"Could not generate that QR image."))));c("[data-qr-update]").forEach(e=>e.addEventListener("click",async()=>{try{await b.patch(`/admin/qr-codes/${e.dataset.qrUpdate}`,JSON.parse(e.dataset.payload)),f(e.dataset.message)}catch(t){L(t)}}));var U;(U=i("[data-generate-boards]"))==null||U.addEventListener("click",()=>{const e=x("Generate QR boards",`<form class="space-y-3">
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
    </form>`),t=i("form",e.body),a=i("[data-submit]",t);t.count.addEventListener("input",()=>a.textContent=`Generate ${t.count.value||0} boards`),t.addEventListener("submit",n=>{n.preventDefault(),N(t,a,"Generating…",async()=>{const{data:d}=await b.post("/admin/qr-codes/batch",{count:Number(t.count.value),batchLabel:t.batchLabel.value||void 0});e.close(),X(d.codes,null,()=>f(`Generated ${d.created} new QR boards.`))})})});function ue(e){const t=Math.max(0,Math.floor((Date.now()-new Date(e).getTime())/1e3));if(t<60)return`${t}s ago`;const a=Math.floor(t/60);return a<60?`${a}m ago`:`${Math.floor(a/60)}h ago`}const G=(e=document)=>c("[data-time-ago]",e).forEach(t=>t.textContent=ue(t.dataset.timeAgo)),S=i("[data-online-list]");S&&(G(S),setInterval(async()=>{try{const e=await fetch("/admin/online",{headers:{Accept:"text/html"},credentials:"same-origin"});if(!e.ok)return;S.innerHTML=await e.text(),i("[data-online-count]").textContent=`${e.headers.get("X-Online-Count")??0} active`,G(S)}catch{}},15e3));async function P(e,t,a,n){A(M,"");const d=e.innerHTML;e.disabled=!0,e.textContent=t;try{const{data:s}=await a();f(n(s))}catch(s){L(s),e.disabled=!1,e.innerHTML=d}}var F;(F=i("[data-seo-run]"))==null||F.addEventListener("click",e=>P(e.currentTarget,"Syncing…",()=>b.post("/admin/seo/run"),t=>t.configured?`Synced with Google: ${t.submitted} submitted, ${t.checked} checked${t.failed?`, ${t.failed} failed`:""}.`:`Google is not connected — ${t.tracked} new page(s) tracked, nothing submitted.`));c("[data-seo-check]").forEach(e=>e.addEventListener("click",()=>P(e,"Checking…",()=>b.post(`/admin/seo/pages/${e.dataset.seoCheck}/check`),t=>t.indexStatus==="INDEXED"?"The page is on Google.":`Not on Google yet: ${t.coverageState??"no details"}.`)));c("[data-seo-submit]").forEach(e=>e.addEventListener("click",()=>P(e,"Sending…",()=>b.post(`/admin/seo/pages/${e.dataset.seoSubmit}/submit`),()=>"Sent to Google — it usually crawls within a day or two.")));c("[data-plan]").forEach(e=>{const t=i('[name="months"]',e);t.addEventListener("change",()=>c('[data-renewal-field="1"]',e).forEach(a=>a.disabled=t.value===""))});const D=(e,t)=>{const a=i(`[name="${t}"]`,e).value;return a===""?null:Number(a)};var H;(H=i("[data-feature-plans]"))==null||H.addEventListener("submit",async e=>{e.preventDefault();const t=e.currentTarget,a=i("[data-plans-saved]",t),n=i('button[type="submit"]',t),d=c("[data-plan]",t).map(s=>({feature:s.dataset.plan,points:Number(i('[name="points"]',s).value),renewalPoints:Number(i('[name="renewalPoints"]',s).value),price:D(s,"price"),commission:D(s,"commission"),renewalPrice:D(s,"renewalPrice"),renewalCommission:D(s,"renewalCommission"),months:i('[name="months"]',s).value===""?null:Number(i('[name="months"]',s).value)}));A(M,""),a.textContent="",n.disabled=!0;try{await b.put("/admin/feature-plans",{groupId:t.dataset.groupId,plans:d}),a.textContent="Pricing saved."}catch(s){L(s)}finally{n.disabled=!1}});const v=R("pricing-group-data"),C=e=>`/admin?tab=${encodeURIComponent("Feature Pricing")}${e?`&group=${e}`:""}`;function Y(e,t,a,n){const d=x(e,`<form class="space-y-3">
      <div data-form-error></div>
      <input required maxlength="80" class="input" name="name" value="${l(t)}" placeholder="e.g. Gold dealers" />
      <button class="btn-primary w-full py-2.5" data-submit>${l(a)}</button>
    </form>`),s=i("form",d.body);s.name.focus(),s.addEventListener("submit",m=>{m.preventDefault(),N(s,i("[data-submit]",s),"Saving…",()=>n(s.name.value.trim()))})}var q;(q=i("[data-group-new]"))==null||q.addEventListener("click",()=>Y("New pricing group","","Create group",async e=>{var a,n;const{data:t}=await b.post("/admin/pricing-groups",{name:e,copyFrom:(a=v==null?void 0:v.group)==null?void 0:a.id});f(`Created “${e}” with ${((n=v==null?void 0:v.group)==null?void 0:n.name)??"the default"} prices. Change them below, then put dealers in it from Users.`,C(t.id))}));var _;(_=i("[data-group-rename]"))==null||_.addEventListener("click",()=>Y("Rename pricing group",v.group.name,"Save name",async e=>{await b.patch(`/admin/pricing-groups/${v.group.id}`,{name:e}),f("Group renamed.",C(v.group.id))}));var B;(B=i("[data-group-default]"))==null||B.addEventListener("click",async e=>{const t=e.currentTarget;t.disabled=!0;try{await b.patch(`/admin/pricing-groups/${v.group.id}`,{isDefault:!0}),f(`“${v.group.name}” is now the default: dealers in no group pay its prices.`,C(v.group.id))}catch(a){L(a),t.disabled=!1}});var j;(j=i("[data-group-delete]"))==null||j.addEventListener("click",()=>{var a;const e=((a=v.groups.find(n=>n.id===v.group.id))==null?void 0:a.dealers)??0,t=x(`Delete “${v.group.name}”?`,`<div class="space-y-3">
      <div data-form-error></div>
      <p class="text-sm text-ink-600">${e?`Its ${e} ${e===1?"dealer moves":"dealers move"} to the default group and pay its prices from now on.`:"No dealers are in this group."} Features already bought keep their end dates.</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary px-4 py-2 text-sm" data-close>Keep it</button>
        <button type="button" class="btn-primary !bg-red-600 hover:!bg-red-700 px-4 py-2 text-sm" data-confirm>Delete group</button>
      </div>
    </div>`);i("[data-confirm]",t.body).addEventListener("click",async n=>{n.currentTarget.disabled=!0;try{await b.delete(`/admin/pricing-groups/${v.group.id}`),f("Group deleted.",C(null))}catch(d){i("[data-form-error]",t.body).innerHTML=y(h(d)),n.currentTarget.disabled=!1}})});const $=e=>e==null?"—":`${e<0?"−":""}₹${Math.abs(e).toLocaleString("en-IN")}`;c("[data-commission]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.commission),a=new Date().toISOString().slice(0,10),d=x(`Commission — ${t.firstName} ${t.lastName}`,`<div class="space-y-4">
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4" data-summary></div>
        <form class="space-y-2 rounded-xl border border-gray-200 p-3" data-pay>
          <div data-form-error></div>
          <p class="text-sm font-semibold text-ink-900">Record a payment received</p>
          <div class="flex flex-wrap gap-2">
            <div class="relative w-36"><span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">₹</span>
              <input required type="number" min="1" step="1" class="input pl-7" name="amount" placeholder="Amount" /></div>
            <input type="date" class="input w-40" name="paidOn" value="${a}" max="${a}" />
            <input class="input min-w-0 flex-1" name="note" maxlength="300" placeholder="Note (optional, e.g. UPI ref)" />
          </div>
          <div class="flex items-center justify-between gap-2">
            <button type="button" class="text-xs font-semibold text-brand-700 hover:underline" data-pay-all>Fill in the full amount due</button>
            <button class="btn-primary px-4 py-2 text-sm" data-submit>Record payment</button>
          </div>
        </form>
        <div data-payments></div>
        <div data-sales></div>
      </div>`,{wide:!0}).body,s=i("[data-pay]",d);let m=0;const u=(p,r,o="text-ink-900")=>`<div class="rounded-lg bg-gray-50 px-3 py-2"><p class="text-[10px] font-semibold uppercase tracking-wide text-ink-500">${p}</p><p class="text-lg font-bold tabular-nums ${o}">${r}</p></div>`;async function g(){try{const{data:p}=await b.get(`/admin/users/${t.id}/commission`,{pageSize:10}),r=p.summary;m=r.due,i("[data-summary]",d).innerHTML=u("Collected",$(r.collected))+u("Commission",$(r.commission))+u("Paid",$(r.paid),"text-emerald-700")+u("Due",$(r.due),r.due>0?"text-amber-700":"text-ink-900"),i("[data-payments]",d).innerHTML=p.payments.length?`<p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Payments received</p>
            <div class="max-h-52 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">${p.payments.map(o=>`<div class="flex items-center justify-between gap-2 px-3 py-2">
                  <div class="min-w-0"><p class="text-sm font-semibold text-emerald-700">${$(o.amount)}</p>
                    <p class="truncate text-[11px] text-ink-500">${l(o.paidOn)}${o.note?` · ${l(o.note)}`:""}${o.receivedBy?` · by ${l(o.receivedBy)}`:""}</p></div>
                  <button type="button" class="shrink-0 text-xs font-semibold text-red-700 hover:underline" data-remove="${l(o.id)}">Remove</button>
                </div>`).join("")}</div>`:'<p class="text-sm text-ink-500">No payments recorded yet.</p>',i("[data-sales]",d).innerHTML=p.sales.length?`<p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Latest sales and renewals</p>
            <div class="max-h-52 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">${p.sales.map(o=>`<div class="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span class="min-w-0 truncate">${l(o.business??"Deleted business")} · ${l(o.featureLabel??"All features")}${o.type==="FEATURE_RENEWED"?" (renewal)":["FEATURE_REMOVED","BUSINESS_DELETED"].includes(o.type)?" (refund)":""}</span>
                  <span class="shrink-0 tabular-nums text-ink-500">${$(o.price)} · <b class="text-ink-900">${$(o.commission)}</b></span>
                </div>`).join("")}</div>`:""}catch(p){i("[data-summary]",d).innerHTML=y(h(p))}}i("[data-pay-all]",s).addEventListener("click",()=>s.amount.value=m>0?m:""),s.addEventListener("submit",async p=>{p.preventDefault();const r=i("[data-form-error]",s),o=i("[data-submit]",s);r.innerHTML="",o.disabled=!0;try{await b.post(`/admin/users/${t.id}/commission-payments`,{amount:Number(s.amount.value),paidOn:s.paidOn.value||void 0,note:s.note.value.trim()||void 0}),s.amount.value="",s.note.value="",await g()}catch(E){r.innerHTML=y(h(E))}finally{o.disabled=!1}}),i("[data-payments]",d).addEventListener("click",async p=>{const r=p.target.closest("[data-remove]");if(r){if(r.dataset.armed!=="1"){r.dataset.armed="1",r.textContent="Tap again to remove";return}r.disabled=!0;try{await b.delete(`/admin/commission-payments/${r.dataset.remove}`),await g()}catch(o){i("[data-form-error]",s).innerHTML=y(h(o)),r.disabled=!1}}}),g()}));
