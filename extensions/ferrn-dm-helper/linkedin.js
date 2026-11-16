// LinkedIn: message a connection, or type the connection note if you are not connected yet.
(async () => {
  const F = FERRN;
  const job = await F.job();
  if (!job || job.platform !== 'linkedin') return;
  F.say('Opening the chat…');
  const composer = () => [...document.querySelectorAll('.msg-form__contenteditable[contenteditable="true"], .msg-form div[role="textbox"][contenteditable="true"]')].find(F.visible);
  const noteBox = () => [...document.querySelectorAll('textarea[name="message"], textarea#custom-message')].find(F.visible);
  const btn = (re) => [...document.querySelectorAll('button, div[role="button"]')].find((b) => F.visible(b) && re.test(F.btnText(b)));
  let mode = null, typed = false, typing = false, step = 0, intentAt = 0, done = false, warned = false;
  const started = Date.now();
  document.addEventListener('keydown', (e) => { if (e.isTrusted && e.key === 'Enter' && !e.shiftKey && mode === 'message') { intentAt = Date.now(); F.markIntent(); } }, true);
  document.addEventListener('click', (e) => {
    if (!e.isTrusted) return;
    const b = e.target.closest && e.target.closest('button, [role="button"]');
    if (b && /^(send|send now|send invitation)$/.test(F.btnText(b))) { intentAt = Date.now(); F.markIntent(); }
  }, true);
  const setNote = (el, text) => {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    set.call(el, text.slice(0, 300));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return F.norm(el.value).length > 0;
  };
  const timer = setInterval(async () => {
    if (done) return clearInterval(timer);
    if (typed) {
      const gone = mode === 'message' ? (() => { const c = composer(); return !c || !F.norm(c.innerText); })() : !noteBox();
      if (intentAt && Date.now() - intentAt < 6000 && gone) { done = true; F.say('Sent. Going back to Studio.', 'ok'); F.status('sent'); }
      return;
    }
    if (typing) return;
    const box = composer();
    if (box) {
      typing = true; mode = 'message';
      typed = await F.typeInto(box, job.text, false);
      typing = false;
      if (typed) { F.say('Message typed. Check it and press Send.', 'ok'); F.status('typed'); }
      else if (!warned) { warned = true; F.say('Could not type it here. Click the message box and press Ctrl+V.', 'warn'); F.status('stuck', 'Could not type into the LinkedIn box'); }
      return;
    }
    const nb = noteBox();
    if (nb && job.note) {
      mode = 'note'; typed = setNote(nb, job.note);
      if (typed) { F.say('Connection note typed. Check it and press Send.', 'ok'); F.status('typed', 'Connection request note'); }
      return;
    }
    if (step === 0) {
      const m = btn(/^message( |$)/);
      if (m) { step = 1; m.click(); return; }
      if (job.note) {
        const c = btn(/^invite .* to connect$|^connect$/);
        if (c) { step = 2; c.click(); return; }
      }
    }
    if (step === 2) { const add = btn(/^add a note$/); if (add) { step = 3; add.click(); return; } }
    if (!warned && Date.now() - started > 20000) {
      warned = true;
      F.say(job.note ? 'Click Message (or Connect, then Add a note). The text will be typed for you.' : 'Click Message on their profile. The text will be typed for you.', 'warn');
      F.status('stuck', 'No Message or Connect button found');
    }
  }, 500);
})();
