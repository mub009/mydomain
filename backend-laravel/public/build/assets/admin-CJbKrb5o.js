import{a as b,e as y}from"./api-B_riRJ0q.js";import{i as Z}from"./commission-charts-CadtPEUw.js";import{r as V,b as z,d as ee,a as te}from"./channels-CvUWVcU_.js";import{$ as i,a as m,o as h,e as l,i as k,b as E,p as R,f as ae}from"./ui-BdSpcnW7.js";import{i as se}from"./searchable-select-DGJiky5z.js";import{s as ne,i as ie}from"./state-city-C9nNh1Xh.js";import{s as re,i as de,r as oe,a as x,b as A}from"./widgets-BKox7ttS.js";import"./_commonjsHelpers-CqkleIqs.js";const J=["CUSTOMER","BUSINESS_OWNER","DEALER","ADMIN"],le=["ACTIVE","SUSPENDED","PENDING_VERIFICATION"],ce=["DRAFT","PENDING_APPROVAL","PUBLISHED","SUSPENDED"],me={MANAGE_LISTINGS:"Manage listings",MANAGE_LEADS:"Manage leads",MANAGE_BOOKINGS:"Manage bookings"},W=e=>e.replace("_"," "),M=i("[data-error]"),L=e=>A(M,y(e));re();de();m("[data-autosubmit-check]").forEach(e=>e.addEventListener("change",()=>e.form.submit()));function T(e,t){return e.map(a=>`<option value="${a}" ${a===t?"selected":""}>${W(a)}</option>`).join("")}function Q(e){return`<div data-privileges>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Dealer privileges</label>
    <div class="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      ${Object.entries(me).map(([t,a])=>`<label class="flex items-center gap-2 text-sm text-ink-700 cursor-pointer"><input type="checkbox" name="privileges" value="${t}" ${e.includes(t)?"checked":""} /> ${a}</label>`).join("")}
      <p class="text-xs text-ink-400 pt-1">Controls which dashboard features this dealer can access.</p>
    </div>
  </div>`}function pe(e){const t=R("admin-pricing-groups")??[];return t.length?`<div data-when-dealer>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Pricing group</label>
    <select class="input" name="pricingGroupId">
      ${t.map(a=>{const n=a.isDefault?"":a.id,r=e?e===a.id:a.isDefault;return`<option value="${l(n)}" ${r?"selected":""}>${l(a.name)}${a.isDefault?" (default)":""}</option>`}).join("")}
    </select>
    <p class="text-xs text-ink-500 mt-1">The feature prices this dealer pays. Set them in Feature Pricing.</p>
  </div>`:""}function K(e){const t=()=>{const a=e.role.value==="DEALER";i("[data-privileges]",e).hidden=!a,m("[data-when-dealer]",e).forEach(n=>n.hidden=!a),e.phone.required=a,e.email.required=!a};e.role.addEventListener("change",t),t()}async function N(e,t,a,n){const r=t.textContent;t.disabled=!0,t.textContent=a,i("[data-form-error]",e).innerHTML="";try{await n()}catch(s){i("[data-form-error]",e).innerHTML=E(y(s)),t.disabled=!1,t.textContent=r}}var O;(O=i("[data-create-user]"))==null||O.addEventListener("click",()=>{const e=h("Add a user",`<form class="space-y-3">
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
    </form>`),t=i("form",e.body);K(t),t.addEventListener("submit",a=>{a.preventDefault();const n=Object.fromEntries(new FormData(t)),r=new FormData(t).getAll("privileges");N(t,i("[data-submit]",t),"Creating…",async()=>{await b.post("/admin/users",{firstName:n.firstName,lastName:n.lastName,email:n.email.trim()||null,phone:n.phone.trim()||null,password:n.password,role:n.role,...n.role==="DEALER"?{privileges:r}:{}}),x(n.role==="DEALER"?`Dealer created — they sign in with ${n.phone.trim()}.`:"User created.")})})});m("[data-edit-user]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.editUser),a=h(`Edit ${t.firstName} ${t.lastName}`,`<form class="space-y-3">
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
            <select class="input" name="status">${T(le,t.status)}</select>
          </div>
        </div>
        ${Q(t.privileges??[])}
        ${pe(t.pricingGroupId??null)}
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`),n=i("form",a.body);K(n),n.addEventListener("submit",r=>{r.preventDefault();const s=Object.fromEntries(new FormData(n)),p=new FormData(n).getAll("privileges");N(n,i("[data-submit]",n),"Saving…",async()=>{await b.patch(`/admin/users/${t.id}`,{firstName:s.firstName,lastName:s.lastName,email:s.email.trim()||null,phone:s.phone.trim()||null,role:s.role,status:s.status,...s.role==="DEALER"?{privileges:p,pricingGroupId:s.pricingGroupId||null}:{}}),x("User updated.")})})}));m("[data-reset-password]").forEach(e=>e.addEventListener("click",()=>oe(JSON.parse(e.dataset.resetPassword))));const ue={ADMIN_GRANT:["Granted","bg-emerald-50 text-emerald-700"],ADMIN_DEDUCTION:["Deducted","bg-red-50 text-red-700"],BUSINESS_CREATED:["Business registered","bg-brand-50 text-brand-700"],BUSINESS_DELETED:["Business deleted (refund)","bg-gray-100 text-gray-600"],FEATURE_ADDED:["Feature added","bg-brand-50 text-brand-700"],FEATURE_REMOVED:["Feature removed (refund)","bg-gray-100 text-gray-600"],FEATURE_RENEWED:["Feature renewed","bg-amber-50 text-amber-700"]};m("[data-points]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.points);let a=t.points??0,n="grant",r=!1;const p=h(`Points — ${t.firstName} ${t.lastName}`,`<div class="space-y-4">
        <div class="rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-4 text-white">
          <p class="text-white/80 text-xs flex items-center gap-1.5">${k("coins",{size:14})} Current balance</p>
          <p class="text-3xl font-extrabold mt-0.5" data-balance></p>
          <p class="text-white/80 text-xs mt-1" data-balance-note></p>
        </div>
        <form class="space-y-3">
          <div data-form-error></div>
          <div class="flex gap-2">
            <button type="button" data-mode="grant" class="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors">${k("plus",{size:14,className:"inline -mt-0.5 mr-1"})} Add points</button>
            <button type="button" data-mode="deduct" class="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors">${k("minus",{size:14,className:"inline -mt-0.5 mr-1"})} Deduct</button>
          </div>
          <div>
            <label class="block text-xs font-semibold text-ink-700 mb-1">Amount</label>
            <input required type="number" min="1" class="input" name="amount" value="10" />
            <div class="flex gap-2 mt-2">${[5,10,25,50].map(d=>`<button type="button" data-quick="${d}" class="badge bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700"></button>`).join("")}</div>
          </div>
          <input class="input" name="note" placeholder="Note (optional, e.g. payment received)" />
          <button class="btn-primary w-full py-2.5" data-submit></button>
        </form>
        <div data-history></div>
      </div>`,{onClose:()=>r&&window.location.reload()}).body,u=i("form",p);function g(){i("[data-balance]",p).textContent=String(a),i("[data-balance-note]",p).textContent=`Can register ${a} more ${a===1?"business":"businesses"} (1 point each).`,m("[data-mode]",p).forEach(d=>{const o=d.dataset.mode===n;d.className=`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${o?n==="grant"?"bg-emerald-600 text-white border-emerald-600":"bg-red-600 text-white border-red-600":"border-gray-300 text-ink-600 hover:bg-gray-50"}`}),m("[data-quick]",p).forEach(d=>d.textContent=`${n==="grant"?"+":"−"}${d.dataset.quick}`),i("[data-submit]",p).textContent=`${n==="grant"?"Add":"Deduct"} ${u.amount.value||0} points`}async function f(){try{const{data:d}=await b.get(`/admin/users/${t.id}/points/transactions`,{pageSize:8});i("[data-history]",p).innerHTML=d.length?`<p class="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">Recent activity</p>
            <div class="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">${d.map(o=>{const[c,$]=ue[o.type]??[o.type,"bg-gray-100 text-gray-600"];return`<div class="px-3 py-2 flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <span class="badge ${$}">${l(c)}</span>
                    ${o.note?`<p class="text-xs text-ink-500 truncate mt-1">${l(o.note)}</p>`:""}
                    <p class="text-[11px] text-ink-400">${l(ae(o.createdAt))}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="font-bold text-sm ${o.amount>0?"text-emerald-700":"text-red-600"}">${o.amount>0?`+${o.amount}`:o.amount}</p>
                    <p class="text-[11px] text-ink-400">bal ${o.balanceAfter}</p>
                  </div>
                </div>`}).join("")}</div>`:""}catch{}}m("[data-mode]",p).forEach(d=>d.addEventListener("click",()=>{n=d.dataset.mode,g()})),m("[data-quick]",p).forEach(d=>d.addEventListener("click",()=>{u.amount.value=d.dataset.quick,g()})),u.amount.addEventListener("input",g),u.addEventListener("submit",async d=>{d.preventDefault();const o=Number(u.amount.value),c=i("[data-form-error]",u);if(!Number.isFinite(o)||o<=0){c.innerHTML=E("Enter a number greater than zero");return}const $=i("[data-submit]",u);$.disabled=!0,$.textContent="Saving…",c.innerHTML="";try{const{data:I}=await b.patch(`/admin/users/${t.id}/points`,{amount:n==="grant"?o:-o,note:u.note.value||void 0});a=I.points??0,r=!0,u.note.value="",f()}catch(I){c.innerHTML=E(y(I))}finally{$.disabled=!1,g()}}),g(),f()}));m("[data-business-action]").forEach(e=>e.addEventListener("click",async()=>{e.disabled=!0;try{await b.post(`/admin/businesses/${e.dataset.id}/${e.dataset.businessAction}`),window.location.reload()}catch(t){e.disabled=!1,L(t)}}));m("[data-edit-business]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.editBusiness),a=R("admin-categories")??[],n=h(`Edit ${t.name}`,`<form class="space-y-3">
        <div data-form-error></div>
        <input class="input" name="name" value="${l(t.name)}" placeholder="Business name" />
        <select class="input" name="categoryId" data-search-select data-search-placeholder="Search category…">
          <option value="">Select category</option>
          ${a.map(s=>{var p;return`<option value="${l(s.id)}" ${s.id===((p=t.category)==null?void 0:p.id)?"selected":""}>${l(s.name)}</option>`}).join("")}
        </select>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          ${ne({state:t.state,city:t.city})}
        </div>
        <input class="input" name="phone" value="${l(t.phone)}" placeholder="Phone" />
        <div class="flex gap-3">
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select class="input" name="status">${T(ce,t.status)}</select>
          </div>
          <label class="w-1/2 flex items-end gap-2 pb-2.5 text-sm text-ink-700">
            <input type="checkbox" name="isVerified" ${t.isVerified?"checked":""} /> Verified business
          </label>
        </div>
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`),r=i("form",n.body);ie(r),se(r),r.addEventListener("submit",s=>{s.preventDefault(),N(r,i("[data-submit]",r),"Saving…",async()=>{await b.patch(`/admin/businesses/${t.id}`,{name:r.name.value,categoryId:r.categoryId.value,city:r.city.value,state:r.state.value,phone:r.phone.value,status:r.status.value,isVerified:r.isVerified.checked}),x("Business updated.")})})}));m("[data-reassign]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.reassign),a=h(`Reassign “${t.name}”`,`<p class="text-sm text-ink-500 mb-3">Current owner: <span class="font-medium text-ink-800">${l(t.owner?`${t.owner.firstName} ${t.owner.lastName}`:"—")}</span>. Choose a new owner (business owner, dealer, or admin).</p>
      <div data-form-error></div>
      <div class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 mb-3">
        ${k("search",{size:16,className:"text-gray-400"})}
        <input data-owner-search placeholder="Search owners/dealers…" class="w-full py-2.5 text-sm focus:outline-none" />
      </div>
      <div class="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg" data-candidates></div>`),n=i("[data-candidates]",a.body),r=u=>({ADMIN:"bg-brand-50 text-brand-700",DEALER:"bg-violet-50 text-violet-700",BUSINESS_OWNER:"bg-sky-50 text-sky-700"})[u]??"bg-gray-100 text-gray-600";async function s(u){n.innerHTML=`<div class="flex items-center justify-center gap-2 py-8 text-sm text-ink-500">${k("loader-2",{size:16,className:"animate-spin"})} Searching…</div>`;try{const{data:g}=await b.get("/admin/users",{search:u||void 0}),f=g.filter(d=>{var o;return["BUSINESS_OWNER","DEALER","ADMIN"].includes(d.role)&&d.id!==((o=t.owner)==null?void 0:o.id)});n.innerHTML=f.length?f.map(d=>`<div class="p-3 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-ink-900 truncate">${l(d.firstName)} ${l(d.lastName)} <span class="badge ${r(d.role)} !px-1.5 !py-0">${W(d.role)}</span></p>
                  <p class="text-xs text-ink-500 truncate">${l(d.email??d.phone??"")}</p>
                </div>
                <button type="button" data-assign="${l(d.id)}" class="btn-primary px-3 py-1.5 text-sm shrink-0">Assign</button>
              </div>`).join(""):'<div class="p-6 text-center text-sm text-ink-500">No eligible owners found.</div>'}catch(g){n.innerHTML=E(y(g))}}let p;i("[data-owner-search]",a.body).addEventListener("input",u=>{clearTimeout(p),p=setTimeout(()=>s(u.target.value),250)}),n.addEventListener("click",async u=>{const g=u.target.closest("[data-assign]");if(g){m("[data-assign]",n).forEach(f=>f.disabled=!0),g.textContent="…";try{await b.post(`/admin/businesses/${t.id}/reassign`,{ownerId:g.dataset.assign}),x("Business reassigned.")}catch(f){i("[data-form-error]",a.body).innerHTML=E(y(f)),m("[data-assign]",n).forEach(d=>d.disabled=!1),g.textContent="Assign"}}}),s("")}));function X(e,t,a){const n=h(`${e.length} QR ${e.length===1?"board":"boards"} ready to print`,`<p class="mb-3 text-sm text-ink-600">Print these and hand them out. A shop scans one, confirms the code, and attaches it to their listing.</p>
    <div id="qr-board" class="grid grid-cols-2 gap-4"><p class="col-span-2 py-6 text-center text-sm text-ink-500">Rendering codes…</p></div>
    <button type="button" data-print class="btn-primary mt-4 w-full py-2.5">${k("printer",{size:15})} Print sheet</button>`,{onClose:a});Promise.all(e.map(r=>V(z(r),320).then(s=>({code:r,dataUrl:s})))).then(r=>{i("#qr-board",n.body).innerHTML=r.map(s=>`<div class="rounded-xl border-2 border-dashed border-gray-200 p-3 text-center">
          <p class="text-[9px] font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
          <p class="text-[11px] font-semibold text-ink-700">${l(te(t))}</p>
          <img src="${s.dataUrl}" alt="${l(s.code)}" class="mx-auto my-1.5 h-28 w-28" />
          <p class="font-mono text-xs font-bold text-ink-900">${l(s.code)}</p>
          <p class="text-[8px] uppercase tracking-wider text-ink-400">Powered by Markkito</p>
        </div>`).join("")}).catch(()=>{}),i("[data-print]",n.body).addEventListener("click",()=>window.print())}m("[data-print-codes]").forEach(e=>e.addEventListener("click",()=>X(JSON.parse(e.dataset.printCodes),e.dataset.purpose||null)));m("[data-qr-png]").forEach(e=>e.addEventListener("click",()=>V(z(e.dataset.qrPng)).then(t=>ee(t,`${e.dataset.qrPng}-qr.png`)).catch(()=>A(M,"Could not generate that QR image."))));m("[data-qr-update]").forEach(e=>e.addEventListener("click",async()=>{try{await b.patch(`/admin/qr-codes/${e.dataset.qrUpdate}`,JSON.parse(e.dataset.payload)),x(e.dataset.message)}catch(t){L(t)}}));var U;(U=i("[data-generate-boards]"))==null||U.addEventListener("click",()=>{const e=h("Generate QR boards",`<form class="space-y-3">
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
    </form>`),t=i("form",e.body),a=i("[data-submit]",t);t.count.addEventListener("input",()=>a.textContent=`Generate ${t.count.value||0} boards`),t.addEventListener("submit",n=>{n.preventDefault(),N(t,a,"Generating…",async()=>{const{data:r}=await b.post("/admin/qr-codes/batch",{count:Number(t.count.value),batchLabel:t.batchLabel.value||void 0});e.close(),X(r.codes,null,()=>x(`Generated ${r.created} new QR boards.`))})})});function be(e){const t=Math.max(0,Math.floor((Date.now()-new Date(e).getTime())/1e3));if(t<60)return`${t}s ago`;const a=Math.floor(t/60);return a<60?`${a}m ago`:`${Math.floor(a/60)}h ago`}const G=(e=document)=>m("[data-time-ago]",e).forEach(t=>t.textContent=be(t.dataset.timeAgo)),S=i("[data-online-list]");S&&(G(S),setInterval(async()=>{try{const e=await fetch("/admin/online",{headers:{Accept:"text/html"},credentials:"same-origin"});if(!e.ok)return;S.innerHTML=await e.text(),i("[data-online-count]").textContent=`${e.headers.get("X-Online-Count")??0} active`,G(S)}catch{}},15e3));async function P(e,t,a,n){A(M,"");const r=e.innerHTML;e.disabled=!0,e.textContent=t;try{const{data:s}=await a();x(n(s))}catch(s){L(s),e.disabled=!1,e.innerHTML=r}}var F;(F=i("[data-seo-run]"))==null||F.addEventListener("click",e=>P(e.currentTarget,"Syncing…",()=>b.post("/admin/seo/run"),t=>t.configured?`Synced with Google: ${t.submitted} submitted, ${t.checked} checked${t.failed?`, ${t.failed} failed`:""}.`:`Google is not connected — ${t.tracked} new page(s) tracked, nothing submitted.`));m("[data-seo-check]").forEach(e=>e.addEventListener("click",()=>P(e,"Checking…",()=>b.post(`/admin/seo/pages/${e.dataset.seoCheck}/check`),t=>t.indexStatus==="INDEXED"?"The page is on Google.":`Not on Google yet: ${t.coverageState??"no details"}.`)));m("[data-seo-submit]").forEach(e=>e.addEventListener("click",()=>P(e,"Sending…",()=>b.post(`/admin/seo/pages/${e.dataset.seoSubmit}/submit`),()=>"Sent to Google — it usually crawls within a day or two.")));m("[data-plan]").forEach(e=>{const t=i('[name="months"]',e);t.addEventListener("change",()=>m('[data-renewal-field="1"]',e).forEach(a=>a.disabled=t.value===""))});const D=(e,t)=>{const a=i(`[name="${t}"]`,e).value;return a===""?null:Number(a)};var H;(H=i("[data-feature-plans]"))==null||H.addEventListener("submit",async e=>{e.preventDefault();const t=e.currentTarget,a=i("[data-plans-saved]",t),n=i('button[type="submit"]',t),r=m("[data-plan]",t).map(s=>({feature:s.dataset.plan,points:Number(i('[name="points"]',s).value),renewalPoints:Number(i('[name="renewalPoints"]',s).value),price:D(s,"price"),commission:D(s,"commission"),renewalPrice:D(s,"renewalPrice"),renewalCommission:D(s,"renewalCommission"),months:i('[name="months"]',s).value===""?null:Number(i('[name="months"]',s).value)}));A(M,""),a.textContent="",n.disabled=!0;try{await b.put("/admin/feature-plans",{groupId:t.dataset.groupId,plans:r}),a.textContent="Pricing saved."}catch(s){L(s)}finally{n.disabled=!1}});const v=R("pricing-group-data"),C=e=>`/admin?tab=${encodeURIComponent("Feature Pricing")}${e?`&group=${e}`:""}`;function Y(e,t,a,n){const r=h(e,`<form class="space-y-3">
      <div data-form-error></div>
      <input required maxlength="80" class="input" name="name" value="${l(t)}" placeholder="e.g. Gold dealers" />
      <button class="btn-primary w-full py-2.5" data-submit>${l(a)}</button>
    </form>`),s=i("form",r.body);s.name.focus(),s.addEventListener("submit",p=>{p.preventDefault(),N(s,i("[data-submit]",s),"Saving…",()=>n(s.name.value.trim()))})}var q;(q=i("[data-group-new]"))==null||q.addEventListener("click",()=>Y("New pricing group","","Create group",async e=>{var a,n;const{data:t}=await b.post("/admin/pricing-groups",{name:e,copyFrom:(a=v==null?void 0:v.group)==null?void 0:a.id});x(`Created “${e}” with ${((n=v==null?void 0:v.group)==null?void 0:n.name)??"the default"} prices. Change them below, then put dealers in it from Users.`,C(t.id))}));var _;(_=i("[data-group-rename]"))==null||_.addEventListener("click",()=>Y("Rename pricing group",v.group.name,"Save name",async e=>{await b.patch(`/admin/pricing-groups/${v.group.id}`,{name:e}),x("Group renamed.",C(v.group.id))}));var B;(B=i("[data-group-default]"))==null||B.addEventListener("click",async e=>{const t=e.currentTarget;t.disabled=!0;try{await b.patch(`/admin/pricing-groups/${v.group.id}`,{isDefault:!0}),x(`“${v.group.name}” is now the default: dealers in no group pay its prices.`,C(v.group.id))}catch(a){L(a),t.disabled=!1}});var j;(j=i("[data-group-delete]"))==null||j.addEventListener("click",()=>{var a;const e=((a=v.groups.find(n=>n.id===v.group.id))==null?void 0:a.dealers)??0,t=h(`Delete “${v.group.name}”?`,`<div class="space-y-3">
      <div data-form-error></div>
      <p class="text-sm text-ink-600">${e?`Its ${e} ${e===1?"dealer moves":"dealers move"} to the default group and pay its prices from now on.`:"No dealers are in this group."} Features already bought keep their end dates.</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary px-4 py-2 text-sm" data-close>Keep it</button>
        <button type="button" class="btn-primary !bg-red-600 hover:!bg-red-700 px-4 py-2 text-sm" data-confirm>Delete group</button>
      </div>
    </div>`);i("[data-confirm]",t.body).addEventListener("click",async n=>{n.currentTarget.disabled=!0;try{await b.delete(`/admin/pricing-groups/${v.group.id}`),x("Group deleted.",C(null))}catch(r){i("[data-form-error]",t.body).innerHTML=E(y(r)),n.currentTarget.disabled=!1}})});const w=e=>e==null?"—":`${e<0?"−":""}₹${Math.abs(e).toLocaleString("en-IN")}`;m("[data-commission]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.commission),a=new Date().toISOString().slice(0,10),r=h(`Commission — ${t.firstName} ${t.lastName}`,`<div class="space-y-4">
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
      </div>`,{wide:!0,onClose:()=>u&&e.hasAttribute("data-commission-reload")&&window.location.reload()}).body,s=i("[data-pay]",r);let p=0,u=!1;const g=(d,o,c="text-ink-900")=>`<div class="rounded-lg bg-gray-50 px-3 py-2"><p class="text-[10px] font-semibold uppercase tracking-wide text-ink-500">${d}</p><p class="text-lg font-bold tabular-nums ${c}">${o}</p></div>`;async function f(){try{const{data:d}=await b.get(`/admin/users/${t.id}/commission`,{pageSize:10}),o=d.summary;p=o.due,i("[data-summary]",r).innerHTML=g("Collected",w(o.collected))+g("Commission",w(o.commission))+g("Paid",w(o.paid),"text-emerald-700")+g("Due",w(o.due),o.due>0?"text-amber-700":"text-ink-900"),i("[data-payments]",r).innerHTML=d.payments.length?`<p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Payments received</p>
            <div class="max-h-52 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">${d.payments.map(c=>`<div class="flex items-center justify-between gap-2 px-3 py-2">
                  <div class="min-w-0"><p class="text-sm font-semibold text-emerald-700">${w(c.amount)}</p>
                    <p class="truncate text-[11px] text-ink-500">${l(c.paidOn)}${c.note?` · ${l(c.note)}`:""}${c.receivedBy?` · by ${l(c.receivedBy)}`:""}</p></div>
                  <button type="button" class="shrink-0 text-xs font-semibold text-red-700 hover:underline" data-remove="${l(c.id)}">Remove</button>
                </div>`).join("")}</div>`:'<p class="text-sm text-ink-500">No payments recorded yet.</p>',i("[data-sales]",r).innerHTML=d.sales.length?`<p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Latest sales and renewals</p>
            <div class="max-h-52 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">${d.sales.map(c=>`<div class="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span class="min-w-0 truncate">${l(c.business??"Deleted business")} · ${l(c.featureLabel??"All features")}${c.type==="FEATURE_RENEWED"?" (renewal)":["FEATURE_REMOVED","BUSINESS_DELETED"].includes(c.type)?" (refund)":""}</span>
                  <span class="shrink-0 tabular-nums text-ink-500">${w(c.price)} · <b class="text-ink-900">${w(c.commission)}</b></span>
                </div>`).join("")}</div>`:""}catch(d){i("[data-summary]",r).innerHTML=E(y(d))}}i("[data-pay-all]",s).addEventListener("click",()=>s.amount.value=p>0?p:""),s.addEventListener("submit",async d=>{d.preventDefault();const o=i("[data-form-error]",s),c=i("[data-submit]",s);o.innerHTML="",c.disabled=!0;try{await b.post(`/admin/users/${t.id}/commission-payments`,{amount:Number(s.amount.value),paidOn:s.paidOn.value||void 0,note:s.note.value.trim()||void 0}),s.amount.value="",s.note.value="",u=!0,await f()}catch($){o.innerHTML=E(y($))}finally{c.disabled=!1}}),i("[data-payments]",r).addEventListener("click",async d=>{const o=d.target.closest("[data-remove]");if(o){if(o.dataset.armed!=="1"){o.dataset.armed="1",o.textContent="Tap again to remove";return}o.disabled=!0;try{await b.delete(`/admin/commission-payments/${o.dataset.remove}`),u=!0,await f()}catch(c){i("[data-form-error]",s).innerHTML=E(y(c)),o.disabled=!1}}}),f()}));Z();
