(()=>{const root=document.documentElement;function theme(t){root.dataset.adminTheme=t;try{localStorage.setItem('ferrn-admin-theme',t)}catch(e){}document.querySelectorAll('[data-admin-theme-toggle]').forEach(b=>{b.textContent=t==='light'?'☾  Dark mode':'☀  Light mode'})}let initial='dark';try{initial=localStorage.getItem('ferrn-admin-theme')||'dark'}catch(e){}theme(initial);document.addEventListener('click',e=>{if(e.target.closest('[data-admin-theme-toggle]'))theme(root.dataset.adminTheme==='light'?'dark':'light')})})();
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
