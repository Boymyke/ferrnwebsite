(() => {
  const slider = document.querySelector('[data-testimonial-slider]');
  if (!slider) return;

  const clone = slider.cloneNode(false);
  clone.className = 'testimonial-slider-v2 reveal visible';
  clone.removeAttribute('data-testimonial-slider');
  slider.replaceWith(clone);

  const viewport = document.createElement('div');
  viewport.className = 'testimonial-viewport-v2';
  const track = document.createElement('div');
  track.className = 'testimonial-track-v2';
  viewport.appendChild(track);
  const prev = document.createElement('button');
  prev.className = 'testimonial-arrow-v2 prev'; prev.type='button'; prev.setAttribute('aria-label','Previous testimonial'); prev.innerHTML='<i data-lucide="arrow-left"></i>';
  const next = document.createElement('button');
  next.className = 'testimonial-arrow-v2 next'; next.type='button'; next.setAttribute('aria-label','Next testimonial'); next.innerHTML='<i data-lucide="arrow-right"></i>';
  const dots = document.createElement('div'); dots.className='testimonial-dots-v2';
  clone.append(viewport, prev, next, dots);

  let items=[];
  let index=0;
  let autoplay=null;
  let currentAudio=null;
  let audioPlaying=false;
  const waveHeights=[10,18,25,14,29,21,12,27,33,18,26,14,30,20,12,24,32,15,28,21,11,26,34,17,24,13,29,22,16,31,19,11,25,30,14,27,20,12,33,18,24,15,29,21,10,26,31,16];
  const esc=s=>String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

  function stopCurrent(){
    if(currentAudio){currentAudio.pause();currentAudio.currentTime=0;currentAudio=null;}
    audioPlaying=false;
  }

  function makeCard(t, actualIndex, state){
    const el=document.createElement('article');
    el.className=`testimonial-card-v2 ${state}`;
    el.dataset.actualIndex=String(actualIndex);
    el.innerHTML=`<img class="testimonial-image-v2" src="${esc(t.image)}" alt="${esc(t.name)}" loading="lazy"><div class="audio-wave-v2"><button class="audio-play-v2" type="button" aria-label="Play ${esc(t.name)} testimonial"><i data-lucide="play"></i></button><div class="audio-wave-bars">${waveHeights.map(h=>`<i style="height:${h}px"></i>`).join('')}</div><span class="audio-time-v2">0:00</span></div><div class="testimonial-meta-v2"><strong>${esc(t.name)}</strong><span>${esc(t.role)}</span></div>`;
    const audio=new Audio(t.audio);
    const play=el.querySelector('.audio-play-v2');
    const bars=[...el.querySelectorAll('.audio-wave-bars i')];
    const wave=el.querySelector('.audio-wave-bars');
    const time=el.querySelector('.audio-time-v2');
    const icon=playing=>{play.innerHTML=`<i data-lucide="${playing?'pause':'play'}"></i>`;window.lucide?.createIcons();};
    play.addEventListener('click',e=>{
      e.stopPropagation();
      if(currentAudio&&currentAudio!==audio){currentAudio.pause();currentAudio.currentTime=0;}
      if(audio.paused){audio.play();currentAudio=audio;audioPlaying=true;clearInterval(autoplay);icon(true);}
      else{audio.pause();currentAudio=null;audioPlaying=false;icon(false);restart();}
    });
    audio.addEventListener('timeupdate',()=>{
      if(!audio.duration)return;
      const pct=audio.currentTime/audio.duration;const played=Math.floor(pct*bars.length);
      bars.forEach((b,n)=>b.classList.toggle('played',n<=played));
      const s=Math.floor(audio.currentTime);time.textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
    });
    audio.addEventListener('ended',()=>{currentAudio=null;audioPlaying=false;icon(false);bars.forEach(b=>b.classList.remove('played'));time.textContent='0:00';restart();});
    wave.addEventListener('click',e=>{e.stopPropagation();if(!audio.duration)return;const r=wave.getBoundingClientRect();audio.currentTime=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*audio.duration;});
    if(state!=='active')el.addEventListener('click',()=>go(actualIndex,true));
    return el;
  }

  function render(){
    if(!items.length)return;
    track.innerHTML='';
    const p=(index-1+items.length)%items.length;
    const n=(index+1)%items.length;
    track.append(makeCard(items[p],p,'near'),makeCard(items[index],index,'active'),makeCard(items[n],n,'near'));
    track.style.transform='none';
    [...dots.children].forEach((d,i)=>d.classList.toggle('active',i===index));
    window.lucide?.createIcons();
  }
  function go(i,user=false){
    if(user)stopCurrent();
    index=(i+items.length)%items.length;
    render();
    if(!audioPlaying)restart();
  }
  function restart(){clearInterval(autoplay);if(!audioPlaying&&items.length>1)autoplay=setInterval(()=>go(index+1,false),6500);}

  prev.addEventListener('click',()=>go(index-1,true));
  next.addEventListener('click',()=>go(index+1,true));

  fetch('/api/testimonials.php',{cache:'no-store'}).then(r=>r.json()).then(data=>{
    items=Array.isArray(data.testimonials)?data.testimonials:[];
    if(!items.length){clone.remove();return;}
    dots.innerHTML='';
    items.forEach((_,i)=>{const d=document.createElement('button');d.type='button';d.setAttribute('aria-label',`Go to testimonial ${i+1}`);d.addEventListener('click',()=>go(i,true));dots.appendChild(d);});
    render();restart();
  }).catch(()=>clone.remove());
})();
