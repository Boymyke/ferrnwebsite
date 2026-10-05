(()=>{const root=document.documentElement;function theme(t){root.dataset.adminTheme=t;try{localStorage.setItem('ferrn-admin-theme',t)}catch(e){}document.querySelectorAll('[data-admin-theme-toggle]').forEach(b=>{b.textContent=t==='light'?'☾  Dark mode':'☀  Light mode'})}let initial='dark';try{initial=localStorage.getItem('ferrn-admin-theme')||'dark'}catch(e){}theme(initial);document.addEventListener('click',e=>{if(e.target.closest('[data-admin-theme-toggle]'))theme(root.dataset.adminTheme==='light'?'dark':'light'})})();
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-edit-item]');if(!b)return;
 try{
  const bytes=Uint8Array.from(atob(b.dataset.editItem),c=>c.charCodeAt(0));
  const record=JSON.parse(new TextDecoder().decode(bytes));
  const form=document.querySelector('[data-edit-form]');if(!form)return;
  for(const [key,value] of Object.entries(record)){
   const input=form.elements.namedItem(key);if(!input)continue;
   if(input.type==='checkbox')input.checked=!!value;
   else if(typeof value==='string'||typeof value==='number')input.value=String(value);
  }
  form.querySelector('button[type="submit"],button.btn')?.setAttribute('data-is-edit','1');
  form.scrollIntoView({behavior:'smooth',block:'start'});
 }catch(err){alert('Could not load this item for editing.')}
});
const sourceSelector=document.querySelector('[data-knowledge-type]');
if(sourceSelector){
 const sync=()=>{const pdf=sourceSelector.value==='pdf';document.querySelector('[data-knowledge-pdf]').hidden=!pdf;document.querySelector('[data-knowledge-url]').hidden=pdf;};
 sourceSelector.addEventListener('change',sync);sync();
}

/* Make enabled/disabled account state unmistakable on the user-management page. */
(()=>{document.querySelectorAll('.account').forEach(account=>{const meta=[...account.querySelectorAll('.muted')].find(x=>/Enabled|Disabled/.test(x.textContent||''));if(!meta)return;const active=!/Disabled/.test(meta.textContent||'');account.classList.toggle('is-disabled-row',!active);if(account.querySelector('.status-pill'))return;const pill=document.createElement('span');pill.className='status-pill '+(active?'is-active':'is-disabled');pill.textContent=active?'Enabled':'Disabled';const h=account.querySelector('h3');if(h){h.style.display='inline-block';h.style.marginRight='10px';h.insertAdjacentElement('afterend',pill)}})})();

/* Responsive dashboard traffic chart. */
(()=>{
 const host=document.querySelector('.traffic-graph');if(!host)return;
 const raw=[...host.querySelectorAll('[data-graph-day]')].map(el=>{const m=(el.getAttribute('title')||'').match(/^(\d{4}-\d{2}-\d{2}):\s*(\d+) page views,\s*(\d+) clicks/i);return m?{date:m[1],views:Number(m[2]),clicks:Number(m[3])}:null}).filter(Boolean);
 if(!raw.length)return;
 let range=14;const buttons=[...document.querySelectorAll('[data-graph-range]')];const fmt=d=>{const p=d.split('-');return p[2]+'/'+p[1]};const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const render=()=>{const data=raw.slice(-range),W=820,H=300,L=44,R=18,T=24,B=42,plotW=W-L-R,plotH=H-T-B,max=Math.max(1,...data.flatMap(x=>[x.views,x.clicks])),nice=Math.max(1,Math.ceil(max/4)*4),x=i=>L+(data.length===1?plotW/2:i*plotW/(data.length-1)),y=v=>T+plotH-(v/nice)*plotH,pts=key=>data.map((d,i)=>x(i)+','+y(d[key])).join(' '),area=`${L},${T+plotH} ${pts('views')} ${x(data.length-1)},${T+plotH}`;let grid='';for(let i=0;i<=4;i++){const val=Math.round(nice*(4-i)/4),gy=T+plotH*i/4;grid+=`<line class="traffic-grid-line" x1="${L}" y1="${gy}" x2="${W-R}" y2="${gy}"/><text class="traffic-axis-label" x="${L-10}" y="${gy+4}" text-anchor="end">${val}</text>`}const every=Math.max(1,Math.ceil(data.length/7));let labels='';data.forEach((d,i)=>{if(i%every===0||i===data.length-1)labels+=`<text class="traffic-axis-label" x="${x(i)}" y="${H-13}" text-anchor="middle">${esc(fmt(d.date))}</text>`});const dots=key=>data.map((d,i)=>`<g class="traffic-point" data-chart-date="${esc(d.date)}" data-chart-views="${d.views}" data-chart-clicks="${d.clicks}"><circle class="traffic-dot ${key}" cx="${x(i)}" cy="${y(d[key])}" r="4"/></g>`).join('');host.classList.add('is-svg');host.innerHTML=`<svg class="traffic-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Page views and clicks for the last ${range} days">${grid}<polygon class="traffic-area" points="${area}"/><polyline class="traffic-line views" points="${pts('views')}"/><polyline class="traffic-line clicks" points="${pts('clicks')}"/>${dots('views')}${dots('clicks')}${labels}</svg><div class="traffic-tooltip" data-chart-tooltip></div><div class="traffic-summary"><span>Page views <b>${data.reduce((a,b)=>a+b.views,0)}</b></span><span>Clicks <b>${data.reduce((a,b)=>a+b.clicks,0)}</b></span><span>Peak day <b>${Math.max(...data.map(d=>d.views))} views</b></span></div>`;const tip=host.querySelector('[data-chart-tooltip]');host.querySelectorAll('.traffic-point').forEach(p=>{p.addEventListener('mouseenter',()=>{tip.innerHTML=`<strong>${esc(p.dataset.chartDate)}</strong>${p.dataset.chartViews} page views · ${p.dataset.chartClicks} clicks`;tip.classList.add('show')});p.addEventListener('mousemove',e=>{const r=host.getBoundingClientRect();tip.style.left=Math.min(r.width-165,Math.max(8,e.clientX-r.left+12))+'px';tip.style.top=Math.max(8,e.clientY-r.top-48)+'px'});p.addEventListener('mouseleave',()=>tip.classList.remove('show'))});buttons.forEach(b=>b.classList.toggle('graph-active',Number(b.dataset.graphRange)===range))};
 buttons.forEach(b=>b.addEventListener('click',()=>{range=Number(b.dataset.graphRange)||14;render()}));render();
})();
