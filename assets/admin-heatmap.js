(()=>{
 const root=document.querySelector('[data-heatmap-admin]');if(!root)return;
 const data=JSON.parse(root.querySelector('[data-heatmap-events]').textContent||'[]');
 const select=root.querySelector('[data-heatmap-page]'),device=root.querySelector('[data-heatmap-device]'),range=root.querySelector('[data-heatmap-range]'),frame=root.querySelector('[data-heatmap-frame]'),layer=root.querySelector('[data-heatmap-layer]'),report=root.querySelector('[data-heatmap-report]'),stats=root.querySelector('[data-heatmap-stats]'),wrapper=root.querySelector('.heatmap-preview');
 const roots=new Set(['work','insights','services','about','contact','careers','testimonials','team','procurement','rfp','policies']);
 const safe=p=>{if(typeof p!=='string'||!p.startsWith('/')||p.startsWith('//')||p.includes('..')||p.includes('?')||p.includes('#'))return false;const seg=p.split('/').filter(Boolean);return !seg.length||(seg.length<=2&&roots.has(seg[0])&&seg.every(s=>/^[a-z0-9-]+$/.test(s)))};
 const pages=[...new Set(['/', '/services/', '/work/', '/about/', '/contact/', '/testimonials/', '/careers/', '/insights/', '/team/', '/procurement/',...data.map(x=>x.path)].filter(safe))].sort();
 pages.forEach(p=>select.add(new Option(p,p)));if(pages.includes('/'))select.value='/';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const now=Date.now();let page=select.value||'/',docHeight=900,scale=1;
 const previewWidth=()=>device.value==='mobile'?390:device.value==='tablet'?820:1440;
 const layout=()=>{
  const width=previewWidth();
  wrapper.style.maxWidth=width+'px';
  const available=Math.max(1,wrapper.clientWidth||width);scale=Math.min(1,available/width);
  frame.style.width=width+'px';frame.style.height=docHeight+'px';frame.style.transformOrigin='top left';frame.style.transform=`scale(${scale})`;
  wrapper.style.aspectRatio='auto';wrapper.style.height=(docHeight*scale)+'px';
  layer.style.width='100%';layer.style.height='100%';
 };
 const selectedEvents=()=>{const cutoff=Number(range.value)===0?0:now-Number(range.value)*86400000;return data.filter(x=>x.path===page&&(device.value==='all'||x.device===device.value)&&(!cutoff||Date.parse(x.created_at||'')>=cutoff))};
 function update(){
  page=select.value||'/';const selected=selectedEvents(),clicks=selected.filter(x=>x.type==='click'),views=selected.filter(x=>x.type==='pageview');
  const coordClicks=clicks.filter(e=>Number.isFinite(Number(e.x))&&Number.isFinite(Number(e.y))&&Number(e.x)>=0&&Number(e.x)<=1&&Number(e.y)>=0&&Number(e.y)<=1);
  stats.textContent=views.length+' page views · '+clicks.length+' clicks · '+coordClicks.length+' positioned clicks · '+new Set(selected.map(x=>x.session).filter(Boolean)).size+' tracked sessions';
  const count={};clicks.forEach(x=>{const key=x.target||'Unlabelled element';count[key]=(count[key]||0)+1});
  report.innerHTML=Object.entries(count).sort((a,b)=>b[1]-a[1]).slice(0,30).map(([key,n])=>'<tr><td>'+esc(key)+'</td><td>'+n+'</td></tr>').join('')||'<tr><td colspan="2">No consented clicks yet for this filter.</td></tr>';
  layer.innerHTML='';
  if(!coordClicks.length){const empty=document.createElement('div');empty.className='heatmap-empty';empty.innerHTML=clicks.length?'These clicks were recorded before coordinate tracking was available.<br>New consented clicks will appear here automatically.':'No positioned clicks yet for this page and filter.';layer.append(empty);return;}
  const cells={};coordClicks.forEach(e=>{const x=Math.max(0,Math.min(1,Number(e.x))),y=Math.max(0,Math.min(1,Number(e.y)));const gx=Math.round(x*30)/30,gy=Math.round(y*46)/46,k=gx+','+gy;cells[k]??={x:gx,y:gy,n:0};cells[k].n++});
  const max=Math.max(...Object.values(cells).map(c=>c.n),1);
  Object.values(cells).forEach(cell=>{const d=document.createElement('div');d.className='heatmap-spot';d.style.left=(cell.x*100)+'%';d.style.top=(cell.y*100)+'%';const size=58+Math.round((cell.n/max)*68);d.style.width=d.style.height=size+'px';d.style.opacity=String(.58+.42*(cell.n/max));d.title=cell.n+' click'+(cell.n===1?'':'s');const label=document.createElement('span');label.textContent=cell.n;d.append(label);layer.append(d)});
 }
 const load=()=>{frame.src=page+(page.includes('?')?'&':'?')+'ferrn_preview=1&hm='+Date.now()};
 select.addEventListener('change',()=>{page=select.value||'/';load();update()});
 device.addEventListener('change',()=>{docHeight=900;layout();load();update()});range.addEventListener('change',update);
 frame.addEventListener('load',()=>{try{const doc=frame.contentDocument;if(!doc)return;const css=doc.createElement('style');css.textContent='.reveal{opacity:1!important;visibility:visible!important;transform:none!important}.ferrn-chat,.cookie-banner,.page-loader{display:none!important}';doc.head.append(css);requestAnimationFrame(()=>{docHeight=Math.min(14000,Math.max(900,doc.documentElement.scrollHeight,doc.body?.scrollHeight||0));layout();update()})}catch(_){layout();update()}});
 if('ResizeObserver'in window)new ResizeObserver(layout).observe(root.querySelector('.hm-stage')||wrapper);else window.addEventListener('resize',layout);
 if(pages.length){select.value=pages.includes('/')?'/':pages[0];page=select.value;load()}layout();update();
})();