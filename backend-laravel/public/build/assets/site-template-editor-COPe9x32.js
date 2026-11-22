import{a as n,e as d}from"./api-B_riRJ0q.js";import{p,$ as e}from"./ui-BdSpcnW7.js";const{templateId:v}=p("site-template-editor-data"),c=`/admin/site-templates/${v}`,s=e("[data-template-editor]"),r=e("[data-css]",s),h=e("[data-preview]",s),y=e("[data-status]",s),m=e("[data-error]",s);function i(t){y.textContent=t}function o(t){m.textContent=t,m.hidden=!t}function f(t){return`<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*{box-sizing:border-box}
body{margin:0}
#mk-site-root{display:block;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;line-height:1.5;background:#fff}
#mk-site-root img{max-width:100%}
${t.css}
</style></head><body><div id="mk-site-root">${t.html}</div></body></html>`}let l=null;async function u(){clearTimeout(l),l=setTimeout(async()=>{try{const{data:t}=await n.post(`${c}/preview`,{customCss:r.value});h.srcdoc=f(t),o("")}catch(t){o(d(t))}},400)}r.addEventListener("input",u);e("[data-save]",s).addEventListener("click",async()=>{i("Saving…");try{const{data:t}=await n.put(c,{customCss:r.value});i(`Saved${t.updatedAt?" · "+new Date(t.updatedAt).toLocaleString():""}`),o("")}catch(t){i(""),o(d(t))}});(async function(){try{const{data:a}=await n.get(c);r.value=a.customCss||"",i(a.updatedAt?`Last saved ${new Date(a.updatedAt).toLocaleString()}`:"Never saved")}catch(a){o(d(a))}u()})();
