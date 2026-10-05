(()=>{
 const root=document.documentElement;
 function applyTheme(theme){
  root.dataset.adminTheme=theme;
  try{localStorage.setItem('ferrn-admin-theme',theme)}catch(e){}
  document.querySelectorAll('[data-admin-theme-toggle]').forEach(btn=>btn.textContent=theme==='light'?'☾  Dark mode':'☀  Light mode');
 }
 let initial='dark';
 try{initial=localStorage.getItem('ferrn-admin-theme')||'dark'}catch(e){}
 applyTheme(initial);
 document.addEventListener('click',e=>{if(e.target.closest('[data-admin-theme-toggle]'))applyTheme(root.dataset.adminTheme==='light'?'dark':'light')});
})();

document.addEventListener('click',e=>{
 const trigger=e.target.closest('[data-edit-item]');
 if(!trigger)return;
 try{
  const bytes=Uint8Array.from(atob(trigger.dataset.editItem),c=>c.charCodeAt(0));
  const record=JSON.parse(new TextDecoder().decode(bytes));
  const form=document.querySelector('[data-edit-form]');if(!form)return;
  for(const [key,value] of Object.entries(record)){
   const input=form.elements.namedItem(key);if(!input)continue;
   if(input.type==='checkbox')input.checked=!!value;
   else if(typeof value==='string'||typeof value==='number')input.value=String(value);
  }
  form.scrollIntoView({behavior:'smooth',block:'start'});
 }catch(err){alert('Could not load this item for editing.')}
});

const sourceSelector=document.querySelector('[data-knowledge-type]');
if(sourceSelector){
 const sync=()=>{
  const pdf=sourceSelector.value==='pdf';
  const pdfField=document.querySelector('[data-knowledge-pdf]');
  const urlField=document.querySelector('[data-knowledge-url]');
  if(pdfField)pdfField.hidden=!pdf;
  if(urlField)urlField.hidden=pdf;
 };
 sourceSelector.addEventListener('change',sync);sync();
}

/* Show clear enabled/disabled states on the user-management page. */
(()=>{
 document.querySelectorAll('.account').forEach(account=>{
  const meta=[...account.querySelectorAll('.muted')].find(x=>/Enabled|Disabled/.test(x.textContent||''));
  if(!meta)return;
  const active=!/Disabled/.test(meta.textContent||'');
  account.classList.toggle('is-disabled-row',!active);
  if(account.querySelector('.status-pill'))return;
  const pill=document.createElement('span');
  pill.className='status-pill '+(active?'is-active':'is-disabled');
  pill.textContent=active?'Enabled':'Disabled';
  const heading=account.querySelector('h3');
  if(heading)heading.insertAdjacentElement('afterend',pill);
 });
})();

/* Normalize testimonial visibility badges so hidden records are obvious. */
(()=>{
 document.querySelectorAll('.badge').forEach(badge=>{
  const text=(badge.textContent||'').trim().toLowerCase();
  if(text.startsWith('visible'))badge.classList.add('is-visible');
  if(text.startsWith('hidden'))badge.classList.add('is-hidden');
 });
})();

/* Dependency-free bounded canvas line chart for the dashboard. */
(()=>{
 const host=document.querySelector('.traffic-graph');
 if(!host)return;
 const raw=[...host.querySelectorAll('[data-graph-day]')].map(el=>{
  const m=(el.getAttribute('title')||'').match(/^(\d{4}-\d{2}-\d{2}):\s*(\d+) page views,\s*(\d+) clicks/i);
  return m?{date:m[1],views:Number(m[2]),clicks:Number(m[3])}:null;
 }).filter(Boolean);
 if(!raw.length)return;

 const buttons=[...document.querySelectorAll('[data-graph-range]')];
 let range=14;
 host.innerHTML='<canvas aria-label="Website traffic line chart"></canvas><div class="traffic-tooltip" data-chart-tooltip></div>';
 const canvas=host.querySelector('canvas');
 const tooltip=host.querySelector('[data-chart-tooltip]');
 const ctx=canvas.getContext('2d');
 let points=[];

 const css=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
 const niceMax=value=>{
  if(value<=4)return 4;
  const power=Math.pow(10,Math.floor(Math.log10(value)));
  const n=value/power;
  const step=n<=2?2:n<=5?5:10;
  return step*power;
 };
 const fmtDate=date=>{const d=new Date(date+'T00:00:00');return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})};

 function draw(){
  const data=raw.slice(-range);
  const rect=host.getBoundingClientRect();
  const width=Math.max(320,Math.floor(rect.width));
  const height=Math.max(230,Math.floor(rect.height));
  const dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);
  canvas.style.width=width+'px';canvas.style.height=height+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);

  const left=42,right=18,top=22,bottom=34,plotW=width-left-right,plotH=height-top-bottom;
  const max=niceMax(Math.max(1,...data.flatMap(d=>[d.views,d.clicks])));
  const x=i=>data.length<=1?left+plotW/2:left+(i/(data.length-1))*plotW;
  const y=value=>top+plotH-(value/max)*plotH;
  const border=css('--adm-border')||'#303030',muted=css('--adm-muted')||'#969696',panel=css('--adm-panel')||'#121212';
  const viewColor='#ff4100',clickColor='#ff9b78';

  ctx.lineWidth=1;ctx.strokeStyle=border;ctx.fillStyle=muted;ctx.font='10px Poppins, system-ui';ctx.textBaseline='middle';
  for(let i=0;i<=4;i++){
   const gy=top+(plotH*i/4);const val=Math.round(max-(max*i/4));
   ctx.beginPath();ctx.moveTo(left,gy);ctx.lineTo(width-right,gy);ctx.stroke();
   ctx.textAlign='right';ctx.fillText(String(val),left-8,gy);
  }

  const labels=Math.min(7,data.length);const interval=Math.max(1,Math.ceil(data.length/labels));
  ctx.textBaseline='alphabetic';ctx.textAlign='center';
  data.forEach((d,i)=>{if(i%interval===0||i===data.length-1)ctx.fillText(fmtDate(d.date),x(i),height-11)});

  const line=(key,color,fill)=>{
   if(fill){
    ctx.beginPath();ctx.moveTo(x(0),top+plotH);data.forEach((d,i)=>ctx.lineTo(x(i),y(d[key])));ctx.lineTo(x(data.length-1),top+plotH);ctx.closePath();
    const grad=ctx.createLinearGradient(0,top,0,top+plotH);grad.addColorStop(0,'rgba(255,65,0,.18)');grad.addColorStop(1,'rgba(255,65,0,0)');ctx.fillStyle=grad;ctx.fill();
   }
   ctx.beginPath();data.forEach((d,i)=>{if(i===0)ctx.moveTo(x(i),y(d[key]));else ctx.lineTo(x(i),y(d[key]))});ctx.strokeStyle=color;ctx.lineWidth=key==='views'?2.5:2;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
  };
  line('views',viewColor,true);line('clicks',clickColor,false);

  points=[];
  data.forEach((d,i)=>{
   ['views','clicks'].forEach(key=>{
    const px=x(i),py=y(d[key]),color=key==='views'?viewColor:clickColor;
    ctx.beginPath();ctx.arc(px,py,3.5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=panel;ctx.lineWidth=1.5;ctx.stroke();
    points.push({x:px,y:py,date:d.date,views:d.views,clicks:d.clicks});
   });
  });
  buttons.forEach(btn=>btn.classList.toggle('graph-active',Number(btn.dataset.graphRange)===range));
 }

 buttons.forEach(btn=>btn.addEventListener('click',()=>{range=Number(btn.dataset.graphRange)||14;draw()}));
 canvas.addEventListener('mousemove',event=>{
  const r=canvas.getBoundingClientRect(),mx=event.clientX-r.left,my=event.clientY-r.top;
  let best=null,dist=Infinity;
  points.forEach(p=>{const d=Math.hypot(mx-p.x,my-p.y);if(d<dist){dist=d;best=p}});
  if(!best||dist>18){tooltip.classList.remove('show');return}
  tooltip.innerHTML='<strong>'+fmtDate(best.date)+'</strong>'+best.views+' page views · '+best.clicks+' clicks';
  tooltip.style.left=Math.min(host.clientWidth-165,Math.max(8,mx+12))+'px';
  tooltip.style.top=Math.max(8,my-48)+'px';tooltip.classList.add('show');
 });
 canvas.addEventListener('mouseleave',()=>tooltip.classList.remove('show'));
 const observer=new ResizeObserver(draw);observer.observe(host);draw();
})();
