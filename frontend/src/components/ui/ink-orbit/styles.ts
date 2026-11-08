/*
 * The component's scoped stylesheet, injected by `InkOrbitFeatures` in a
 * <style> tag. Every rule hangs off `.ib-root`, so nothing leaks into the app.
 *
 * Three palettes: light (default), dark (`data-theme="dark"`), and BRAND
 * (`data-tone="brand"`) — Tizello's green, read from the design-system brand
 * ramp (`--color-brand-*` in globals.css) so it moves with the tokens. Brand
 * is theme-invariant on purpose: the auth panel it sits on is green in both
 * themes. Its page is transparent so the panel's own gradient shows through.
 * Each token carries its hex as a fallback: Tailwind only emits a theme
 * variable it sees used, and it does not scan this string.
 */
export const IB_CSS = `
.ib-root{--ib-page:#efefef;--ib-hatch:rgba(0,0,0,.06);--ib-paper:#fbfbfb;--ib-card:#f4f4f4;--ib-raise:#ffffff;--ib-ink:#151515;--ib-soft:#3d3d3d;--ib-muted:#7b7b7b;--ib-faint:#a8a8a8;--ib-line:#e2e2e2;--ib-line-strong:#cfcfcf;--ib-bracket:#c9c9c9;--ib-inv:#161616;--ib-inv-ink:#f5f5f5;--ib-live:#22c55e;--ib-shadow:0 1px 2px rgba(0,0,0,.05),0 8px 24px -12px rgba(0,0,0,.12);--ib-sans:var(--font-sans,"Inter"),ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--ib-mono:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;position:relative;width:100%;box-sizing:border-box;background-color:var(--ib-page);background-image:repeating-linear-gradient(135deg,var(--ib-hatch) 0 1px,transparent 1px 10px);color:var(--ib-ink);font-family:var(--ib-sans);font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased;padding:28px clamp(10px,2.4vw,28px);transition:background-color .45s ease,color .45s ease}
.ib-root[data-theme="dark"]{--ib-page:#0b0b0b;--ib-hatch:rgba(255,255,255,.05);--ib-paper:#121212;--ib-card:#181818;--ib-raise:#1e1e1e;--ib-ink:#eeeeee;--ib-soft:#c9c9c9;--ib-muted:#8d8d8d;--ib-faint:#5d5d5d;--ib-line:#262626;--ib-line-strong:#363636;--ib-bracket:#444444;--ib-inv:#efefef;--ib-inv-ink:#121212;--ib-shadow:0 1px 2px rgba(0,0,0,.4),0 10px 30px -14px rgba(0,0,0,.7)}
.ib-root[data-tone="brand"]{--ib-page:transparent;--ib-hatch:rgba(255,255,255,.06);--ib-paper:color-mix(in oklab,var(--color-brand-950,#062b18) 55%,transparent);--ib-card:var(--color-brand-900,#0b4527);--ib-raise:var(--color-brand-800,#106138);--ib-ink:var(--color-brand-50,#e8faf0);--ib-soft:var(--color-brand-100,#c9f3de);--ib-muted:var(--color-brand-200,#9ce8c4);--ib-faint:var(--color-brand-300,#6bdba7);--ib-line:color-mix(in oklab,var(--color-brand-50,#e8faf0) 14%,transparent);--ib-line-strong:color-mix(in oklab,var(--color-brand-50,#e8faf0) 26%,transparent);--ib-bracket:var(--color-brand-300,#6bdba7);--ib-inv:var(--color-brand-300,#6bdba7);--ib-inv-ink:var(--color-brand-950,#062b18);--ib-live:var(--color-brand-300,#6bdba7);--ib-shadow:0 1px 2px rgba(0,0,0,.25),0 12px 32px -14px rgba(0,0,0,.55)}
.ib-root[data-tone="brand"] .ib-sec{backdrop-filter:blur(6px)}
.ib-root :where(*){box-sizing:border-box}
.ib-root :focus-visible{outline:2px solid var(--ib-ink);outline-offset:2px}
.ib-root :where(svg){display:block;max-width:none;flex:none}
.ib-root :where(h2,h3,p){margin:0;padding:0;font-size:inherit;font-weight:inherit}
.ib-shell{width:100%;max-width:1180px;margin:0 auto;container-type:inline-size}
.ib-sec{position:relative;background:var(--ib-paper);border:1px solid var(--ib-line);padding:clamp(28px,5cqw,64px) clamp(16px,4cqw,44px);transition:background-color .45s,border-color .45s}
.ib-reveal{opacity:0;transform:translateY(18px);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1)}
.ib-reveal[data-in="true"]{opacity:1;transform:none}
.ib-head{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;margin-bottom:clamp(24px,4cqw,44px)}
.ib-tag{display:inline-block;padding:4px 10px;font-size:11.5px;letter-spacing:.02em;color:var(--ib-soft);background:var(--ib-card);border:1px solid var(--ib-line)}
.ib-h2{font-size:clamp(26px,4.2cqw,42px);line-height:1.08;letter-spacing:-.025em;font-weight:500}
.ib-h2>span{display:block}
.ib-muted{color:var(--ib-faint)}
.ib-frame{position:relative}
.ib-c{position:absolute;width:12px;height:12px;border-color:var(--ib-bracket);border-style:solid;border-width:0;pointer-events:none;transition:border-color .3s,transform .35s cubic-bezier(.2,.8,.2,1)}
.ib-c-tl{top:-6px;left:-6px;border-top-width:1.5px;border-left-width:1.5px}
.ib-c-tr{top:-6px;right:-6px;border-top-width:1.5px;border-right-width:1.5px}
.ib-c-bl{bottom:-6px;left:-6px;border-bottom-width:1.5px;border-left-width:1.5px}
.ib-c-br{bottom:-6px;right:-6px;border-bottom-width:1.5px;border-right-width:1.5px}
.ib-frame-hover:hover>.ib-c{border-color:var(--ib-ink)}
.ib-frame-hover:hover>.ib-c-tl{transform:translate(-3px,-3px)}
.ib-frame-hover:hover>.ib-c-tr{transform:translate(3px,-3px)}
.ib-frame-hover:hover>.ib-c-bl{transform:translate(-3px,3px)}
.ib-frame-hover:hover>.ib-c-br{transform:translate(3px,3px)}
.ib-bento{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(20px,3cqw,32px)}
@container (min-width:560px){.ib-bento{grid-template-columns:repeat(2,minmax(0,1fr))}.ib-wide{grid-column:1 / -1;width:min(100%,820px);justify-self:center}}
.ib-card{background:linear-gradient(180deg,var(--ib-raise),var(--ib-card));border:1px solid var(--ib-line);padding:clamp(14px,2cqw,22px);display:flex;flex-direction:column;gap:14px;transition:border-color .3s,box-shadow .35s,background-color .45s}
.ib-card:hover{border-color:var(--ib-line-strong);box-shadow:var(--ib-shadow)}
.ib-card h3{font-size:13.5px;font-weight:600;letter-spacing:-.005em}
.ib-card p{font-size:12.5px;line-height:1.55;color:var(--ib-muted);max-width:40ch}
.ib-diagram{width:100%;height:auto;overflow:visible}
.ib-wide-copy{display:grid;grid-template-columns:1fr;gap:16px}
@container (min-width:560px){.ib-wide-copy{grid-template-columns:1fr 1fr}.ib-wide-copy>div:last-child{justify-self:end;text-align:left}}
.ib-flow{stroke:var(--ib-line-strong);fill:none;stroke-width:1.2;transition:stroke .3s}
.ib-flow-on{stroke:var(--ib-ink)}
.ib-dash{stroke-dasharray:3 4;animation:ib-dash 1.2s linear infinite}
.ib-pkt{fill:var(--ib-ink)}
.ib-node{fill:var(--ib-raise);stroke:var(--ib-line-strong);transition:stroke .3s,transform .3s}
.ib-av{cursor:pointer;transition:transform .35s cubic-bezier(.2,.8,.2,1);transform-box:fill-box;transform-origin:center}
.ib-av:hover,.ib-av:focus-visible{transform:scale(1.18)}
.ib-av-tip{opacity:0;transition:opacity .2s;pointer-events:none}
.ib-av:hover .ib-av-tip,.ib-av:focus .ib-av-tip{opacity:1}
.ib-presence{animation:ib-pulse 2.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.ib-sheet{transition:transform .7s cubic-bezier(.2,.8,.2,1),opacity .7s}
.ib-sheet-new{animation:ib-sheet-in .7s cubic-bezier(.2,.8,.2,1) both}
.ib-tool{cursor:pointer;transition:transform .3s cubic-bezier(.2,.8,.2,1);transform-box:fill-box;transform-origin:center}
.ib-tool:hover,.ib-tool-on{transform:translateY(-2px)}
.ib-tool rect{transition:stroke .3s}
.ib-tool-on rect.ib-node{stroke:var(--ib-ink)}
.ib-chart{cursor:crosshair}
.ib-line-draw{stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1.8s cubic-bezier(.4,.1,.2,1)}
[data-in="true"] .ib-line-draw{stroke-dashoffset:0}
.ib-glow{animation:ib-pulse 2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes ib-dash{to{stroke-dashoffset:-14}}
@keyframes ib-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(1.35)}}
@keyframes ib-sheet-in{from{opacity:0;transform:translate(14px,-10px) rotate(4deg)}to{opacity:1;transform:none}}
.ib-bento>.ib-frame{display:flex;flex-direction:column}
.ib-bento>.ib-frame>.ib-card{flex:1}
@media (prefers-reduced-motion:reduce){
.ib-reveal{opacity:1;transform:none;transition:none}
.ib-dash,.ib-presence,.ib-glow,.ib-sheet-new{animation:none}
.ib-line-draw{transition:none;stroke-dashoffset:0}
}
`;
