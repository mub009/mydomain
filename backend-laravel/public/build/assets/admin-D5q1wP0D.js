import{a as b,e as y}from"./api-B_riRJ0q.js";import{i as K,a as X}from"./qr-boards-5-ugIjpZ.js";import{$ as i,a as p,o as E,e as c,i as k,b as h,p as R,f as Q}from"./ui-BdSpcnW7.js";import{i as Y}from"./searchable-select-DGJiky5z.js";import{s as Z,i as ee}from"./state-city-C9nNh1Xh.js";import{s as te,i as ae,r as se,a as x,b as T}from"./widgets-DLmycc1J.js";import"./channels-BvggbJrc.js";import"./_commonjsHelpers-CqkleIqs.js";const q=["CUSTOMER","BUSINESS_OWNER","DEALER","ADMIN"],ne=["ACTIVE","SUSPENDED","PENDING_VERIFICATION"],ie=["DRAFT","PENDING_APPROVAL","PUBLISHED","SUSPENDED"],re={MANAGE_LISTINGS:"Manage listings",MANAGE_LEADS:"Manage leads",MANAGE_BOOKINGS:"Manage bookings"},V=e=>e.replace("_"," "),A=i("[data-error]"),N=e=>T(A,y(e));te();ae();p("[data-autosubmit-check]").forEach(e=>e.addEventListener("change",()=>e.form.submit()));function D(e,t){return e.map(a=>`<option value="${a}" ${a===t?"selected":""}>${V(a)}</option>`).join("")}function z(e){return`<div data-privileges>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Dealer privileges</label>
    <div class="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      ${Object.entries(re).map(([t,a])=>`<label class="flex items-center gap-2 text-sm text-ink-700 cursor-pointer"><input type="checkbox" name="privileges" value="${t}" ${e.includes(t)?"checked":""} /> ${a}</label>`).join("")}
      <p class="text-xs text-ink-400 pt-1">Controls which dashboard features this dealer can access.</p>
    </div>
  </div>`}function de(e){const t=R("admin-pricing-groups")??[];return t.length?`<div data-when-dealer>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Pricing group</label>
    <select class="input" name="pricingGroupId">
      ${t.map(a=>{const s=a.isDefault?"":a.id,d=e?e===a.id:a.isDefault;return`<option value="${c(s)}" ${d?"selected":""}>${c(a.name)}${a.isDefault?" (default)":""}</option>`}).join("")}
    </select>
    <p class="text-xs text-ink-500 mt-1">The feature prices this dealer pays. Set them in Feature Pricing.</p>
  </div>`:""}function J(e){const t=()=>{const a=e.role.value==="DEALER";i("[data-privileges]",e).hidden=!a,p("[data-when-dealer]",e).forEach(s=>s.hidden=!a),e.phone.required=a,e.email.required=!a};e.role.addEventListener("change",t),t()}async function M(e,t,a,s){const d=t.textContent;t.disabled=!0,t.textContent=a,i("[data-form-error]",e).innerHTML="";try{await s()}catch(n){i("[data-form-error]",e).innerHTML=h(y(n)),t.disabled=!1,t.textContent=d}}var U;(U=i("[data-create-user]"))==null||U.addEventListener("click",()=>{const e=E("Add a user",`<form class="space-y-3">
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
        <select class="input" name="role">${D(q,"DEALER")}</select>
        <p class="text-xs text-ink-500 mt-1">Dealers can add and manage stores on behalf of businesses.</p>
      </div>
      ${z(["MANAGE_LISTINGS"])}
      <button class="btn-primary w-full py-2.5" data-submit>Create user</button>
    </form>`),t=i("form",e.body);J(t),t.addEventListener("submit",a=>{a.preventDefault();const s=Object.fromEntries(new FormData(t)),d=new FormData(t).getAll("privileges");M(t,i("[data-submit]",t),"Creating…",async()=>{await b.post("/admin/users",{firstName:s.firstName,lastName:s.lastName,email:s.email.trim()||null,phone:s.phone.trim()||null,password:s.password,role:s.role,...s.role==="DEALER"?{privileges:d}:{}}),x(s.role==="DEALER"?`Dealer created — they sign in with ${s.phone.trim()}.`:"User created.")})})});p("[data-edit-user]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.editUser),a=E(`Edit ${t.firstName} ${t.lastName}`,`<form class="space-y-3">
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
            <select class="input" name="role">${D(q,t.role)}</select>
          </div>
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select class="input" name="status">${D(ne,t.status)}</select>
          </div>
        </div>
        ${z(t.privileges??[])}
        ${de(t.pricingGroupId??null)}
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`),s=i("form",a.body);J(s),s.addEventListener("submit",d=>{d.preventDefault();const n=Object.fromEntries(new FormData(s)),m=new FormData(s).getAll("privileges");M(s,i("[data-submit]",s),"Saving…",async()=>{await b.patch(`/admin/users/${t.id}`,{firstName:n.firstName,lastName:n.lastName,email:n.email.trim()||null,phone:n.phone.trim()||null,role:n.role,status:n.status,...n.role==="DEALER"?{privileges:m,pricingGroupId:n.pricingGroupId||null}:{}}),x("User updated.")})})}));p("[data-reset-password]").forEach(e=>e.addEventListener("click",()=>se(JSON.parse(e.dataset.resetPassword))));const oe={ADMIN_GRANT:["Granted","bg-emerald-50 text-emerald-700"],ADMIN_DEDUCTION:["Deducted","bg-red-50 text-red-700"],BUSINESS_CREATED:["Business registered","bg-brand-50 text-brand-700"],BUSINESS_DELETED:["Business deleted (refund)","bg-gray-100 text-gray-600"],FEATURE_ADDED:["Feature added","bg-brand-50 text-brand-700"],FEATURE_REMOVED:["Feature removed (refund)","bg-gray-100 text-gray-600"],FEATURE_RENEWED:["Feature renewed","bg-amber-50 text-amber-700"]};p("[data-points]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.points);let a=t.points??0,s="grant",d=!1;const m=E(`Points — ${t.firstName} ${t.lastName}`,`<div class="space-y-4">
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
            <div class="flex gap-2 mt-2">${[5,10,25,50].map(r=>`<button type="button" data-quick="${r}" class="badge bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700"></button>`).join("")}</div>
          </div>
          <input class="input" name="note" placeholder="Note (optional, e.g. payment received)" />
          <button class="btn-primary w-full py-2.5" data-submit></button>
        </form>
        <div data-history></div>
      </div>`,{onClose:()=>d&&window.location.reload()}).body,u=i("form",m);function g(){i("[data-balance]",m).textContent=String(a),i("[data-balance-note]",m).textContent=`Can register ${a} more ${a===1?"business":"businesses"} (1 point each).`,p("[data-mode]",m).forEach(r=>{const o=r.dataset.mode===s;r.className=`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${o?s==="grant"?"bg-emerald-600 text-white border-emerald-600":"bg-red-600 text-white border-red-600":"border-gray-300 text-ink-600 hover:bg-gray-50"}`}),p("[data-quick]",m).forEach(r=>r.textContent=`${s==="grant"?"+":"−"}${r.dataset.quick}`),i("[data-submit]",m).textContent=`${s==="grant"?"Add":"Deduct"} ${u.amount.value||0} points`}async function f(){try{const{data:r}=await b.get(`/admin/users/${t.id}/points/transactions`,{pageSize:8});i("[data-history]",m).innerHTML=r.length?`<p class="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">Recent activity</p>
            <div class="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">${r.map(o=>{const[l,$]=oe[o.type]??[o.type,"bg-gray-100 text-gray-600"];return`<div class="px-3 py-2 flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <span class="badge ${$}">${c(l)}</span>
                    ${o.note?`<p class="text-xs text-ink-500 truncate mt-1">${c(o.note)}</p>`:""}
                    <p class="text-[11px] text-ink-400">${c(Q(o.createdAt))}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="font-bold text-sm ${o.amount>0?"text-emerald-700":"text-red-600"}">${o.amount>0?`+${o.amount}`:o.amount}</p>
                    <p class="text-[11px] text-ink-400">bal ${o.balanceAfter}</p>
                  </div>
                </div>`}).join("")}</div>`:""}catch{}}p("[data-mode]",m).forEach(r=>r.addEventListener("click",()=>{s=r.dataset.mode,g()})),p("[data-quick]",m).forEach(r=>r.addEventListener("click",()=>{u.amount.value=r.dataset.quick,g()})),u.amount.addEventListener("input",g),u.addEventListener("submit",async r=>{r.preventDefault();const o=Number(u.amount.value),l=i("[data-form-error]",u);if(!Number.isFinite(o)||o<=0){l.innerHTML=h("Enter a number greater than zero");return}const $=i("[data-submit]",u);$.disabled=!0,$.textContent="Saving…",l.innerHTML="";try{const{data:I}=await b.patch(`/admin/users/${t.id}/points`,{amount:s==="grant"?o:-o,note:u.note.value||void 0});a=I.points??0,d=!0,u.note.value="",f()}catch(I){l.innerHTML=h(y(I))}finally{$.disabled=!1,g()}}),g(),f()}));p("[data-business-action]").forEach(e=>e.addEventListener("click",async()=>{e.disabled=!0;try{await b.post(`/admin/businesses/${e.dataset.id}/${e.dataset.businessAction}`),window.location.reload()}catch(t){e.disabled=!1,N(t)}}));p("[data-edit-business]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.editBusiness),a=R("admin-categories")??[],s=E(`Edit ${t.name}`,`<form class="space-y-3">
        <div data-form-error></div>
        <input class="input" name="name" value="${c(t.name)}" placeholder="Business name" />
        <select class="input" name="categoryId" data-search-select data-search-placeholder="Search category…">
          <option value="">Select category</option>
          ${a.map(n=>{var m;return`<option value="${c(n.id)}" ${n.id===((m=t.category)==null?void 0:m.id)?"selected":""}>${c(n.name)}</option>`}).join("")}
        </select>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          ${Z({state:t.state,city:t.city})}
        </div>
        <input class="input" name="phone" value="${c(t.phone)}" placeholder="Phone" />
        <div class="flex gap-3">
          <div class="w-1/2">
            <label class="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select class="input" name="status">${D(ie,t.status)}</select>
          </div>
          <label class="w-1/2 flex items-end gap-2 pb-2.5 text-sm text-ink-700">
            <input type="checkbox" name="isVerified" ${t.isVerified?"checked":""} /> Verified business
          </label>
        </div>
        <button class="btn-primary w-full py-2.5" data-submit>Save changes</button>
      </form>`),d=i("form",s.body);ee(d),Y(d),d.addEventListener("submit",n=>{n.preventDefault(),M(d,i("[data-submit]",d),"Saving…",async()=>{await b.patch(`/admin/businesses/${t.id}`,{name:d.name.value,categoryId:d.categoryId.value,city:d.city.value,state:d.state.value,phone:d.phone.value,status:d.status.value,isVerified:d.isVerified.checked}),x("Business updated.")})})}));p("[data-reassign]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.reassign),a=E(`Reassign “${t.name}”`,`<p class="text-sm text-ink-500 mb-3">Current owner: <span class="font-medium text-ink-800">${c(t.owner?`${t.owner.firstName} ${t.owner.lastName}`:"—")}</span>. Choose a new owner (business owner, dealer, or admin).</p>
      <div data-form-error></div>
      <div class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 mb-3">
        ${k("search",{size:16,className:"text-gray-400"})}
        <input data-owner-search placeholder="Search owners/dealers…" class="w-full py-2.5 text-sm focus:outline-none" />
      </div>
      <div class="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg" data-candidates></div>`),s=i("[data-candidates]",a.body),d=u=>({ADMIN:"bg-brand-50 text-brand-700",DEALER:"bg-violet-50 text-violet-700",BUSINESS_OWNER:"bg-sky-50 text-sky-700"})[u]??"bg-gray-100 text-gray-600";async function n(u){s.innerHTML=`<div class="flex items-center justify-center gap-2 py-8 text-sm text-ink-500">${k("loader-2",{size:16,className:"animate-spin"})} Searching…</div>`;try{const{data:g}=await b.get("/admin/users",{search:u||void 0}),f=g.filter(r=>{var o;return["BUSINESS_OWNER","DEALER","ADMIN"].includes(r.role)&&r.id!==((o=t.owner)==null?void 0:o.id)});s.innerHTML=f.length?f.map(r=>`<div class="p-3 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-ink-900 truncate">${c(r.firstName)} ${c(r.lastName)} <span class="badge ${d(r.role)} !px-1.5 !py-0">${V(r.role)}</span></p>
                  <p class="text-xs text-ink-500 truncate">${c(r.email??r.phone??"")}</p>
                </div>
                <button type="button" data-assign="${c(r.id)}" class="btn-primary px-3 py-1.5 text-sm shrink-0">Assign</button>
              </div>`).join(""):'<div class="p-6 text-center text-sm text-ink-500">No eligible owners found.</div>'}catch(g){s.innerHTML=h(y(g))}}let m;i("[data-owner-search]",a.body).addEventListener("input",u=>{clearTimeout(m),m=setTimeout(()=>n(u.target.value),250)}),s.addEventListener("click",async u=>{const g=u.target.closest("[data-assign]");if(g){p("[data-assign]",s).forEach(f=>f.disabled=!0),g.textContent="…";try{await b.post(`/admin/businesses/${t.id}/reassign`,{ownerId:g.dataset.assign}),x("Business reassigned.")}catch(f){i("[data-form-error]",a.body).innerHTML=h(y(f)),p("[data-assign]",s).forEach(r=>r.disabled=!1),g.textContent="Assign"}}}),n("")}));K({batchUrl:"/admin/qr-codes/batch",max:500,onError:e=>T(A,e)});p("[data-qr-update]").forEach(e=>e.addEventListener("click",async()=>{try{await b.patch(`/admin/qr-codes/${e.dataset.qrUpdate}`,JSON.parse(e.dataset.payload)),x(e.dataset.message)}catch(t){N(t)}}));function le(e){const t=Math.max(0,Math.floor((Date.now()-new Date(e).getTime())/1e3));if(t<60)return`${t}s ago`;const a=Math.floor(t/60);return a<60?`${a}m ago`:`${Math.floor(a/60)}h ago`}const P=(e=document)=>p("[data-time-ago]",e).forEach(t=>t.textContent=le(t.dataset.timeAgo)),S=i("[data-online-list]");S&&(P(S),setInterval(async()=>{try{const e=await fetch("/admin/online",{headers:{Accept:"text/html"},credentials:"same-origin"});if(!e.ok)return;S.innerHTML=await e.text(),i("[data-online-count]").textContent=`${e.headers.get("X-Online-Count")??0} active`,P(S)}catch{}},15e3));async function O(e,t,a,s){T(A,"");const d=e.innerHTML;e.disabled=!0,e.textContent=t;try{const{data:n}=await a();x(s(n))}catch(n){N(n),e.disabled=!1,e.innerHTML=d}}var F;(F=i("[data-seo-run]"))==null||F.addEventListener("click",e=>O(e.currentTarget,"Syncing…",()=>b.post("/admin/seo/run"),t=>t.configured?`Synced with Google: ${t.submitted} submitted, ${t.checked} checked${t.failed?`, ${t.failed} failed`:""}.`:`Google is not connected — ${t.tracked} new page(s) tracked, nothing submitted.`));p("[data-seo-check]").forEach(e=>e.addEventListener("click",()=>O(e,"Checking…",()=>b.post(`/admin/seo/pages/${e.dataset.seoCheck}/check`),t=>t.indexStatus==="INDEXED"?"The page is on Google.":`Not on Google yet: ${t.coverageState??"no details"}.`)));p("[data-seo-submit]").forEach(e=>e.addEventListener("click",()=>O(e,"Sending…",()=>b.post(`/admin/seo/pages/${e.dataset.seoSubmit}/submit`),()=>"Sent to Google — it usually crawls within a day or two.")));p("[data-plan]").forEach(e=>{const t=i('[name="months"]',e);t.addEventListener("change",()=>p('[data-renewal-field="1"]',e).forEach(a=>a.disabled=t.value===""))});const L=(e,t)=>{const a=i(`[name="${t}"]`,e).value;return a===""?null:Number(a)};var G;(G=i("[data-feature-plans]"))==null||G.addEventListener("submit",async e=>{e.preventDefault();const t=e.currentTarget,a=i("[data-plans-saved]",t),s=i('button[type="submit"]',t),d=p("[data-plan]",t).map(n=>({feature:n.dataset.plan,points:Number(i('[name="points"]',n).value),renewalPoints:Number(i('[name="renewalPoints"]',n).value),price:L(n,"price"),commission:L(n,"commission"),renewalPrice:L(n,"renewalPrice"),renewalCommission:L(n,"renewalCommission"),months:i('[name="months"]',n).value===""?null:Number(i('[name="months"]',n).value)}));T(A,""),a.textContent="",s.disabled=!0;try{await b.put("/admin/feature-plans",{groupId:t.dataset.groupId,plans:d}),a.textContent="Pricing saved."}catch(n){N(n)}finally{s.disabled=!1}});const v=R("pricing-group-data"),C=e=>`/admin?tab=${encodeURIComponent("Feature Pricing")}${e?`&group=${e}`:""}`;function W(e,t,a,s){const d=E(e,`<form class="space-y-3">
      <div data-form-error></div>
      <input required maxlength="80" class="input" name="name" value="${c(t)}" placeholder="e.g. Gold dealers" />
      <button class="btn-primary w-full py-2.5" data-submit>${c(a)}</button>
    </form>`),n=i("form",d.body);n.name.focus(),n.addEventListener("submit",m=>{m.preventDefault(),M(n,i("[data-submit]",n),"Saving…",()=>s(n.name.value.trim()))})}var H;(H=i("[data-group-new]"))==null||H.addEventListener("click",()=>W("New pricing group","","Create group",async e=>{var a,s;const{data:t}=await b.post("/admin/pricing-groups",{name:e,copyFrom:(a=v==null?void 0:v.group)==null?void 0:a.id});x(`Created “${e}” with ${((s=v==null?void 0:v.group)==null?void 0:s.name)??"the default"} prices. Change them below, then put dealers in it from Users.`,C(t.id))}));var _;(_=i("[data-group-rename]"))==null||_.addEventListener("click",()=>W("Rename pricing group",v.group.name,"Save name",async e=>{await b.patch(`/admin/pricing-groups/${v.group.id}`,{name:e}),x("Group renamed.",C(v.group.id))}));var B;(B=i("[data-group-default]"))==null||B.addEventListener("click",async e=>{const t=e.currentTarget;t.disabled=!0;try{await b.patch(`/admin/pricing-groups/${v.group.id}`,{isDefault:!0}),x(`“${v.group.name}” is now the default: dealers in no group pay its prices.`,C(v.group.id))}catch(a){N(a),t.disabled=!1}});var j;(j=i("[data-group-delete]"))==null||j.addEventListener("click",()=>{var a;const e=((a=v.groups.find(s=>s.id===v.group.id))==null?void 0:a.dealers)??0,t=E(`Delete “${v.group.name}”?`,`<div class="space-y-3">
      <div data-form-error></div>
      <p class="text-sm text-ink-600">${e?`Its ${e} ${e===1?"dealer moves":"dealers move"} to the default group and pay its prices from now on.`:"No dealers are in this group."} Features already bought keep their end dates.</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary px-4 py-2 text-sm" data-close>Keep it</button>
        <button type="button" class="btn-primary !bg-red-600 hover:!bg-red-700 px-4 py-2 text-sm" data-confirm>Delete group</button>
      </div>
    </div>`);i("[data-confirm]",t.body).addEventListener("click",async s=>{s.currentTarget.disabled=!0;try{await b.delete(`/admin/pricing-groups/${v.group.id}`),x("Group deleted.",C(null))}catch(d){i("[data-form-error]",t.body).innerHTML=h(y(d)),s.currentTarget.disabled=!1}})});const w=e=>e==null?"—":`${e<0?"−":""}₹${Math.abs(e).toLocaleString("en-IN")}`;p("[data-commission]").forEach(e=>e.addEventListener("click",()=>{const t=JSON.parse(e.dataset.commission),a=new Date().toISOString().slice(0,10),d=E(`Commission — ${t.firstName} ${t.lastName}`,`<div class="space-y-4">
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
      </div>`,{wide:!0,onClose:()=>u&&e.hasAttribute("data-commission-reload")&&window.location.reload()}).body,n=i("[data-pay]",d);let m=0,u=!1;const g=(r,o,l="text-ink-900")=>`<div class="rounded-lg bg-gray-50 px-3 py-2"><p class="text-[10px] font-semibold uppercase tracking-wide text-ink-500">${r}</p><p class="text-lg font-bold tabular-nums ${l}">${o}</p></div>`;async function f(){try{const{data:r}=await b.get(`/admin/users/${t.id}/commission`,{pageSize:10}),o=r.summary;m=o.due,i("[data-summary]",d).innerHTML=g("Collected",w(o.collected))+g("Commission",w(o.commission))+g("Paid",w(o.paid),"text-emerald-700")+g("Due",w(o.due),o.due>0?"text-amber-700":"text-ink-900"),i("[data-payments]",d).innerHTML=r.payments.length?`<p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Payments received</p>
            <div class="max-h-52 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">${r.payments.map(l=>`<div class="flex items-center justify-between gap-2 px-3 py-2">
                  <div class="min-w-0"><p class="text-sm font-semibold text-emerald-700">${w(l.amount)}</p>
                    <p class="truncate text-[11px] text-ink-500">${c(l.paidOn)}${l.note?` · ${c(l.note)}`:""}${l.receivedBy?` · by ${c(l.receivedBy)}`:""}</p></div>
                  <button type="button" class="shrink-0 text-xs font-semibold text-red-700 hover:underline" data-remove="${c(l.id)}">Remove</button>
                </div>`).join("")}</div>`:'<p class="text-sm text-ink-500">No payments recorded yet.</p>',i("[data-sales]",d).innerHTML=r.sales.length?`<p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Latest sales and renewals</p>
            <div class="max-h-52 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">${r.sales.map(l=>`<div class="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span class="min-w-0 truncate">${c(l.business??"Deleted business")} · ${c(l.featureLabel??"All features")}${l.type==="FEATURE_RENEWED"?" (renewal)":["FEATURE_REMOVED","BUSINESS_DELETED"].includes(l.type)?" (refund)":""}</span>
                  <span class="shrink-0 tabular-nums text-ink-500">${w(l.price)} · <b class="text-ink-900">${w(l.commission)}</b></span>
                </div>`).join("")}</div>`:""}catch(r){i("[data-summary]",d).innerHTML=h(y(r))}}i("[data-pay-all]",n).addEventListener("click",()=>n.amount.value=m>0?m:""),n.addEventListener("submit",async r=>{r.preventDefault();const o=i("[data-form-error]",n),l=i("[data-submit]",n);o.innerHTML="",l.disabled=!0;try{await b.post(`/admin/users/${t.id}/commission-payments`,{amount:Number(n.amount.value),paidOn:n.paidOn.value||void 0,note:n.note.value.trim()||void 0}),n.amount.value="",n.note.value="",u=!0,await f()}catch($){o.innerHTML=h(y($))}finally{l.disabled=!1}}),i("[data-payments]",d).addEventListener("click",async r=>{const o=r.target.closest("[data-remove]");if(o){if(o.dataset.armed!=="1"){o.dataset.armed="1",o.textContent="Tap again to remove";return}o.disabled=!0;try{await b.delete(`/admin/commission-payments/${o.dataset.remove}`),u=!0,await f()}catch(l){i("[data-form-error]",n).innerHTML=h(y(l)),o.disabled=!1}}}),f()}));X();
