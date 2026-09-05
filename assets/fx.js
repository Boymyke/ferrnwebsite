(() => {
  /* Lightweight WebGL displacement over the generated hero image. */
  const hero = document.querySelector('.hero-editorial');
  if (hero && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const canvas = document.createElement('canvas');
    canvas.className = 'hero-webgl';
    canvas.setAttribute('aria-hidden','true');
    hero.prepend(canvas);
    const gl = canvas.getContext('webgl', {alpha:true, antialias:false, powerPreference:'high-performance'});
    if (!gl) hero.classList.add('hero-webgl-fallback');
    else {
      const vertex = `attribute vec2 p;varying vec2 v;void main(){v=(p+1.0)*.5;gl_Position=vec4(p,0.,1.);}`;
      const fragment = `precision mediump float;varying vec2 v;uniform sampler2D tex;uniform float time;uniform vec2 mouse;uniform vec2 resolution;
      float wave(vec2 uv){return sin(uv.y*13.0+time*.55)*.008+sin(uv.x*9.0-time*.38)*.006;}
      void main(){vec2 uv=v;float aspect=resolution.x/resolution.y;vec2 m=mouse;vec2 d=uv-m;d.x*=aspect;float dist=max(length(d),.001);float influence=smoothstep(.42,0.,dist);vec2 dir=normalize(d);dir.x/=aspect;float ripple=sin(dist*38.0-time*2.2)*.009*influence;uv+=dir*ripple;uv.x+=wave(uv)*(.4+influence*1.8);uv.y+=sin(uv.x*11.0+time*.42)*.003;vec4 c=texture2D(tex,uv);float glow=influence*.055;c.rgb+=vec3(1.0,.16,0.0)*glow;gl_FragColor=c;}`;
      const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s;};
      const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);gl.useProgram(program);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      const timeLoc=gl.getUniformLocation(program,'time'),mouseLoc=gl.getUniformLocation(program,'mouse'),resLoc=gl.getUniformLocation(program,'resolution');
      const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      const img=new Image();img.src='/assets/ferrn-hero-webgl.webp';
      let mx=.72,my=.46,tx=mx,ty=my,ready=false;
      img.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);ready=true;};
      const resize=()=>{const dpr=Math.min(window.devicePixelRatio||1,1.5);const r=hero.getBoundingClientRect();canvas.width=Math.max(1,Math.floor(r.width*dpr));canvas.height=Math.max(1,Math.floor(r.height*dpr));gl.viewport(0,0,canvas.width,canvas.height);};
      resize();window.addEventListener('resize',resize,{passive:true});
      hero.addEventListener('pointermove',e=>{const r=hero.getBoundingClientRect();tx=(e.clientX-r.left)/r.width;ty=1-(e.clientY-r.top)/r.height;},{passive:true});
      hero.addEventListener('pointerleave',()=>{tx=.72;ty=.46;},{passive:true});
      const start=performance.now();
      const draw=now=>{mx+=(tx-mx)*.045;my+=(ty-my)*.045;if(ready){gl.uniform1f(timeLoc,(now-start)/1000);gl.uniform2f(mouseLoc,mx,my);gl.uniform2f(resLoc,canvas.width,canvas.height);gl.drawArrays(gl.TRIANGLES,0,6);}requestAnimationFrame(draw);};
      requestAnimationFrame(draw);
    }
  }

  /* Use the original Ferrn testimonial audio files. */
  const audioMap = {
    'Vanessa':'https://res.cloudinary.com/dyizdpyem/video/upload/v1774525428/WhatsApp_Audio_2026-03-26_at_11.34.46_cmbcpi.ogg',
    'Chisom':'https://res.cloudinary.com/dyizdpyem/video/upload/v1774525446/Chisom_Okereke_qfoc78.ogg',
    'John Sax':'https://res.cloudinary.com/dyizdpyem/video/upload/v1774525427/John_Sax_djjmeq.ogg',
    'Ifechukwu':'https://res.cloudinary.com/dyizdpyem/video/upload/v1774535400/WhatsApp_Audio_2026-03-26_at_13.22.53_ovnohj.ogg',
    'Nkem':'https://res.cloudinary.com/dyizdpyem/video/upload/v1774553644/WhatsApp_Audio_2026-03-26_at_6.18.43_PM_pqa6ch.3gp'
  };
  let playingAudio=null;
  document.querySelectorAll('.testimonial-slide').forEach(slide=>{
    const name=slide.querySelector('.testimonial-person strong')?.textContent?.trim();
    const src=audioMap[name]; if(!src) return;
    if(name==='Ifechukwu'||name==='Nkem'){
      slide.classList.add('audio-only');
      const q=slide.querySelector('.testimonial-quote'); if(q) q.textContent='Listen to client feedback.';
    }
    const player=document.createElement('div');player.className='testimonial-audio';
    player.innerHTML=`<button class="testimonial-audio-play" type="button" aria-label="Play ${name} testimonial"><i data-lucide="play"></i></button><div class="testimonial-audio-body"><div class="testimonial-audio-top"><span>Audio testimonial</span><span data-audio-time>0:00</span></div><div class="testimonial-audio-track"><div class="testimonial-audio-progress"></div></div><div class="testimonial-audio-label">Hear it directly from ${name}</div></div>`;
    slide.querySelector('.testimonial-quote')?.insertAdjacentElement('afterend',player);
    const audio=new Audio(src),btn=player.querySelector('.testimonial-audio-play'),progress=player.querySelector('.testimonial-audio-progress'),time=player.querySelector('[data-audio-time]'),track=player.querySelector('.testimonial-audio-track');
    const setIcon=playing=>{btn.innerHTML=`<i data-lucide="${playing?'pause':'play'}"></i>`;window.lucide?.createIcons();};
    btn.addEventListener('click',()=>{if(playingAudio&&playingAudio!==audio){playingAudio.pause();document.querySelectorAll('.testimonial-audio-play').forEach(b=>{if(b!==btn)b.innerHTML='<i data-lucide="play"></i>';});}if(audio.paused){audio.play();playingAudio=audio;setIcon(true);}else{audio.pause();setIcon(false);}});
    audio.addEventListener('timeupdate',()=>{if(audio.duration){progress.style.width=`${audio.currentTime/audio.duration*100}%`;const s=Math.floor(audio.currentTime);time.textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}});
    audio.addEventListener('ended',()=>{setIcon(false);progress.style.width='0';time.textContent='0:00';});
    track.addEventListener('click',e=>{if(audio.duration){const r=track.getBoundingClientRect();audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration;}});
  });
  window.lucide?.createIcons();
})();
