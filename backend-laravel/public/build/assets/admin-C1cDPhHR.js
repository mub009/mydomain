import{a as b,e as E}from"./api-3HrlSN3j.js";import{r as P,b as q,d as _,a as j}from"./channels-e-xcKH2w.js";import{$ as o,a as l,o as g,e as d,i as f,b as $,p as F,f as V}from"./ui-BchMeLp1.js";import{s as z,r as J,a as v,b as S}from"./widgets-Ces1tCk-.js";import"./_commonjsHelpers-CqkleIqs.js";const G=["CUSTOMER","BUSINESS_OWNER","DEALER","ADMIN"],Q=["ACTIVE","SUSPENDED","PENDING_VERIFICATION"],W=["DRAFT","PENDING_APPROVAL","PUBLISHED","SUSPENDED"],K={MANAGE_LISTINGS:"Manage listings",MANAGE_LEADS:"Manage leads",MANAGE_BOOKINGS:"Manage bookings"},O=e=>e.replace("_"," "),D=o("[data-error]"),A=e=>S(D,E(e));z();l("[data-live-search]").forEach(e=>{let t;e.addEventListener("input",()=>{clearTimeout(t),t=setTimeout(()=>e.form.submit(),400)}),e.value&&document.activeElement===document.body&&new URL(window.location.href).searchParams.has("search")&&(e.focus(),e.setSelectionRange(e.value.length,e.value.length))});l("[data-autosubmit-check]").forEach(e=>e.addEventListener("change",()=>e.form.submit()));function k(e,t){return e.map(s=>`<option value="${s}" ${s===t?"selected":""}>${O(s)}</option>`).join("")}function U(e){return`<div data-privileges>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Dealer privileges</label>
    <div class="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      ${Object.entries(K).map(([t,s])=>`<label class="flex items-center gap-2 text-sm text-ink-700 cursor-pointer"><input type="checkbox" name="privileges" value="${t}" ${e.includes(t)?"checked":""} /> ${s}</label>`).join("")}
      <p class="text-xs text-ink-400 pt-1">Controls which dashboard features this dealer can access.</p>
    </div>
  </div>`}function H(e){const t=()=>{const s=e.role.value==="DEALER";o("[data-privileges]",e).hidden=!s,l("[data-when-dealer]",e).forEach(a=>a.hidden=!s),e.phone.required=s,e.email.required=!s};e.role.addEventListener("change",t),t()}async function N(e,t,s,a){const n=t.textContent;t.disabled=!0,t.textContent=s,o("[data-form-error]",e).innerHTML="";try{await a()}catch(r){o("[data-form-error]",e).innerHTML=$(E(r)),t.disabled=!1,t.textContent=n}}var C;(C=o("[data-create-user]"))==null||C.addEventListener("click",()=>{const e=g("Add a user",`<form class="space-y-3">
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
        <select class="input" name="role">${k(G,"DEALER")}</select>
        <p class="text-xs text-ink-500 mt-1">Dealers can add and manage stores on behalf of businesses.</p>
      </div>
      ${U(["MANAGE_LISTINGS"])}
      <button class="btn-primary w-full py-2.5" data-submit>Create user</button>
    </form>`),t=o("form",e.body);H(t),t.addEventListener("submit",s=>{s.preventDefault();const a=Object.fromEntries(new FormData(t)),n=new FormData(t).getAll("privileges");N(t,o("[data-submit]",t),"Creating…",async()=>{await b.post("/admin/users",{firstName:a.firstName,lastName:a.lastName,email:a.email.trim()||null,phone:a.phone.trim()||null,password:a.password,role:a.role,...a.role==="DEALER"?{privileges:n}:{}}),v(a.role==="DEALER"?`Dealer created — they sign in with ${a.phone.trim()}.`:"User created.")})})});l("[data-edit-user]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.editUser),s=g(`Edit ${t.firstName} ${t.lastName}`,`<form class="space-y-3">
        <div data-form-error></div>
        <div class="flex gap-3">
          <input class="input" name="firstName" value="${d(t.firstName)}" placeholder="First name" />
          <input class="input" name="lastName" value="${d(t.lastName)}" placeholder="Last name" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-ink-700 mb-1">Mobile number <span data-when-dealer>(login username)</span></label>
          <input class="input" type="tel" name="phone" inputmode="numeric" maxlength="14" value="${d(t.phone??"")}" placeholder="9876543210" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-ink-700 mb-1">Email <span data-when-dealer>(optional)</span></label>
          <input class="input" type="email" name="email" value="${d(t.email??"")}" placeholder="name@example.com" />
        </div>
        <div class="flex gap-3">
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Role</label>
            <select class="input" name="role">${k(G,t.role)}</select>
          </div>
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select class="input" name="status">${k(Q,t.status)}</select>
          </div>
        </div>
        ${U(t.privileges??[])}
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`),a=o("form",s.body);H(a),a.addEventListener("submit",n=>{n.preventDefault();const r=Object.fromEntries(new FormData(a)),m=new FormData(a).getAll("privileges");N(a,o("[data-submit]",a),"Saving…",async()=>{await b.patch(`/admin/users/${t.id}`,{firstName:r.firstName,lastName:r.lastName,email:r.email.trim()||null,phone:r.phone.trim()||null,role:r.role,status:r.status,...r.role==="DEALER"?{privileges:m}:{}}),v("User updated.")})})}));l("[data-reset-password]").forEach(e=>e.addEventListener("click",()=>J(JSON.parse(e.dataset.resetPassword))));const X={ADMIN_GRANT:["Granted","bg-emerald-50 text-emerald-700"],ADMIN_DEDUCTION:["Deducted","bg-red-50 text-red-700"],BUSINESS_CREATED:["Business registered","bg-brand-50 text-brand-700"]};l("[data-points]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.points);let s=t.points??0,a="grant",n=!1;const m=g(`Points — ${t.firstName} ${t.lastName}`,`<div class="space-y-4">
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
            <div class="flex gap-2 mt-2">${[5,10,25,50].map(i=>`<button type="button" data-quick="${i}" class="badge bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700"></button>`).join("")}</div>
          </div>
          <input class="input" name="note" placeholder="Note (optional, e.g. payment received)" />
          <button class="btn-primary w-full py-2.5" data-submit></button>
        </form>
        <div data-history></div>
      </div>`,{onClose:()=>n&&window.location.reload()}).body,p=o("form",m);function u(){o("[data-balance]",m).textContent=String(s),o("[data-balance-note]",m).textContent=`Can register ${s} more ${s===1?"business":"businesses"} (1 point each).`,l("[data-mode]",m).forEach(i=>{const c=i.dataset.mode===a;i.className=`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${c?a==="grant"?"bg-emerald-600 text-white border-emerald-600":"bg-red-600 text-white border-red-600":"border-gray-300 text-ink-600 hover:bg-gray-50"}`}),l("[data-quick]",m).forEach(i=>i.textContent=`${a==="grant"?"+":"−"}${i.dataset.quick}`),o("[data-submit]",m).textContent=`${a==="grant"?"Add":"Deduct"} ${p.amount.value||0} points`}async function h(){try{const{data:i}=await b.get(`/admin/users/${t.id}/points/transactions`,{pageSize:8});o("[data-history]",m).innerHTML=i.length?`<p class="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">Recent activity</p>
            <div class="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">${i.map(c=>{const[x,y]=X[c.type]??[c.type,"bg-gray-100 text-gray-600"];return`<div class="px-3 py-2 flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <span class="badge ${y}">${d(x)}</span>
                    ${c.note?`<p class="text-xs text-ink-500 truncate mt-1">${d(c.note)}</p>`:""}
                    <p class="text-[11px] text-ink-400">${d(V(c.createdAt))}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="font-bold text-sm ${c.amount>0?"text-emerald-700":"text-red-600"}">${c.amount>0?`+${c.amount}`:c.amount}</p>
                    <p class="text-[11px] text-ink-400">bal ${c.balanceAfter}</p>
                  </div>
                </div>`}).join("")}</div>`:""}catch{}}l("[data-mode]",m).forEach(i=>i.addEventListener("click",()=>{a=i.dataset.mode,u()})),l("[data-quick]",m).forEach(i=>i.addEventListener("click",()=>{p.amount.value=i.dataset.quick,u()})),p.amount.addEventListener("input",u),p.addEventListener("submit",async i=>{i.preventDefault();const c=Number(p.amount.value),x=o("[data-form-error]",p);if(!Number.isFinite(c)||c<=0){x.innerHTML=$("Enter a number greater than zero");return}const y=o("[data-submit]",p);y.disabled=!0,y.textContent="Saving…",x.innerHTML="";try{const{data:L}=await b.patch(`/admin/users/${t.id}/points`,{amount:a==="grant"?c:-c,note:p.note.value||void 0});s=L.points??0,n=!0,p.note.value="",h()}catch(L){x.innerHTML=$(E(L))}finally{y.disabled=!1,u()}}),u(),h()}));l("[data-business-action]").forEach(e=>e.addEventListener("click",async()=>{e.disabled=!0;try{await b.post(`/admin/businesses/${e.dataset.id}/${e.dataset.businessAction}`),window.location.reload()}catch(t){e.disabled=!1,A(t)}}));l("[data-edit-business]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.editBusiness),s=F("admin-categories")??[],a=g(`Edit ${t.name}`,`<form class="space-y-3">
        <div data-form-error></div>
        <input class="input" name="name" value="${d(t.name)}" placeholder="Business name" />
        <select class="input" name="categoryId">
          <option value="">Select category</option>
          ${s.map(r=>{var m;return`<option value="${d(r.id)}" ${r.id===((m=t.category)==null?void 0:m.id)?"selected":""}>${d(r.name)}</option>`}).join("")}
        </select>
        <div class="flex gap-3">
          <input class="input" name="city" value="${d(t.city)}" placeholder="City" />
          <input class="input" name="state" value="${d(t.state)}" placeholder="State" />
        </div>
        <input class="input" name="phone" value="${d(t.phone)}" placeholder="Phone" />
        <div class="flex gap-3">
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select class="input" name="status">${k(W,t.status)}</select>
          </div>
          <label class="w-1/2 flex items-end gap-2 pb-2.5 text-sm text-ink-700">
            <input type="checkbox" name="isVerified" ${t.isVerified?"checked":""} /> Verified business
          </label>
        </div>
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`),n=o("form",a.body);n.addEventListener("submit",r=>{r.preventDefault(),N(n,o("[data-submit]",n),"Saving…",async()=>{await b.patch(`/admin/businesses/${t.id}`,{name:n.name.value,categoryId:n.categoryId.value,city:n.city.value,state:n.state.value,phone:n.phone.value,status:n.status.value,isVerified:n.isVerified.checked}),v("Business updated.")})})}));l("[data-reassign]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.reassign),s=g(`Reassign “${t.name}”`,`<p class="text-sm text-ink-500 mb-3">Current owner: <span class="font-medium text-ink-800">${d(t.owner?`${t.owner.firstName} ${t.owner.lastName}`:"—")}</span>. Choose a new owner (business owner, dealer, or admin).</p>
      <div data-form-error></div>
      <div class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 mb-3">
        ${f("search",{size:16,className:"text-gray-400"})}
        <input data-owner-search placeholder="Search owners/dealers…" class="w-full py-2.5 text-sm focus:outline-none" />
      </div>
      <div class="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg" data-candidates></div>`),a=o("[data-candidates]",s.body),n=p=>({ADMIN:"bg-brand-50 text-brand-700",DEALER:"bg-violet-50 text-violet-700",BUSINESS_OWNER:"bg-sky-50 text-sky-700"})[p]??"bg-gray-100 text-gray-600";async function r(p){a.innerHTML=`<div class="flex items-center justify-center gap-2 py-8 text-sm text-ink-500">${f("loader-2",{size:16,className:"animate-spin"})} Searching…</div>`;try{const{data:u}=await b.get("/admin/users",{search:p||void 0}),h=u.filter(i=>{var c;return["BUSINESS_OWNER","DEALER","ADMIN"].includes(i.role)&&i.id!==((c=t.owner)==null?void 0:c.id)});a.innerHTML=h.length?h.map(i=>`<div class="p-3 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-ink-900 truncate">${d(i.firstName)} ${d(i.lastName)} <span class="badge ${n(i.role)} !px-1.5 !py-0">${O(i.role)}</span></p>
                  <p class="text-xs text-ink-500 truncate">${d(i.email??i.phone??"")}</p>
                </div>
                <button type="button" data-assign="${d(i.id)}" class="btn-primary px-3 py-1.5 text-sm shrink-0">Assign</button>
              </div>`).join(""):'<div class="p-6 text-center text-sm text-ink-500">No eligible owners found.</div>'}catch(u){a.innerHTML=$(E(u))}}let m;o("[data-owner-search]",s.body).addEventListener("input",p=>{clearTimeout(m),m=setTimeout(()=>r(p.target.value),250)}),a.addEventListener("click",async p=>{const u=p.target.closest("[data-assign]");if(u){l("[data-assign]",a).forEach(h=>h.disabled=!0),u.textContent="…";try{await b.post(`/admin/businesses/${t.id}/reassign`,{ownerId:u.dataset.assign}),v("Business reassigned.")}catch(h){o("[data-form-error]",s.body).innerHTML=$(E(h)),l("[data-assign]",a).forEach(i=>i.disabled=!1),u.textContent="Assign"}}}),r("")}));function B(e,t,s){const a=g(`${e.length} QR ${e.length===1?"board":"boards"} ready to print`,`<p class="mb-3 text-sm text-ink-600">Print these and hand them out. A shop scans one, confirms the code, and attaches it to their listing.</p>
    <div id="qr-board" class="grid grid-cols-2 gap-4"><p class="col-span-2 py-6 text-center text-sm text-ink-500">Rendering codes…</p></div>
    <button type="button" data-print class="btn-primary mt-4 w-full py-2.5">${f("printer",{size:15})} Print sheet</button>`,{onClose:s});Promise.all(e.map(n=>P(q(n),320).then(r=>({code:n,dataUrl:r})))).then(n=>{o("#qr-board",a.body).innerHTML=n.map(r=>`<div class="rounded-xl border-2 border-dashed border-gray-200 p-3 text-center">
          <p class="text-[9px] font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
          <p class="text-[11px] font-semibold text-ink-700">${d(j(t))}</p>
          <img src="${r.dataUrl}" alt="${d(r.code)}" class="mx-auto my-1.5 h-28 w-28" />
          <p class="font-mono text-xs font-bold text-ink-900">${d(r.code)}</p>
          <p class="text-[8px] uppercase tracking-wider text-ink-400">Powered by Markkito</p>
        </div>`).join("")}).catch(()=>{}),o("[data-print]",a.body).addEventListener("click",()=>window.print())}l("[data-print-codes]").forEach(e=>e.addEventListener("click",()=>B(JSON.parse(e.dataset.printCodes),e.dataset.purpose||null)));l("[data-qr-png]").forEach(e=>e.addEventListener("click",()=>P(q(e.dataset.qrPng)).then(t=>_(t,`${e.dataset.qrPng}-qr.png`)).catch(()=>S(D,"Could not generate that QR image."))));l("[data-qr-update]").forEach(e=>e.addEventListener("click",async()=>{try{await b.patch(`/admin/qr-codes/${e.dataset.qrUpdate}`,JSON.parse(e.dataset.payload)),v(e.dataset.message)}catch(t){A(t)}}));var I;(I=o("[data-generate-boards]"))==null||I.addEventListener("click",()=>{const e=g("Generate QR boards",`<form class="space-y-3">
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
    </form>`),t=o("form",e.body),s=o("[data-submit]",t);t.count.addEventListener("input",()=>s.textContent=`Generate ${t.count.value||0} boards`),t.addEventListener("submit",a=>{a.preventDefault(),N(t,s,"Generating…",async()=>{const{data:n}=await b.post("/admin/qr-codes/batch",{count:Number(t.count.value),batchLabel:t.batchLabel.value||void 0});e.close(),B(n.codes,null,()=>v(`Generated ${n.created} new QR boards.`))})})});function Y(e){const t=Math.max(0,Math.floor((Date.now()-new Date(e).getTime())/1e3));if(t<60)return`${t}s ago`;const s=Math.floor(t/60);return s<60?`${s}m ago`:`${Math.floor(s/60)}h ago`}const T=(e=document)=>l("[data-time-ago]",e).forEach(t=>t.textContent=Y(t.dataset.timeAgo)),w=o("[data-online-list]");w&&(T(w),setInterval(async()=>{try{const e=await fetch("/admin/online",{headers:{Accept:"text/html"},credentials:"same-origin"});if(!e.ok)return;w.innerHTML=await e.text(),o("[data-online-count]").textContent=`${e.headers.get("X-Online-Count")??0} active`,T(w)}catch{}},15e3));async function M(e,t,s,a){S(D,"");const n=e.innerHTML;e.disabled=!0,e.textContent=t;try{const{data:r}=await s();v(a(r))}catch(r){A(r),e.disabled=!1,e.innerHTML=n}}var R;(R=o("[data-seo-run]"))==null||R.addEventListener("click",e=>M(e.currentTarget,"Syncing…",()=>b.post("/admin/seo/run"),t=>t.configured?`Synced with Google: ${t.submitted} submitted, ${t.checked} checked${t.failed?`, ${t.failed} failed`:""}.`:`Google is not connected — ${t.tracked} new page(s) tracked, nothing submitted.`));l("[data-seo-check]").forEach(e=>e.addEventListener("click",()=>M(e,"Checking…",()=>b.post(`/admin/seo/pages/${e.dataset.seoCheck}/check`),t=>t.indexStatus==="INDEXED"?"The page is on Google.":`Not on Google yet: ${t.coverageState??"no details"}.`)));l("[data-seo-submit]").forEach(e=>e.addEventListener("click",()=>M(e,"Sending…",()=>b.post(`/admin/seo/pages/${e.dataset.seoSubmit}/submit`),()=>"Sent to Google — it usually crawls within a day or two.")));
