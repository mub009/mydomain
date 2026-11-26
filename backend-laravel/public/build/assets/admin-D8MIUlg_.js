import{a as g,e as $}from"./api-B_riRJ0q.js";import{i as ee}from"./commission-charts-CadtPEUw.js";import{r as I,b as P,d as Q,a as te}from"./channels-DDVzhx-F.js";import{$ as n,a as u,o as y,e as c,i as x,b as w,p as O,f as ae}from"./ui-BdSpcnW7.js";import{i as se}from"./searchable-select-DGJiky5z.js";import{s as ne,i as ie}from"./state-city-C9nNh1Xh.js";import{s as re,i as oe,r as de,a as f,b as C}from"./widgets-D0FAX2Ot.js";import"./_commonjsHelpers-CqkleIqs.js";const J=["CUSTOMER","BUSINESS_OWNER","DEALER","ADMIN"],le=["ACTIVE","SUSPENDED","PENDING_VERIFICATION"],ce=["DRAFT","PENDING_APPROVAL","PUBLISHED","SUSPENDED"],pe={MANAGE_LISTINGS:"Manage listings",MANAGE_LEADS:"Manage leads",MANAGE_BOOKINGS:"Manage bookings"},W=e=>e.replace("_"," "),A=n("[data-error]"),L=e=>C(A,$(e));re();oe();u("[data-autosubmit-check]").forEach(e=>e.addEventListener("change",()=>e.form.submit()));function T(e,t){return e.map(s=>`<option value="${s}" ${s===t?"selected":""}>${W(s)}</option>`).join("")}function K(e){return`<div data-privileges>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Dealer privileges</label>
    <div class="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      ${Object.entries(pe).map(([t,s])=>`<label class="flex items-center gap-2 text-sm text-ink-700 cursor-pointer"><input type="checkbox" name="privileges" value="${t}" ${e.includes(t)?"checked":""} /> ${s}</label>`).join("")}
      <p class="text-xs text-ink-400 pt-1">Controls which dashboard features this dealer can access.</p>
    </div>
  </div>`}function me(e){const t=O("admin-pricing-groups")??[];return t.length?`<div data-when-dealer>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Pricing group</label>
    <select class="input" name="pricingGroupId">
      ${t.map(s=>{const i=s.isDefault?"":s.id,r=e?e===s.id:s.isDefault;return`<option value="${c(i)}" ${r?"selected":""}>${c(s.name)}${s.isDefault?" (default)":""}</option>`}).join("")}
    </select>
    <p class="text-xs text-ink-500 mt-1">The feature prices this dealer pays. Set them in Feature Pricing.</p>
  </div>`:""}function X(e){const t=()=>{const s=e.role.value==="DEALER";n("[data-privileges]",e).hidden=!s,u("[data-when-dealer]",e).forEach(i=>i.hidden=!s),e.phone.required=s,e.email.required=!s};e.role.addEventListener("change",t),t()}async function N(e,t,s,i){const r=t.textContent;t.disabled=!0,t.textContent=s,n("[data-form-error]",e).innerHTML="";try{await i()}catch(a){n("[data-form-error]",e).innerHTML=w($(a)),t.disabled=!1,t.textContent=r}}var q;(q=n("[data-create-user]"))==null||q.addEventListener("click",()=>{const e=y("Add a user",`<form class="space-y-3">
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
      ${K(["MANAGE_LISTINGS"])}
      <button class="btn-primary w-full py-2.5" data-submit>Create user</button>
    </form>`),t=n("form",e.body);X(t),t.addEventListener("submit",s=>{s.preventDefault();const i=Object.fromEntries(new FormData(t)),r=new FormData(t).getAll("privileges");N(t,n("[data-submit]",t),"Creating…",async()=>{await g.post("/admin/users",{firstName:i.firstName,lastName:i.lastName,email:i.email.trim()||null,phone:i.phone.trim()||null,password:i.password,role:i.role,...i.role==="DEALER"?{privileges:r}:{}}),f(i.role==="DEALER"?`Dealer created — they sign in with ${i.phone.trim()}.`:"User created.")})})});u("[data-edit-user]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.editUser),s=y(`Edit ${t.firstName} ${t.lastName}`,`<form class="space-y-3">
        <div data-form-error></div>
        <div class="flex gap-3">
          <input class="input" name="firstName" value="${c(t.firstName)}" placeholder="First name" />
          <input class="input" name="lastName" value="${c(t.lastName)}" placeholder="Last name" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-ink-700 mb-1">Mobile number <span data-when-dealer>(login username)</span></label>
          <input class="input" type="tel" name="phone" inputmode="numeric" maxlength="14" value="${c(t.phone??"")}" placeholder="9876543210" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-ink-700 mb-1">Email <span data-when-dealer>(optional)</span></label>
          <input class="input" type="email" name="email" value="${c(t.email??"")}" placeholder="name@example.com" />
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
        ${K(t.privileges??[])}
        ${me(t.pricingGroupId??null)}
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`),i=n("form",s.body);X(i),i.addEventListener("submit",r=>{r.preventDefault();const a=Object.fromEntries(new FormData(i)),l=new FormData(i).getAll("privileges");N(i,n("[data-submit]",i),"Saving…",async()=>{await g.patch(`/admin/users/${t.id}`,{firstName:a.firstName,lastName:a.lastName,email:a.email.trim()||null,phone:a.phone.trim()||null,role:a.role,status:a.status,...a.role==="DEALER"?{privileges:l,pricingGroupId:a.pricingGroupId||null}:{}}),f("User updated.")})})}));u("[data-reset-password]").forEach(e=>e.addEventListener("click",()=>de(JSON.parse(e.dataset.resetPassword))));const ue={ADMIN_GRANT:["Granted","bg-emerald-50 text-emerald-700"],ADMIN_DEDUCTION:["Deducted","bg-red-50 text-red-700"],BUSINESS_CREATED:["Business registered","bg-brand-50 text-brand-700"],BUSINESS_DELETED:["Business deleted (refund)","bg-gray-100 text-gray-600"],FEATURE_ADDED:["Feature added","bg-brand-50 text-brand-700"],FEATURE_REMOVED:["Feature removed (refund)","bg-gray-100 text-gray-600"],FEATURE_RENEWED:["Feature renewed","bg-amber-50 text-amber-700"]};u("[data-points]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.points);let s=t.points??0,i="grant",r=!1;const l=y(`Points — ${t.firstName} ${t.lastName}`,`<div class="space-y-4">
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
      </div>`,{onClose:()=>r&&window.location.reload()}).body,m=n("form",l);function b(){n("[data-balance]",l).textContent=String(s),n("[data-balance-note]",l).textContent=`Can register ${s} more ${s===1?"business":"businesses"} (1 point each).`,u("[data-mode]",l).forEach(o=>{const d=o.dataset.mode===i;o.className=`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${d?i==="grant"?"bg-emerald-600 text-white border-emerald-600":"bg-red-600 text-white border-red-600":"border-gray-300 text-ink-600 hover:bg-gray-50"}`}),u("[data-quick]",l).forEach(o=>o.textContent=`${i==="grant"?"+":"−"}${o.dataset.quick}`),n("[data-submit]",l).textContent=`${i==="grant"?"Add":"Deduct"} ${m.amount.value||0} points`}async function h(){try{const{data:o}=await g.get(`/admin/users/${t.id}/points/transactions`,{pageSize:8});n("[data-history]",l).innerHTML=o.length?`<p class="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">Recent activity</p>
            <div class="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">${o.map(d=>{const[p,E]=ue[d.type]??[d.type,"bg-gray-100 text-gray-600"];return`<div class="px-3 py-2 flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <span class="badge ${E}">${c(p)}</span>
                    ${d.note?`<p class="text-xs text-ink-500 truncate mt-1">${c(d.note)}</p>`:""}
                    <p class="text-[11px] text-ink-400">${c(ae(d.createdAt))}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="font-bold text-sm ${d.amount>0?"text-emerald-700":"text-red-600"}">${d.amount>0?`+${d.amount}`:d.amount}</p>
                    <p class="text-[11px] text-ink-400">bal ${d.balanceAfter}</p>
                  </div>
                </div>`}).join("")}</div>`:""}catch{}}u("[data-mode]",l).forEach(o=>o.addEventListener("click",()=>{i=o.dataset.mode,b()})),u("[data-quick]",l).forEach(o=>o.addEventListener("click",()=>{m.amount.value=o.dataset.quick,b()})),m.amount.addEventListener("input",b),m.addEventListener("submit",async o=>{o.preventDefault();const d=Number(m.amount.value),p=n("[data-form-error]",m);if(!Number.isFinite(d)||d<=0){p.innerHTML=w("Enter a number greater than zero");return}const E=n("[data-submit]",m);E.disabled=!0,E.textContent="Saving…",p.innerHTML="";try{const{data:R}=await g.patch(`/admin/users/${t.id}/points`,{amount:i==="grant"?d:-d,note:m.note.value||void 0});s=R.points??0,r=!0,m.note.value="",h()}catch(R){p.innerHTML=w($(R))}finally{E.disabled=!1,b()}}),b(),h()}));u("[data-business-action]").forEach(e=>e.addEventListener("click",async()=>{e.disabled=!0;try{await g.post(`/admin/businesses/${e.dataset.id}/${e.dataset.businessAction}`),window.location.reload()}catch(t){e.disabled=!1,L(t)}}));u("[data-edit-business]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.editBusiness),s=O("admin-categories")??[],i=y(`Edit ${t.name}`,`<form class="space-y-3">
        <div data-form-error></div>
        <input class="input" name="name" value="${c(t.name)}" placeholder="Business name" />
        <select class="input" name="categoryId" data-search-select data-search-placeholder="Search category…">
          <option value="">Select category</option>
          ${s.map(a=>{var l;return`<option value="${c(a.id)}" ${a.id===((l=t.category)==null?void 0:l.id)?"selected":""}>${c(a.name)}</option>`}).join("")}
        </select>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          ${ne({state:t.state,city:t.city})}
        </div>
        <input class="input" name="phone" value="${c(t.phone)}" placeholder="Phone" />
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
      </form>`),r=n("form",i.body);ie(r),se(r),r.addEventListener("submit",a=>{a.preventDefault(),N(r,n("[data-submit]",r),"Saving…",async()=>{await g.patch(`/admin/businesses/${t.id}`,{name:r.name.value,categoryId:r.categoryId.value,city:r.city.value,state:r.state.value,phone:r.phone.value,status:r.status.value,isVerified:r.isVerified.checked}),f("Business updated.")})})}));u("[data-reassign]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.reassign),s=y(`Reassign “${t.name}”`,`<p class="text-sm text-ink-500 mb-3">Current owner: <span class="font-medium text-ink-800">${c(t.owner?`${t.owner.firstName} ${t.owner.lastName}`:"—")}</span>. Choose a new owner (business owner, dealer, or admin).</p>
      <div data-form-error></div>
      <div class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 mb-3">
        ${x("search",{size:16,className:"text-gray-400"})}
        <input data-owner-search placeholder="Search owners/dealers…" class="w-full py-2.5 text-sm focus:outline-none" />
      </div>
      <div class="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg" data-candidates></div>`),i=n("[data-candidates]",s.body),r=m=>({ADMIN:"bg-brand-50 text-brand-700",DEALER:"bg-violet-50 text-violet-700",BUSINESS_OWNER:"bg-sky-50 text-sky-700"})[m]??"bg-gray-100 text-gray-600";async function a(m){i.innerHTML=`<div class="flex items-center justify-center gap-2 py-8 text-sm text-ink-500">${x("loader-2",{size:16,className:"animate-spin"})} Searching…</div>`;try{const{data:b}=await g.get("/admin/users",{search:m||void 0}),h=b.filter(o=>{var d;return["BUSINESS_OWNER","DEALER","ADMIN"].includes(o.role)&&o.id!==((d=t.owner)==null?void 0:d.id)});i.innerHTML=h.length?h.map(o=>`<div class="p-3 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-ink-900 truncate">${c(o.firstName)} ${c(o.lastName)} <span class="badge ${r(o.role)} !px-1.5 !py-0">${W(o.role)}</span></p>
                  <p class="text-xs text-ink-500 truncate">${c(o.email??o.phone??"")}</p>
                </div>
                <button type="button" data-assign="${c(o.id)}" class="btn-primary px-3 py-1.5 text-sm shrink-0">Assign</button>
              </div>`).join(""):'<div class="p-6 text-center text-sm text-ink-500">No eligible owners found.</div>'}catch(b){i.innerHTML=w($(b))}}let l;n("[data-owner-search]",s.body).addEventListener("input",m=>{clearTimeout(l),l=setTimeout(()=>a(m.target.value),250)}),i.addEventListener("click",async m=>{const b=m.target.closest("[data-assign]");if(b){u("[data-assign]",i).forEach(h=>h.disabled=!0),b.textContent="…";try{await g.post(`/admin/businesses/${t.id}/reassign`,{ownerId:b.dataset.assign}),f("Business reassigned.")}catch(h){n("[data-form-error]",s.body).innerHTML=w($(h)),u("[data-assign]",i).forEach(o=>o.disabled=!1),b.textContent="Assign"}}}),a("")}));function Z(e,t,s){const i=y(`${e.length} QR ${e.length===1?"board":"boards"} ready to print`,`<p class="mb-3 text-sm text-ink-600">Print these and hand them out. Each board waits until it is attached to a shop; then a scan opens what it was set to (Google review, AI review, social media…).</p>
    <a href="/admin/qr-codes.zip?codes=${encodeURIComponent(e.join(","))}" class="btn-secondary mb-3 w-full py-2.5" data-download-all>${x("download",{size:15})} Download all (ZIP of ${e.length} QR ${e.length===1?"image":"images"})</a>
    <div class="mb-3 rounded-xl border border-green-200 bg-green-50 p-3 print:hidden" data-share-box>
      <p class="text-xs font-semibold text-green-900">Share these QR codes as a link</p>
      <p class="mb-2 text-[11px] text-green-800">Whoever opens the link sees every QR and can download each one.</p>
      <input class="input mb-2 bg-white font-mono text-[11px]" readonly data-share-url value="Making the link…" />
      <div class="grid grid-cols-3 gap-2">
        <a class="btn-primary !bg-green-600 py-2 text-xs hover:!bg-green-700" target="_blank" rel="noopener" data-share-whatsapp>${x("share-2",{size:13})} WhatsApp</a>
        <button type="button" class="btn-secondary py-2 text-xs" data-share-copy>${x("copy",{size:13})} <span>Copy link</span></button>
        <a class="btn-secondary py-2 text-xs" target="_blank" rel="noopener" data-share-open>${x("external-link",{size:13})} Open</a>
      </div>
    </div>
    <div id="qr-board" class="grid grid-cols-2 gap-4"><p class="col-span-2 py-6 text-center text-sm text-ink-500">Rendering codes…</p></div>
    <button type="button" data-print class="btn-primary mt-4 w-full py-2.5">${x("printer",{size:15})} Print sheet</button>`,{onClose:s}),r=n("[data-share-box]",i.body);fetch(`/admin/qr-codes/share-link?codes=${encodeURIComponent(e.join(","))}`,{headers:{Accept:"application/json"}}).then(a=>a.ok?a.json():Promise.reject(a)).then(({url:a})=>{n("[data-share-url]",r).value=a;const l=`Markkito QR boards (${e.length}): open the link to see and download each QR code ${a}`;n("[data-share-whatsapp]",r).href=`https://wa.me/?text=${encodeURIComponent(l)}`,n("[data-share-open]",r).href=a,n("[data-share-copy]",r).addEventListener("click",async m=>{const b=n("span",m.currentTarget);try{await navigator.clipboard.writeText(a)}catch{n("[data-share-url]",r).select(),document.execCommand("copy")}b.textContent="Copied",setTimeout(()=>b.textContent="Copy link",2e3)})}).catch(()=>n("[data-share-url]",r).value="Couldn't make the link — try again."),Promise.all(e.map(a=>I(P(a),320).then(l=>({code:a,dataUrl:l})))).then(a=>{n("#qr-board",i.body).innerHTML=a.map(l=>`<div class="rounded-xl border-2 border-dashed border-gray-200 p-3 text-center">
          <p class="text-[9px] font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
          <p class="text-[11px] font-semibold text-ink-700">${c(te(t))}</p>
          <img src="${l.dataUrl}" alt="${c(l.code)}" class="mx-auto my-1.5 h-28 w-28" />
          <p class="font-mono text-xs font-bold text-ink-900">${c(l.code)}</p>
          <p class="text-[8px] uppercase tracking-wider text-ink-400">Powered by Markkito</p>
          <button type="button" class="mt-1.5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 print:hidden" data-download-one="${c(l.code)}">${x("download",{size:12})} Download</button>
        </div>`).join(""),u("[data-download-one]",i.body).forEach(l=>l.addEventListener("click",()=>I(P(l.dataset.downloadOne)).then(m=>Q(m,`${l.dataset.downloadOne}-qr.png`)).catch(()=>{})))}).catch(()=>{}),n("[data-print]",i.body).addEventListener("click",()=>window.print())}u("[data-print-codes]").forEach(e=>e.addEventListener("click",()=>Z(JSON.parse(e.dataset.printCodes),e.dataset.purpose||null)));u("[data-qr-png]").forEach(e=>e.addEventListener("click",()=>I(P(e.dataset.qrPng)).then(t=>Q(t,`${e.dataset.qrPng}-qr.png`)).catch(()=>C(A,"Could not generate that QR image."))));u("[data-qr-update]").forEach(e=>e.addEventListener("click",async()=>{try{await g.patch(`/admin/qr-codes/${e.dataset.qrUpdate}`,JSON.parse(e.dataset.payload)),f(e.dataset.message)}catch(t){L(t)}}));var F;(F=n("[data-generate-boards]"))==null||F.addEventListener("click",()=>{const e=y("Generate QR boards",`<form class="space-y-3">
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
    </form>`),t=n("form",e.body),s=n("[data-submit]",t);t.count.addEventListener("input",()=>s.textContent=`Generate ${t.count.value||0} boards`),t.addEventListener("submit",i=>{i.preventDefault(),N(t,s,"Generating…",async()=>{const{data:r}=await g.post("/admin/qr-codes/batch",{count:Number(t.count.value),batchLabel:t.batchLabel.value||void 0});e.close(),Z(r.codes,null,()=>f(`Generated ${r.created} new QR boards.`))})})});function be(e){const t=Math.max(0,Math.floor((Date.now()-new Date(e).getTime())/1e3));if(t<60)return`${t}s ago`;const s=Math.floor(t/60);return s<60?`${s}m ago`:`${Math.floor(s/60)}h ago`}const G=(e=document)=>u("[data-time-ago]",e).forEach(t=>t.textContent=be(t.dataset.timeAgo)),S=n("[data-online-list]");S&&(G(S),setInterval(async()=>{try{const e=await fetch("/admin/online",{headers:{Accept:"text/html"},credentials:"same-origin"});if(!e.ok)return;S.innerHTML=await e.text(),n("[data-online-count]").textContent=`${e.headers.get("X-Online-Count")??0} active`,G(S)}catch{}},15e3));async function U(e,t,s,i){C(A,"");const r=e.innerHTML;e.disabled=!0,e.textContent=t;try{const{data:a}=await s();f(i(a))}catch(a){L(a),e.disabled=!1,e.innerHTML=r}}var H;(H=n("[data-seo-run]"))==null||H.addEventListener("click",e=>U(e.currentTarget,"Syncing…",()=>g.post("/admin/seo/run"),t=>t.configured?`Synced with Google: ${t.submitted} submitted, ${t.checked} checked${t.failed?`, ${t.failed} failed`:""}.`:`Google is not connected — ${t.tracked} new page(s) tracked, nothing submitted.`));u("[data-seo-check]").forEach(e=>e.addEventListener("click",()=>U(e,"Checking…",()=>g.post(`/admin/seo/pages/${e.dataset.seoCheck}/check`),t=>t.indexStatus==="INDEXED"?"The page is on Google.":`Not on Google yet: ${t.coverageState??"no details"}.`)));u("[data-seo-submit]").forEach(e=>e.addEventListener("click",()=>U(e,"Sending…",()=>g.post(`/admin/seo/pages/${e.dataset.seoSubmit}/submit`),()=>"Sent to Google — it usually crawls within a day or two.")));u("[data-plan]").forEach(e=>{const t=n('[name="months"]',e);t.addEventListener("change",()=>u('[data-renewal-field="1"]',e).forEach(s=>s.disabled=t.value===""))});const D=(e,t)=>{const s=n(`[name="${t}"]`,e).value;return s===""?null:Number(s)};var j;(j=n("[data-feature-plans]"))==null||j.addEventListener("submit",async e=>{e.preventDefault();const t=e.currentTarget,s=n("[data-plans-saved]",t),i=n('button[type="submit"]',t),r=u("[data-plan]",t).map(a=>({feature:a.dataset.plan,points:Number(n('[name="points"]',a).value),renewalPoints:Number(n('[name="renewalPoints"]',a).value),price:D(a,"price"),commission:D(a,"commission"),renewalPrice:D(a,"renewalPrice"),renewalCommission:D(a,"renewalCommission"),months:n('[name="months"]',a).value===""?null:Number(n('[name="months"]',a).value)}));C(A,""),s.textContent="",i.disabled=!0;try{await g.put("/admin/feature-plans",{groupId:t.dataset.groupId,plans:r}),s.textContent="Pricing saved."}catch(a){L(a)}finally{i.disabled=!1}});const v=O("pricing-group-data"),M=e=>`/admin?tab=${encodeURIComponent("Feature Pricing")}${e?`&group=${e}`:""}`;function Y(e,t,s,i){const r=y(e,`<form class="space-y-3">
      <div data-form-error></div>
      <input required maxlength="80" class="input" name="name" value="${c(t)}" placeholder="e.g. Gold dealers" />
      <button class="btn-primary w-full py-2.5" data-submit>${c(s)}</button>
    </form>`),a=n("form",r.body);a.name.focus(),a.addEventListener("submit",l=>{l.preventDefault(),N(a,n("[data-submit]",a),"Saving…",()=>i(a.name.value.trim()))})}var _;(_=n("[data-group-new]"))==null||_.addEventListener("click",()=>Y("New pricing group","","Create group",async e=>{var s,i;const{data:t}=await g.post("/admin/pricing-groups",{name:e,copyFrom:(s=v==null?void 0:v.group)==null?void 0:s.id});f(`Created “${e}” with ${((i=v==null?void 0:v.group)==null?void 0:i.name)??"the default"} prices. Change them below, then put dealers in it from Users.`,M(t.id))}));var B;(B=n("[data-group-rename]"))==null||B.addEventListener("click",()=>Y("Rename pricing group",v.group.name,"Save name",async e=>{await g.patch(`/admin/pricing-groups/${v.group.id}`,{name:e}),f("Group renamed.",M(v.group.id))}));var z;(z=n("[data-group-default]"))==null||z.addEventListener("click",async e=>{const t=e.currentTarget;t.disabled=!0;try{await g.patch(`/admin/pricing-groups/${v.group.id}`,{isDefault:!0}),f(`“${v.group.name}” is now the default: dealers in no group pay its prices.`,M(v.group.id))}catch(s){L(s),t.disabled=!1}});var V;(V=n("[data-group-delete]"))==null||V.addEventListener("click",()=>{var s;const e=((s=v.groups.find(i=>i.id===v.group.id))==null?void 0:s.dealers)??0,t=y(`Delete “${v.group.name}”?`,`<div class="space-y-3">
      <div data-form-error></div>
      <p class="text-sm text-ink-600">${e?`Its ${e} ${e===1?"dealer moves":"dealers move"} to the default group and pay its prices from now on.`:"No dealers are in this group."} Features already bought keep their end dates.</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary px-4 py-2 text-sm" data-close>Keep it</button>
        <button type="button" class="btn-primary !bg-red-600 hover:!bg-red-700 px-4 py-2 text-sm" data-confirm>Delete group</button>
      </div>
    </div>`);n("[data-confirm]",t.body).addEventListener("click",async i=>{i.currentTarget.disabled=!0;try{await g.delete(`/admin/pricing-groups/${v.group.id}`),f("Group deleted.",M(null))}catch(r){n("[data-form-error]",t.body).innerHTML=w($(r)),i.currentTarget.disabled=!1}})});const k=e=>e==null?"—":`${e<0?"−":""}₹${Math.abs(e).toLocaleString("en-IN")}`;u("[data-commission]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.commission),s=new Date().toISOString().slice(0,10),r=y(`Commission — ${t.firstName} ${t.lastName}`,`<div class="space-y-4">
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4" data-summary></div>
        <form class="space-y-2 rounded-xl border border-gray-200 p-3" data-pay>
          <div data-form-error></div>
          <p class="text-sm font-semibold text-ink-900">Record a payment received</p>
          <div class="flex flex-wrap gap-2">
            <div class="relative w-36"><span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">₹</span>
              <input required type="number" min="1" step="1" class="input pl-7" name="amount" placeholder="Amount" /></div>
            <input type="date" class="input w-40" name="paidOn" value="${s}" max="${s}" />
            <input class="input min-w-0 flex-1" name="note" maxlength="300" placeholder="Note (optional, e.g. UPI ref)" />
          </div>
          <div class="flex items-center justify-between gap-2">
            <button type="button" class="text-xs font-semibold text-brand-700 hover:underline" data-pay-all>Fill in the full amount due</button>
            <button class="btn-primary px-4 py-2 text-sm" data-submit>Record payment</button>
          </div>
        </form>
        <div data-payments></div>
        <div data-sales></div>
      </div>`,{wide:!0,onClose:()=>m&&e.hasAttribute("data-commission-reload")&&window.location.reload()}).body,a=n("[data-pay]",r);let l=0,m=!1;const b=(o,d,p="text-ink-900")=>`<div class="rounded-lg bg-gray-50 px-3 py-2"><p class="text-[10px] font-semibold uppercase tracking-wide text-ink-500">${o}</p><p class="text-lg font-bold tabular-nums ${p}">${d}</p></div>`;async function h(){try{const{data:o}=await g.get(`/admin/users/${t.id}/commission`,{pageSize:10}),d=o.summary;l=d.due,n("[data-summary]",r).innerHTML=b("Collected",k(d.collected))+b("Commission",k(d.commission))+b("Paid",k(d.paid),"text-emerald-700")+b("Due",k(d.due),d.due>0?"text-amber-700":"text-ink-900"),n("[data-payments]",r).innerHTML=o.payments.length?`<p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Payments received</p>
            <div class="max-h-52 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">${o.payments.map(p=>`<div class="flex items-center justify-between gap-2 px-3 py-2">
                  <div class="min-w-0"><p class="text-sm font-semibold text-emerald-700">${k(p.amount)}</p>
                    <p class="truncate text-[11px] text-ink-500">${c(p.paidOn)}${p.note?` · ${c(p.note)}`:""}${p.receivedBy?` · by ${c(p.receivedBy)}`:""}</p></div>
                  <button type="button" class="shrink-0 text-xs font-semibold text-red-700 hover:underline" data-remove="${c(p.id)}">Remove</button>
                </div>`).join("")}</div>`:'<p class="text-sm text-ink-500">No payments recorded yet.</p>',n("[data-sales]",r).innerHTML=o.sales.length?`<p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Latest sales and renewals</p>
            <div class="max-h-52 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">${o.sales.map(p=>`<div class="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span class="min-w-0 truncate">${c(p.business??"Deleted business")} · ${c(p.featureLabel??"All features")}${p.type==="FEATURE_RENEWED"?" (renewal)":["FEATURE_REMOVED","BUSINESS_DELETED"].includes(p.type)?" (refund)":""}</span>
                  <span class="shrink-0 tabular-nums text-ink-500">${k(p.price)} · <b class="text-ink-900">${k(p.commission)}</b></span>
                </div>`).join("")}</div>`:""}catch(o){n("[data-summary]",r).innerHTML=w($(o))}}n("[data-pay-all]",a).addEventListener("click",()=>a.amount.value=l>0?l:""),a.addEventListener("submit",async o=>{o.preventDefault();const d=n("[data-form-error]",a),p=n("[data-submit]",a);d.innerHTML="",p.disabled=!0;try{await g.post(`/admin/users/${t.id}/commission-payments`,{amount:Number(a.amount.value),paidOn:a.paidOn.value||void 0,note:a.note.value.trim()||void 0}),a.amount.value="",a.note.value="",m=!0,await h()}catch(E){d.innerHTML=w($(E))}finally{p.disabled=!1}}),n("[data-payments]",r).addEventListener("click",async o=>{const d=o.target.closest("[data-remove]");if(d){if(d.dataset.armed!=="1"){d.dataset.armed="1",d.textContent="Tap again to remove";return}d.disabled=!0;try{await g.delete(`/admin/commission-payments/${d.dataset.remove}`),m=!0,await h()}catch(p){n("[data-form-error]",a).innerHTML=w($(p)),d.disabled=!1}}}),h()}));ee();
