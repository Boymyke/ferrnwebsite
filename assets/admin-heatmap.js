(()=>{
 const root=document.querySelector('[data-heatmap-admin]');if(!root)return;
 const data=JSON.parse(root.querySelector('[data-heatmap-events]').textContent||'[]');
 const select=root.querySelector('[data-heatmap-page]'), device=root.querySelector('[data-heatmap-device]'),range=root.querySelector('[data-heatmap-range]'),
 frame=root.querySelector('[data-heatmap-frame]'),layer=root.querySelector('[data-heatmap-layer]'),report=root.querySelector('[data-heatmap-report]'),stats=root.querySelector('[data-heatmap-stats]');
 const roots=new Set(['work','insights','services','about','contact','careers','testimonials','team','procurement','rfp','policies']);const safe=p=>{if(typeof p!=='string'||!p.startsWith('/')||p.startsWith('//')||p.includes('..')||p.includes('?')||p.includes('#'))return false;const seg=p.split('/').filter(Boolean);return !seg.length||(seg.length<=2&&roots.has(seg[0])&&seg.every(s=>/^[a-z0-9-]+$/.test(s)))};const pages=[...new Set(['/', '/services/', '/work/', '/about/', '/contact/', '/testimonials/', '/careers/', '/insights/', '/team/', '/procurement/',...data.map(x=>x.path)].filter(safe))].sort();
 pages.forEach(p=>{let opt=new Option(p,p);select.add(opt)});if(pages.includes('/'))select.value='/';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const now=Date.now();let page=select.value||'/';
 const previewWidth=()=>device.value==='mobile'?390:device.value==='tablet'?820:1440;
 const wrapper=root.querySelector('.heatmap-preview');
 function sizePreview(){const width=previewWidth();wrapper.style.maxWidth=width+'px';frame.style.width=width+'px';const scale=Math.min(1,wrapper.clientWidth/width);frame.style.transformOrigin='top left';frame.style.transform='scale('+scale+')';wrapper.style.height=((parseFloat(frame.style.height)||900)*scale)+'px';}
 function update(){
  page=select.value||'/';
  const cutoff=Number(range.value)===0?0:now-Number(range.value)*86400000;
  const selected=data.filter(x=>x.path===page&&(device.value==='all'||x.device===device.value)&&(!cutoff||Date.parse(x.created_at||'')>=cutoff));
  const clicks=selected.filter(x=>x.type==='click');const views=selected.filter(x=>x.type==='pageview');
  stats.textContent=views.length+' page views · '+clicks.length+' clicks · '+new Set(selected.map(x=>x.session).filter(Boolean)).size+' tracked sessions';
  const count={};clicks.forEach(x=>{const key=x.target||'Unlabelled element';count[key]=(count[key]||0)+1});
  report.innerHTML=Object.entries(count).sort((a,b)=>b[1]-a[1]).slice(0,30).map(([key,n])=>'<tr><td>'+esc(key)+'</td><td>'+n+'</td></tr>').join('')||'<tr><td colspan="2">No consented clicks yet for this filter.</td></tr>';
  layer.innerHTML='';
  const cells={};clicks.forEach(e=>{if(typeof e.x!=='number'||typeof e.y!=='number'||e.x<0||e.x>1||e.y<0||e.y>1)return;const x=Math.round(e.x*24)/24,y=Math.round(e.y*32)/32,k=x+','+y;cells[k]??={x,y,n:0};cells[k].n++});
  Object.values(cells).forEach(cell=>{const d=document.createElement('div');d.className='heatmap-spot';d.style.left=(cell.x*100)+'%';d.style.top=(cell.y*100)+'%';d.style.opacity=String(Math.min(1,.25+cell.n*.19));d.style.width=d.style.height=(54+Math.min(cell.n,12)*8)+'px';d.title=cell.n+' clicks';const label=document.createElement('span');label.textContent=cell.n;d.append(label);layer.append(d)});
 }
 select.addEventListener('change',()=>{page=select.value||'/';frame.src=page+'?ferrn_preview=1';update()});
 device.addEventListener('change',()=>{sizePreview();frame.src=page+'?ferrn_preview=1';update()});range.addEventListener('change',update);
 frame.addEventListener('load',()=>{try{const doc=frame.contentDocument;if(!doc)return;const css=doc.createElement('style');css.textContent='.reveal{opacity:1!important;visibility:visible!important;transform:none!important}.ferrn-chat,.cookie-banner,.page-loader{display:none!important}';doc.head.append(css);const width=previewWidth();frame.style.width=width+'px';const height=Math.min(12000,Math.max(900,doc.documentElement.scrollHeight));const scale=Math.min(1,wrapper.clientWidth/width);frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transformOrigin='top left';frame.style.transform='scale('+scale+')';wrapper.style.height=(height*scale)+'px';layer.style.height='100%'}catch(_){}});
 const resize=new ResizeObserver(()=>{try{sizePreview()}catch(_){}});resize.observe(root.querySelector('.hm-stage')||wrapper);
 if(pages.length){select.value=pages.includes('/')?'/':pages[0];page=select.value;frame.src=page+'?ferrn_preview=1';}
 update();
})();