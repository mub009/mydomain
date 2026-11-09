import{a as C}from"./api-B_riRJ0q.js";import{s as f}from"./searchable-select-e7cVyyeI.js";import{e as d,a as E,$ as h}from"./ui-D3VsD3yO.js";const S="__other";let w=null;const T=()=>w??(w=C.get("/locations").then(a=>a.data).catch(a=>{throw w=null,a})),c=(a,e=a,s=!1)=>`<option value="${d(a)}"${s?" selected":""}>${d(e)}</option>`;function A({state:a="",city:e="",required:s=!0}={}){const i=s?" required":"";return`<div class="contents" data-state-city data-state="${d(a??"")}" data-city="${d(e??"")}">
    <div class="min-w-0">
      <select name="state" class="input min-w-0" data-state-select${i}>
        ${c("","Select state")}${a?c(a,a,!0):""}
      </select>
    </div>
    <div class="min-w-0">
      <select name="city" class="input min-w-0" data-city-select${i}>
        ${c("","Select city")}${e?c(e,e,!0):""}
      </select>
      <input class="input mt-2 min-w-0" maxlength="100" placeholder="Type your city / town" data-city-other hidden />
    </div>
  </div>`}function M(a=document){E("[data-state-city]",a).forEach(async e=>{if(e.dataset.wired)return;e.dataset.wired="1";const s=h("[data-state-select]",e),i=h("[data-city-select]",e),n=h("[data-city-other]",e),g=i.required;let u;try{u=await T()}catch{return}const r=e.dataset.state||"",q=e.dataset.city||"",p=u.map(t=>t.name);s.innerHTML=c("","Select state")+(r&&!p.includes(r)?c(r,r,!0):"")+p.map(t=>c(t,t,t===r)).join(""),f(s,{placeholder:"Search state…"});const L=f(i,{placeholder:"Search city…"}),y=(t,o="")=>{n.hidden=!t,n.required=t&&g,t?(i.removeAttribute("name"),n.name="city",n.value=o):(n.removeAttribute("name"),i.name="city")},v=t=>{var $;const o=(($=u.find(l=>l.name===s.value))==null?void 0:$.cities)??[],m=!t||o.includes(t);i.disabled=!s.value,i.innerHTML=c("",s.value?"Select city":"Select state first")+o.map(l=>c(l,l,l===t)).join("")+`<option value="${S}" data-pinned="1"${m?"":" selected"}>Other — type it</option>`,y(!m,m?"":t),L.refresh()};s.addEventListener("change",()=>v("")),i.addEventListener("change",()=>{const t=i.value===S;y(t),t&&n.focus()}),v(q)})}export{M as i,A as s};
