(() => {
  /* Use the original Ferrn testimonial audio files. */
  const audioMap = {
    'Vanessa':'https://res.cloudinary.com/dyizdpyem/video/upload/v1774525428/WhatsApp_Audio_2026-03-26_at_11.34.46_cmbcpi.ogg',
    'Chisom':'https://res.cloudinary.com/dyizdpyem/video/upload/v1774525446/Chisom_Okereke_qfoc78.ogg',
    'John Sax':'https://res.cloudinary.com/dyizdpyem/video/upload/v1774525427/John_Sax_djjmeq.ogg',
    'Ifechukwu':'https://res.cloudinary.com/dyizdpyem/video/upload/v1774535400/WhatsApp_Audio_2026-03-26_at_13.22.53_ovnohj.ogg',
    'Nkem':'https://res.cloudinary.com/dyizdpyem/video/upload/v1774553644/WhatsApp_Audio_2026-03-26_at_6.18.43_PM_pqa6ch.3gp'
  };

  let playingAudio = null;

  document.querySelectorAll('.testimonial-slide').forEach(slide => {
    const name = slide.querySelector('.testimonial-person strong')?.textContent?.trim();
    const src = audioMap[name];
    if (!src) return;

    if (name === 'Ifechukwu' || name === 'Nkem') {
      slide.classList.add('audio-only');
      const quote = slide.querySelector('.testimonial-quote');
      if (quote) quote.textContent = 'Listen to client feedback.';
    }

    const player = document.createElement('div');
    player.className = 'testimonial-audio';
    player.innerHTML = `<button class="testimonial-audio-play" type="button" aria-label="Play ${name} testimonial"><i data-lucide="play"></i></button><div class="testimonial-audio-body"><div class="testimonial-audio-top"><span>Audio testimonial</span><span data-audio-time>0:00</span></div><div class="testimonial-audio-track"><div class="testimonial-audio-progress"></div></div><div class="testimonial-audio-label">Hear it directly from ${name}</div></div>`;
    slide.querySelector('.testimonial-quote')?.insertAdjacentElement('afterend', player);

    const audio = new Audio(src);
    const btn = player.querySelector('.testimonial-audio-play');
    const progress = player.querySelector('.testimonial-audio-progress');
    const time = player.querySelector('[data-audio-time]');
    const track = player.querySelector('.testimonial-audio-track');

    const setIcon = playing => {
      btn.innerHTML = `<i data-lucide="${playing ? 'pause' : 'play'}"></i>`;
      window.lucide?.createIcons();
    };

    btn.addEventListener('click', () => {
      if (playingAudio && playingAudio !== audio) {
        playingAudio.pause();
        document.querySelectorAll('.testimonial-audio-play').forEach(other => {
          if (other !== btn) other.innerHTML = '<i data-lucide="play"></i>';
        });
      }
      if (audio.paused) {
        audio.play();
        playingAudio = audio;
        setIcon(true);
      } else {
        audio.pause();
        setIcon(false);
      }
    });

    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      progress.style.width = `${audio.currentTime / audio.duration * 100}%`;
      const seconds = Math.floor(audio.currentTime);
      time.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    });

    audio.addEventListener('ended', () => {
      setIcon(false);
      progress.style.width = '0';
      time.textContent = '0:00';
    });

    track.addEventListener('click', e => {
      if (!audio.duration) return;
      const rect = track.getBoundingClientRect();
      audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
    });
  });

  window.lucide?.createIcons();
})();
