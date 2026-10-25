import{a as b,e as E}from"./api-3HrlSN3j.js";import{r as M,b as T,d as B,a as H}from"./channels-e-xcKH2w.js";import{$ as r,a as c,o as v,e as l,i as g,b as $,p as _,f as j}from"./ui-D0zQHRcp.js";import{s as F,r as V,a as x,b as I}from"./widgets-BR7-uoaY.js";import"./_commonjsHelpers-CqkleIqs.js";const C=["CUSTOMER","BUSINESS_OWNER","DEALER","ADMIN"],z=["ACTIVE","SUSPENDED","PENDING_VERIFICATION"],J=["DRAFT","PENDING_APPROVAL","PUBLISHED","SUSPENDED"],Q={MANAGE_LISTINGS:"Manage listings",MANAGE_LEADS:"Manage leads",MANAGE_BOOKINGS:"Manage bookings"},R=t=>t.replace("_"," "),P=r("[data-error]"),q=t=>I(P,E(t));F();c("[data-live-search]").forEach(t=>{let e;t.addEventListener("input",()=>{clearTimeout(e),e=setTimeout(()=>t.form.submit(),400)}),t.value&&document.activeElement===document.body&&new URL(window.location.href).searchParams.has("search")&&(t.focus(),t.setSelectionRange(t.value.length,t.value.length))});c("[data-autosubmit-check]").forEach(t=>t.addEventListener("change",()=>t.form.submit()));function k(t,e){return t.map(s=>`<option value="${s}" ${s===e?"selected":""}>${R(s)}</option>`).join("")}function O(t){return`<div data-privileges>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Dealer privileges</label>
    <div class="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      ${Object.entries(Q).map(([e,s])=>`<label class="flex items-center gap-2 text-sm text-ink-700 cursor-pointer"><input type="checkbox" name="privileges" value="${e}" ${t.includes(e)?"checked":""} /> ${s}</label>`).join("")}
      <p class="text-xs text-ink-400 pt-1">Controls which dashboard features this dealer can access.</p>
    </div>
  </div>`}function U(t){const e=()=>r("[data-privileges]",t).hidden=t.role.value!=="DEALER";t.role.addEventListener("change",e),e()}async function N(t,e,s,a){const i=e.textContent;e.disabled=!0,e.textContent=s,r("[data-form-error]",t).innerHTML="";try{await a()}catch(o){r("[data-form-error]",t).innerHTML=$(E(o)),e.disabled=!1,e.textContent=i}}var A;(A=r("[data-create-user]"))==null||A.addEventListener("click",()=>{const t=v("Add a user",`<form class="space-y-3">
      <div data-form-error></div>
      <div class="flex gap-3">
        <input required class="input" name="firstName" placeholder="First name" />
        <input required class="input" name="lastName" placeholder="Last name" />
      </div>
      <input required class="input" type="email" name="email" placeholder="Email" />
      <input required class="input" type="password" name="password" placeholder="Password (min 8 chars)" />
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">Role</label>
        <select class="input" name="role">${k(C,"DEALER")}</select>
        <p class="text-xs text-ink-500 mt-1">Dealers can add and manage stores on behalf of businesses.</p>
      </div>
      ${O(["MANAGE_LISTINGS"])}
      <button class="btn-primary w-full py-2.5" data-submit>Create user</button>
    </form>`),e=r("form",t.body);U(e),e.addEventListener("submit",s=>{s.preventDefault();const a=Object.fromEntries(new FormData(e)),i=new FormData(e).getAll("privileges");N(e,r("[data-submit]",e),"Creating…",async()=>{await b.post("/admin/users",{firstName:a.firstName,lastName:a.lastName,email:a.email,password:a.password,role:a.role,...a.role==="DEALER"?{privileges:i}:{}}),x("User created.")})})});c("[data-edit-user]").forEach(t=>t.addEventListener("click",()=>{const e=JSON.parse(t.dataset.editUser),s=v(`Edit ${e.firstName} ${e.lastName}`,`<form class="space-y-3">
        <div data-form-error></div>
        <div class="flex gap-3">
          <input class="input" name="firstName" value="${l(e.firstName)}" placeholder="First name" />
          <input class="input" name="lastName" value="${l(e.lastName)}" placeholder="Last name" />
        </div>
        <input class="input" type="email" name="email" value="${l(e.email)}" placeholder="Email" />
        <div class="flex gap-3">
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Role</label>
            <select class="input" name="role">${k(C,e.role)}</select>
          </div>
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select class="input" name="status">${k(z,e.status)}</select>
          </div>
        </div>
        ${O(e.privileges??[])}
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`),a=r("form",s.body);U(a),a.addEventListener("submit",i=>{i.preventDefault();const o=Object.fromEntries(new FormData(a)),m=new FormData(a).getAll("privileges");N(a,r("[data-submit]",a),"Saving…",async()=>{await b.patch(`/admin/users/${e.id}`,{firstName:o.firstName,lastName:o.lastName,email:o.email,role:o.role,status:o.status,...o.role==="DEALER"?{privileges:m}:{}}),x("User updated.")})})}));c("[data-reset-password]").forEach(t=>t.addEventListener("click",()=>V(JSON.parse(t.dataset.resetPassword))));const W={ADMIN_GRANT:["Granted","bg-emerald-50 text-emerald-700"],ADMIN_DEDUCTION:["Deducted","bg-red-50 text-red-700"],BUSINESS_CREATED:["Business registered","bg-brand-50 text-brand-700"]};c("[data-points]").forEach(t=>t.addEventListener("click",()=>{const e=JSON.parse(t.dataset.points);let s=e.points??0,a="grant",i=!1;const m=v(`Points — ${e.firstName} ${e.lastName}`,`<div class="space-y-4">
        <div class="rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-4 text-white">
          <p class="text-white/80 text-xs flex items-center gap-1.5">${g("coins",{size:14})} Current balance</p>
          <p class="text-3xl font-extrabold mt-0.5" data-balance></p>
          <p class="text-white/80 text-xs mt-1" data-balance-note></p>
        </div>
        <form class="space-y-3">
          <div data-form-error></div>
          <div class="flex gap-2">
            <button type="button" data-mode="grant" class="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors">${g("plus",{size:14,className:"inline -mt-0.5 mr-1"})} Add points</button>
            <button type="button" data-mode="deduct" class="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors">${g("minus",{size:14,className:"inline -mt-0.5 mr-1"})} Deduct</button>
          </div>
          <div>
            <label class="block text-xs font-semibold text-ink-700 mb-1">Amount</label>
            <input required type="number" min="1" class="input" name="amount" value="10" />
            <div class="flex gap-2 mt-2">${[5,10,25,50].map(n=>`<button type="button" data-quick="${n}" class="badge bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700"></button>`).join("")}</div>
          </div>
          <input class="input" name="note" placeholder="Note (optional, e.g. payment received)" />
          <button class="btn-primary w-full py-2.5" data-submit></button>
        </form>
        <div data-history></div>
      </div>`,{onClose:()=>i&&window.location.reload()}).body,p=r("form",m);function u(){r("[data-balance]",m).textContent=String(s),r("[data-balance-note]",m).textContent=`Can register ${s} more ${s===1?"business":"businesses"} (1 point each).`,c("[data-mode]",m).forEach(n=>{const d=n.dataset.mode===a;n.className=`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${d?a==="grant"?"bg-emerald-600 text-white border-emerald-600":"bg-red-600 text-white border-red-600":"border-gray-300 text-ink-600 hover:bg-gray-50"}`}),c("[data-quick]",m).forEach(n=>n.textContent=`${a==="grant"?"+":"−"}${n.dataset.quick}`),r("[data-submit]",m).textContent=`${a==="grant"?"Add":"Deduct"} ${p.amount.value||0} points`}async function f(){try{const{data:n}=await b.get(`/admin/users/${e.id}/points/transactions`,{pageSize:8});r("[data-history]",m).innerHTML=n.length?`<p class="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">Recent activity</p>
            <div class="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">${n.map(d=>{const[h,y]=W[d.type]??[d.type,"bg-gray-100 text-gray-600"];return`<div class="px-3 py-2 flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <span class="badge ${y}">${l(h)}</span>
                    ${d.note?`<p class="text-xs text-ink-500 truncate mt-1">${l(d.note)}</p>`:""}
                    <p class="text-[11px] text-ink-400">${l(j(d.createdAt))}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="font-bold text-sm ${d.amount>0?"text-emerald-700":"text-red-600"}">${d.amount>0?`+${d.amount}`:d.amount}</p>
                    <p class="text-[11px] text-ink-400">bal ${d.balanceAfter}</p>
                  </div>
                </div>`}).join("")}</div>`:""}catch{}}c("[data-mode]",m).forEach(n=>n.addEventListener("click",()=>{a=n.dataset.mode,u()})),c("[data-quick]",m).forEach(n=>n.addEventListener("click",()=>{p.amount.value=n.dataset.quick,u()})),p.amount.addEventListener("input",u),p.addEventListener("submit",async n=>{n.preventDefault();const d=Number(p.amount.value),h=r("[data-form-error]",p);if(!Number.isFinite(d)||d<=0){h.innerHTML=$("Enter a number greater than zero");return}const y=r("[data-submit]",p);y.disabled=!0,y.textContent="Saving…",h.innerHTML="";try{const{data:L}=await b.patch(`/admin/users/${e.id}/points`,{amount:a==="grant"?d:-d,note:p.note.value||void 0});s=L.points??0,i=!0,p.note.value="",f()}catch(L){h.innerHTML=$(E(L))}finally{y.disabled=!1,u()}}),u(),f()}));c("[data-business-action]").forEach(t=>t.addEventListener("click",async()=>{t.disabled=!0;try{await b.post(`/admin/businesses/${t.dataset.id}/${t.dataset.businessAction}`),window.location.reload()}catch(e){t.disabled=!1,q(e)}}));c("[data-edit-business]").forEach(t=>t.addEventListener("click",()=>{const e=JSON.parse(t.dataset.editBusiness),s=_("admin-categories")??[],a=v(`Edit ${e.name}`,`<form class="space-y-3">
        <div data-form-error></div>
        <input class="input" name="name" value="${l(e.name)}" placeholder="Business name" />
        <select class="input" name="categoryId">
          <option value="">Select category</option>
          ${s.map(o=>{var m;return`<option value="${l(o.id)}" ${o.id===((m=e.category)==null?void 0:m.id)?"selected":""}>${l(o.name)}</option>`}).join("")}
        </select>
        <div class="flex gap-3">
          <input class="input" name="city" value="${l(e.city)}" placeholder="City" />
          <input class="input" name="state" value="${l(e.state)}" placeholder="State" />
        </div>
        <input class="input" name="phone" value="${l(e.phone)}" placeholder="Phone" />
        <div class="flex gap-3">
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select class="input" name="status">${k(J,e.status)}</select>
          </div>
          <label class="w-1/2 flex items-end gap-2 pb-2.5 text-sm text-ink-700">
            <input type="checkbox" name="isVerified" ${e.isVerified?"checked":""} /> Verified business
          </label>
        </div>
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`),i=r("form",a.body);i.addEventListener("submit",o=>{o.preventDefault(),N(i,r("[data-submit]",i),"Saving…",async()=>{await b.patch(`/admin/businesses/${e.id}`,{name:i.name.value,categoryId:i.categoryId.value,city:i.city.value,state:i.state.value,phone:i.phone.value,status:i.status.value,isVerified:i.isVerified.checked}),x("Business updated.")})})}));c("[data-reassign]").forEach(t=>t.addEventListener("click",()=>{const e=JSON.parse(t.dataset.reassign),s=v(`Reassign “${e.name}”`,`<p class="text-sm text-ink-500 mb-3">Current owner: <span class="font-medium text-ink-800">${l(e.owner?`${e.owner.firstName} ${e.owner.lastName}`:"—")}</span>. Choose a new owner (business owner, dealer, or admin).</p>
      <div data-form-error></div>
      <div class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 mb-3">
        ${g("search",{size:16,className:"text-gray-400"})}
        <input data-owner-search placeholder="Search owners/dealers…" class="w-full py-2.5 text-sm focus:outline-none" />
      </div>
      <div class="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg" data-candidates></div>`),a=r("[data-candidates]",s.body),i=p=>({ADMIN:"bg-brand-50 text-brand-700",DEALER:"bg-violet-50 text-violet-700",BUSINESS_OWNER:"bg-sky-50 text-sky-700"})[p]??"bg-gray-100 text-gray-600";async function o(p){a.innerHTML=`<div class="flex items-center justify-center gap-2 py-8 text-sm text-ink-500">${g("loader-2",{size:16,className:"animate-spin"})} Searching…</div>`;try{const{data:u}=await b.get("/admin/users",{search:p||void 0}),f=u.filter(n=>{var d;return["BUSINESS_OWNER","DEALER","ADMIN"].includes(n.role)&&n.id!==((d=e.owner)==null?void 0:d.id)});a.innerHTML=f.length?f.map(n=>`<div class="p-3 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-ink-900 truncate">${l(n.firstName)} ${l(n.lastName)} <span class="badge ${i(n.role)} !px-1.5 !py-0">${R(n.role)}</span></p>
                  <p class="text-xs text-ink-500 truncate">${l(n.email??n.phone??"")}</p>
                </div>
                <button type="button" data-assign="${l(n.id)}" class="btn-primary px-3 py-1.5 text-sm shrink-0">Assign</button>
              </div>`).join(""):'<div class="p-6 text-center text-sm text-ink-500">No eligible owners found.</div>'}catch(u){a.innerHTML=$(E(u))}}let m;r("[data-owner-search]",s.body).addEventListener("input",p=>{clearTimeout(m),m=setTimeout(()=>o(p.target.value),250)}),a.addEventListener("click",async p=>{const u=p.target.closest("[data-assign]");if(u){c("[data-assign]",a).forEach(f=>f.disabled=!0),u.textContent="…";try{await b.post(`/admin/businesses/${e.id}/reassign`,{ownerId:u.dataset.assign}),x("Business reassigned.")}catch(f){r("[data-form-error]",s.body).innerHTML=$(E(f)),c("[data-assign]",a).forEach(n=>n.disabled=!1),u.textContent="Assign"}}}),o("")}));function G(t,e,s){const a=v(`${t.length} QR ${t.length===1?"board":"boards"} ready to print`,`<p class="mb-3 text-sm text-ink-600">Print these and hand them out. A shop scans one, confirms the code, and attaches it to their listing.</p>
    <div id="qr-board" class="grid grid-cols-2 gap-4"><p class="col-span-2 py-6 text-center text-sm text-ink-500">Rendering codes…</p></div>
    <button type="button" data-print class="btn-primary mt-4 w-full py-2.5">${g("printer",{size:15})} Print sheet</button>`,{onClose:s});Promise.all(t.map(i=>M(T(i),320).then(o=>({code:i,dataUrl:o})))).then(i=>{r("#qr-board",a.body).innerHTML=i.map(o=>`<div class="rounded-xl border-2 border-dashed border-gray-200 p-3 text-center">
          <p class="text-[9px] font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
          <p class="text-[11px] font-semibold text-ink-700">${l(H(e))}</p>
          <img src="${o.dataUrl}" alt="${l(o.code)}" class="mx-auto my-1.5 h-28 w-28" />
          <p class="font-mono text-xs font-bold text-ink-900">${l(o.code)}</p>
          <p class="text-[8px] uppercase tracking-wider text-ink-400">Powered by Markkito</p>
        </div>`).join("")}).catch(()=>{}),r("[data-print]",a.body).addEventListener("click",()=>window.print())}c("[data-print-codes]").forEach(t=>t.addEventListener("click",()=>G(JSON.parse(t.dataset.printCodes),t.dataset.purpose||null)));c("[data-qr-png]").forEach(t=>t.addEventListener("click",()=>M(T(t.dataset.qrPng)).then(e=>B(e,`${t.dataset.qrPng}-qr.png`)).catch(()=>I(P,"Could not generate that QR image."))));c("[data-qr-update]").forEach(t=>t.addEventListener("click",async()=>{try{await b.patch(`/admin/qr-codes/${t.dataset.qrUpdate}`,JSON.parse(t.dataset.payload)),x(t.dataset.message)}catch(e){q(e)}}));var D;(D=r("[data-generate-boards]"))==null||D.addEventListener("click",()=>{const t=v("Generate QR boards",`<form class="space-y-3">
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
    </form>`),e=r("form",t.body),s=r("[data-submit]",e);e.count.addEventListener("input",()=>s.textContent=`Generate ${e.count.value||0} boards`),e.addEventListener("submit",a=>{a.preventDefault(),N(e,s,"Generating…",async()=>{const{data:i}=await b.post("/admin/qr-codes/batch",{count:Number(e.count.value),batchLabel:e.batchLabel.value||void 0});t.close(),G(i.codes,null,()=>x(`Generated ${i.created} new QR boards.`))})})});function K(t){const e=Math.max(0,Math.floor((Date.now()-new Date(t).getTime())/1e3));if(e<60)return`${e}s ago`;const s=Math.floor(e/60);return s<60?`${s}m ago`:`${Math.floor(s/60)}h ago`}const S=(t=document)=>c("[data-time-ago]",t).forEach(e=>e.textContent=K(e.dataset.timeAgo)),w=r("[data-online-list]");w&&(S(w),setInterval(async()=>{try{const t=await fetch("/admin/online",{headers:{Accept:"text/html"},credentials:"same-origin"});if(!t.ok)return;w.innerHTML=await t.text(),r("[data-online-count]").textContent=`${t.headers.get("X-Online-Count")??0} active`,S(w)}catch{}},15e3));
