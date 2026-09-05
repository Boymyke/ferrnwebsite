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

  let items = [];
  let index = 0;
  let autoplay = null;
  let currentAudio = null;
  let audioPlaying = false;

  const waveHeights = [10,18,25,14,29,21,12,27,33,18,26,14,30,20,12,24,32,15,28,21,11,26,34,17,24,13,29,22,16,31,19,11,25,30,14,27,20,12,33,18,24,15,29,21,10,26,31,16];
  const esc = s => String(s || '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

  function card(t, i){
    const el = document.createElement('article');
    el.className='testimonial-card-v2'; el.dataset.index=String(i);
    el.innerHTML=`<img class="testimonial-image-v2" src="${esc(t.image)}" alt="${esc(t.name)}" loading="lazy"><div class="audio-wave-v2"><button class="audio-play-v2" type="button" aria-label="Play ${esc(t.name)} testimonial"><i data-lucide="play"></i></button><div class="audio-wave-bars">${waveHeights.map(h=>`<i style="height:${h}px"></i>`).join('')}</div><span class="audio-time-v2">0:00</span></div><div class="testimonial-meta-v2"><strong>${esc(t.name)}</strong><span>${esc(t.role)}</span></div>`;
    const audio = new Audio(t.audio);
    const play = el.querySelector('.audio-play-v2');
    const bars = [...el.querySelectorAll('.audio-wave-bars i')];
    const wave = el.querySelector('.audio-wave-bars');
    const time = el.querySelector('.audio-time-v2');
    const icon = playing => { play.innerHTML=`<i data-lucide="${playing?'pause':'play'}"></i>`; window.lucide?.createIcons(); };
    play.addEventListener('click', e=>{
      e.stopPropagation();
      if(currentAudio && currentAudio!==audio){ currentAudio.pause(); document.querySelectorAll('.audio-play-v2').forEach(b=>b.innerHTML='<i data-lucide="play"></i>'); }
      if(audio.paused){ audio.play(); currentAudio=audio; audioPlaying=true; clearInterval(autoplay); icon(true); }
      else { audio.pause(); audioPlaying=false; icon(false); restart(); }
    });
    audio.addEventListener('timeupdate',()=>{
      if(!audio.duration) return;
      const pct=audio.currentTime/audio.duration; const played=Math.floor(pct*bars.length);
      bars.forEach((b,n)=>b.classList.toggle('played',n<=played));
      const s=Math.floor(audio.currentTime); time.textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
    });
    audio.addEventListener('ended',()=>{audioPlaying=false;icon(false);bars.forEach(b=>b.classList.remove('played'));time.textContent='0:00';restart();});
    wave.addEventListener('click',e=>{if(!audio.duration)return;const r=wave.getBoundingClientRect();audio.currentTime=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*audio.duration;});
    el.addEventListener('click',()=>go(i,true));
    return el;
  }

  function update(){
    const cards=[...track.children];
    cards.forEach((c,i)=>{const d=(i-index+items.length)%items.length;const back=(index-i+items.length)%items.length;c.classList.toggle('active',i===index);c.classList.toggle('near',d===1||back===1);});
    const cardW=cards[0]?.getBoundingClientRect().width||0; const gap=parseFloat(getComputedStyle(track).gap)||0;
    const viewportW=viewport.clientWidth; const offset=(viewportW-cardW)/2-index*(cardW+gap);
    track.style.transform=`translateX(${offset}px)`;
    [...dots.children].forEach((d,i)=>d.classList.toggle('active',i===index));
  }
  function go(i,user=false){index=(i+items.length)%items.length;update();if(user&&!audioPlaying)restart();}
  function restart(){clearInterval(autoplay);if(!audioPlaying&&items.length>1)autoplay=setInterval(()=>go(index+1),6500);}

  prev.addEventListener('click',()=>go(index-1,true)); next.addEventListener('click',()=>go(index+1,true));
  window.addEventListener('resize',update,{passive:true});

  fetch('/api/testimonials.php',{cache:'no-store'}).then(r=>r.json()).then(data=>{
    items=Array.isArray(data.testimonials)?data.testimonials:[];
    if(!items.length){clone.remove();return;}
    track.innerHTML=''; dots.innerHTML='';
    items.forEach((t,i)=>{track.appendChild(card(t,i));const d=document.createElement('button');d.type='button';d.setAttribute('aria-label',`Go to testimonial ${i+1}`);d.addEventListener('click',()=>go(i,true));dots.appendChild(d);});
    requestAnimationFrame(()=>{update();restart();window.lucide?.createIcons();});
  }).catch(()=>clone.remove());
})();
