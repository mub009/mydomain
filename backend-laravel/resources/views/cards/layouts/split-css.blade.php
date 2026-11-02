.layout-split .card{max-width:760px}
.s-wrap{display:grid;grid-template-columns:1fr}
.s-panel{position:relative;overflow:hidden;background:var(--primary);color:var(--btn-text);padding:30px 22px}
.s-panel-inner{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px}
.s-panel .name{color:var(--btn-text)}
.s-panel .tagline{color:color-mix(in srgb,var(--btn-text) 80%,transparent);margin:0}
.s-panel::before{content:"";position:absolute;right:-40px;bottom:-40px;width:160px;height:160px;border-radius:50%;background:var(--accent);opacity:.35}
.s-body .about{margin-top:0}
@media (min-width:640px){.s-wrap{grid-template-columns:42% 1fr}.s-panel{padding:40px 24px;display:flex;align-items:center;justify-content:center}}
