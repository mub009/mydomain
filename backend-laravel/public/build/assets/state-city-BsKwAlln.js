import{a as q}from"./api-3HrlSN3j.js";import{e as o,a as L,$ as y}from"./ui-DIxCFilW.js";const f="__other";let w=null;const C=()=>w??(w=q.get("/locations").then(a=>a.data).catch(a=>{throw w=null,a})),s=(a,e=a,n=!1)=>`<option value="${o(a)}"${n?" selected":""}>${o(e)}</option>`;function H({state:a="",city:e="",required:n=!0}={}){const i=n?" required":"";return`<div class="contents" data-state-city data-state="${o(a??"")}" data-city="${o(e??"")}">
    <div class="min-w-0">
      <select name="state" class="input min-w-0" data-state-select${i}>
        ${s("","Select state")}${a?s(a,a,!0):""}
      </select>
    </div>
    <div class="min-w-0">
      <select name="city" class="input min-w-0" data-city-select${i}>
        ${s("","Select city")}${e?s(e,e,!0):""}
      </select>
      <input class="input mt-2 min-w-0" maxlength="100" placeholder="Type your city / town" data-city-other hidden />
    </div>
  </div>`}function O(a=document){L("[data-state-city]",a).forEach(async e=>{if(e.dataset.wired)return;e.dataset.wired="1";const n=y("[data-state-select]",e),i=y("[data-city-select]",e),c=y("[data-city-other]",e),S=i.required;let u;try{u=await C()}catch{return}const d=e.dataset.state||"",g=e.dataset.city||"",h=u.map(t=>t.name);n.innerHTML=s("","Select state")+(d&&!h.includes(d)?s(d,d,!0):"")+h.map(t=>s(t,t,t===d)).join("");const p=(t,l="")=>{c.hidden=!t,c.required=t&&S,t?(i.removeAttribute("name"),c.name="city",c.value=l):(c.removeAttribute("name"),i.name="city")},v=t=>{var $;const l=(($=u.find(r=>r.name===n.value))==null?void 0:$.cities)??[],m=!t||l.includes(t);i.disabled=!n.value,i.innerHTML=s("",n.value?"Select city":"Select state first")+l.map(r=>s(r,r,r===t)).join("")+s(f,"Other — type it",!m),p(!m,m?"":t)};n.addEventListener("change",()=>v("")),i.addEventListener("change",()=>{const t=i.value===f;p(t),t&&c.focus()}),v(g)})}export{O as i,H as s};
