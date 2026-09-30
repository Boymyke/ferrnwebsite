<?php
declare(strict_types=1);
if(session_status()!==PHP_SESSION_ACTIVE)session_start();
require_once __DIR__.'/../lib/platform.php';
if(empty($_SESSION['ferrn_admin'])){header('Location:/admin/');exit;}
$events=array_slice(ferrn_collection('analytics'),0,15000);
$events=array_map(static fn($e)=>array_intersect_key($e,array_flip(['type','path','target','device','session','created_at','x','y'])),$events);
?><!doctype html><html lang="en" data-admin-theme="dark"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Interactive click heatmap · Ferrn Admin</title>
<link rel="stylesheet" href="/assets/admin-unified.css">
<style>
*{box-sizing:border-box}body{margin:0;font:13px Poppins,system-ui,sans-serif;background:var(--adm-bg);color:var(--adm-text)}button,select{font:inherit;cursor:pointer}
.hm-header{padding:16px clamp(16px,3vw,44px);border-bottom:1px solid var(--adm-border);display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
.hm-header h1{margin:0;font-size:21px}.hm-header p{color:var(--adm-muted);font-size:11px;margin:5px 0 0}.hm-header a{color:var(--adm-text);text-decoration:none}
.heatmap-controls{margin:0;gap:12px}.heatmap-controls select{border-radius:9px;background:var(--adm-field);color:var(--adm-text);border:1px solid var(--adm-border);padding:9px}
.hm-toggle{border:1px solid var(--adm-border);background:var(--adm-panel);color:var(--adm-text);border-radius:10px;padding:10px 15px}
.hm-toggle.on{background:#ff4100;color:#fff;border-color:#ff4100}
.hm-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,320px);min-height:calc(100vh - 96px);gap:0}
.hm-stage{overflow:auto;max-height:calc(100vh - 100px);padding:22px;min-width:0;background:#dededb}
.hm-stage .heatmap-preview{margin:auto;min-height:900px;width:100%;max-width:1440px;background:#fff;overflow:hidden;border:1px solid #c8c8c8}
.hm-stage .heatmap-preview iframe{pointer-events:auto}
.hm-stage.browse .heatmap-layer{display:none}
.hm-aside{border-left:1px solid var(--adm-border);padding:22px 17px;background:var(--adm-panel);overflow:auto;max-height:calc(100vh - 100px)}
.hm-aside h2{font-size:16px}.hm-aside p{color:var(--adm-muted);font-size:11px;line-height:1.7}
.hm-aside table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed}.hm-aside td,.hm-aside th{padding:12px 6px;border-bottom:1px solid var(--adm-border);text-align:left;overflow-wrap:anywhere}
@media(max-width:850px){.hm-layout{grid-template-columns:1fr}.hm-aside{max-height:unset;border-left:0;border-top:1px solid var(--adm-border)}.hm-stage{max-height:65vh}}
</style><script src="/assets/admin-unified.js" defer></script></head><body>
<div data-heatmap-admin>
<header class="hm-header"><div><a href="/admin/?tab=analytics">← Analytics dashboard</a><h1>Website click heatmap</h1><p>Browse real pages, view approximate click locations and inspect the most-clicked elements.</p></div>
<div class="heatmap-controls"><label>Page <select data-heatmap-page></select></label><label>Device <select data-heatmap-device><option value="all">All</option><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option></select></label><label>Period <select data-heatmap-range><option value="7">7 days</option><option value="30" selected>30 days</option><option value="90">90 days</option><option value="0">All</option></select></label><button type="button" class="hm-toggle on" id="toggleHeatmap">Heatmap on</button><button type="button" class="hm-toggle" id="browseWebsite">Browse site</button><button type="button" class="hm-toggle" data-admin-theme-toggle>Light mode</button></div></header>
<div class="hm-layout"><section class="hm-stage" id="heatmapStage"><div class="heatmap-preview"><iframe data-heatmap-frame title="Interactive website preview, toggle browsing to activate links" loading="eager"></iframe><div class="heatmap-layer" data-heatmap-layer></div></div></section><aside class="hm-aside"><h2>Click totals</h2><p data-heatmap-stats></p><p>Hotspots show aggregate coordinates recorded after visitors consent. Page redesigns and different screen sizes affect exact positions. Switch to Browse site to use the links. Turn the overlay off to see the underlying page clearly.</p><h2>Most-clicked elements</h2><table><thead><tr><th>Element / destination</th><th style="width:60px">Clicks</th></tr></thead><tbody data-heatmap-report></tbody></table></aside></div>
<script type="application/json" data-heatmap-events><?=json_encode($events,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_INVALID_UTF8_SUBSTITUTE)?></script></div>
<script src="/assets/admin-heatmap.js"></script><script>
const stage=document.querySelector('#heatmapStage'),overlay=document.querySelector('[data-heatmap-layer]'),frame=document.querySelector('[data-heatmap-frame]');
document.querySelector('#toggleHeatmap').onclick=e=>{const off=overlay.style.display!=='none';overlay.style.display=off?'none':'';e.currentTarget.textContent=off?'Heatmap off':'Heatmap on';e.currentTarget.classList.toggle('on',!off)};
document.querySelector('#browseWebsite').onclick=e=>{const on=stage.classList.toggle('browse');e.currentTarget.textContent=on?'Pause browsing':'Browse site';e.currentTarget.classList.toggle('on',on);frame.style.pointerEvents=on?'auto':'none'};
frame.style.pointerEvents='none';frame.addEventListener('load',()=>{try{const path=frame.contentWindow.location.pathname,sel=document.querySelector('[data-heatmap-page]');if(sel&&path!==sel.value&&[...sel.options].some(o=>o.value===path)){sel.value=path;sel.dispatchEvent(new Event('change'))}}catch(e){}});
</script></body></html>
