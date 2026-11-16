// Instagram: open the chat from the profile, type the message, and notice when you press Enter.
(async () => {
  const F = FERRN;
  const job = await F.job();
  if (!job || job.platform !== 'instagram') return;
  F.say('Opening the chat…');
  const composer = () => [...document.querySelectorAll('div[contenteditable="true"][role="textbox"], div[contenteditable="true"][aria-label="Message"]')].find(F.visible);
  const messageBtn = () => [...document.querySelectorAll('div[role="button"], button, a[role="link"]')]
    .find((b) => F.visible(b) && /^message$/.test(F.btnText(b)));
  let typed = false, typing = false, clicked = false, intentAt = 0, done = false, warned = false;
  const started = Date.now();
  document.addEventListener('keydown', (e) => { if (e.isTrusted && e.key === 'Enter' && !e.shiftKey) { intentAt = Date.now(); F.markIntent(); } }, true);
  document.addEventListener('click', (e) => {
    if (!e.isTrusted) return;
    const b = e.target.closest && e.target.closest('[role="button"], button');
    if (b && /^send$/.test(F.btnText(b))) { intentAt = Date.now(); F.markIntent(); }
  }, true);
  const timer = setInterval(async () => {
    if (done) return clearInterval(timer);
    const box = composer();
    if (typed) {
      if (intentAt && Date.now() - intentAt < 5000 && (!box || !F.norm(box.innerText))) {
        done = true; F.say('Sent. Going back to Studio.', 'ok'); F.status('sent');
      }
      return;
    }
    if (box && !typing) {
      typing = true;
      typed = await F.typeInto(box, job.text, true);
      typing = false;
      if (typed) { F.say('Message typed. Check it and press Enter to send.', 'ok'); F.status('typed'); }
      else if (!warned) { warned = true; F.say('Could not type it here. Click the message box and press Ctrl+V (Cmd+V on a Mac).', 'warn'); F.status('stuck', 'Could not type into the Instagram box'); }
      return;
    }
    // Instagram's "Turn on notifications" pop-up: answer "Not now" so the chat is usable.
    const notNow = [...document.querySelectorAll('button')].find((b) => F.visible(b) && /^not now$/.test(F.btnText(b)));
    if (notNow) notNow.click();
    if (!box && !clicked) { const b = messageBtn(); if (b) { clicked = true; b.click(); } }
    if (!box && !warned && Date.now() - started > 20000) {
      warned = true;
      F.say('Click Message on their profile. The text will be typed for you.', 'warn');
      F.status('stuck', 'No Message button found on the profile');
    }
  }, 500);
})();
