import{o as s}from"./ui-ZjACusSH.js";function c(d,o,{footer:i=""}={}){const e=s(d,`<div class="space-y-3">
      <div class="flex justify-center gap-1 text-xs font-semibold" data-frame-sizes>
        <button type="button" class="rounded-full bg-ink-900 px-3 py-1 text-white" data-size="phone">Phone</button>
        <button type="button" class="rounded-full bg-gray-100 px-3 py-1 text-ink-700" data-size="wide">Wide screen</button>
      </div>
      <div class="flex justify-center">
        <iframe sandbox="" title="Card preview" class="h-[640px] w-[390px] max-w-full rounded-[28px] border-[6px] border-ink-900 bg-white shadow-lg transition-all" data-preview-frame></iframe>
      </div>
      ${i}
    </div>`,{wide:!0}),a=e.body.querySelector("[data-preview-frame]");return a.srcdoc=o,e.body.querySelectorAll("[data-size]").forEach(t=>t.addEventListener("click",()=>{const l=t.dataset.size==="wide";a.className=l?"h-[600px] w-full rounded-xl border border-gray-200 bg-white transition-all":"h-[640px] w-[390px] max-w-full rounded-[28px] border-[6px] border-ink-900 bg-white shadow-lg transition-all",e.body.querySelectorAll("[data-size]").forEach(r=>{r.className=`rounded-full px-3 py-1 ${r===t?"bg-ink-900 text-white":"bg-gray-100 text-ink-700"}`})})),e}export{c};
