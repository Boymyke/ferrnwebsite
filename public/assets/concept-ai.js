/* Concept AI assistant widget. Inlined into concept sites (they run sandboxed), configured by
   window.CONCEPT_AI = { slug, name, color, ink, logo (svg markup), greeting, chips: [] }. Talks to
   https://www.ferrnagency.com/api/concept-ai/<slug>. */
(function () {
  var C = window.CONCEPT_AI || {}; if (!C.slug || document.getElementById('cai')) return;
  var API = 'https://www.ferrnagency.com/api/concept-ai/' + C.slug;
  var col = C.color || '#1EF7C4', ink = C.ink || '#0A0F0D', deep = C.deep || '#007A5E';
  var css = '#cai{position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:inherit}' +
    '#cai *{box-sizing:border-box}' +
    '#cai .cai-fab{display:flex;align-items:center;gap:10px;height:56px;padding:0 20px 0 8px;border:0;border-radius:999px;background:' + ink + ';color:#fff;font:600 15px/1 inherit;font-family:inherit;cursor:pointer;box-shadow:0 18px 40px -12px rgba(0,0,0,.45)}' +
    '#cai .cai-fab i{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:' + col + '}' +
    '#cai .cai-fab i svg{width:24px;height:24px}' +
    '#cai .cai-dot{width:8px;height:8px;border-radius:50%;background:' + col + ';box-shadow:0 0 0 4px rgba(30,247,196,.25)}' +
    '#cai .cai-box{position:absolute;right:0;bottom:70px;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 120px));display:none;flex-direction:column;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(0,0,0,.45);border:1px solid rgba(0,0,0,.06)}' +
    '#cai.open .cai-box{display:flex;animation:caiIn .3s cubic-bezier(.2,.8,.2,1)}@keyframes caiIn{from{opacity:0;transform:translateY(12px) scale(.98)}}' +
    '#cai .cai-head{display:flex;align-items:center;gap:12px;padding:16px 18px;background:' + ink + ';color:#fff}' +
    '#cai .cai-head i{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:' + col + ';flex:none}#cai .cai-head i svg{width:22px;height:22px}' +
    '#cai .cai-head b{display:block;font-size:15px}#cai .cai-head small{display:flex;align-items:center;gap:6px;font-size:12px;opacity:.75}' +
    '#cai .cai-x{margin-left:auto;background:rgba(255,255,255,.1);border:0;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;line-height:1}' +
    '#cai .cai-log{flex:1;overflow:auto;padding:16px;background:#F4F7F6;display:flex;flex-direction:column;gap:10px}' +
    '#cai .cai-m{max-width:85%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap}' +
    '#cai .cai-m.b{background:#fff;color:' + ink + ';border:1px solid #E6ECE9;border-bottom-left-radius:4px;align-self:flex-start}' +
    '#cai .cai-m.u{background:' + deep + ';color:#fff;border-bottom-right-radius:4px;align-self:flex-end}' +
    '#cai .cai-typing{display:flex;gap:4px;padding:12px 14px}#cai .cai-typing span{width:6px;height:6px;border-radius:50%;background:#9AA8A2;animation:caiT 1s infinite}#cai .cai-typing span:nth-child(2){animation-delay:.15s}#cai .cai-typing span:nth-child(3){animation-delay:.3s}@keyframes caiT{50%{transform:translateY(-3px);opacity:.5}}' +
    '#cai .cai-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px;background:#F4F7F6}' +
    '#cai .cai-chips button{border:1px solid #D6E2DD;background:#fff;color:' + ink + ';border-radius:999px;padding:7px 11px;font:500 12.5px inherit;font-family:inherit;cursor:pointer}#cai .cai-chips button:hover{border-color:' + deep + '}' +
    '#cai form{display:flex;gap:8px;padding:12px;border-top:1px solid #E6ECE9;background:#fff}' +
    '#cai input{flex:1;height:44px;border:1px solid #D6E2DD;border-radius:12px;padding:0 14px;font:14px inherit;font-family:inherit;outline:none}#cai input:focus{border-color:' + deep + '}' +
    '#cai form button{width:44px;height:44px;border:0;border-radius:12px;background:' + col + ';color:' + ink + ';cursor:pointer;font-size:18px}' +
    '#cai .cai-by{font-size:11px;color:#9AA8A2;text-align:center;padding:0 0 8px;background:#fff}' +
    '@media(max-width:520px){#cai{right:12px;bottom:12px}#cai .cai-fab span{display:none}#cai .cai-fab{padding:0 8px}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var logo = C.logo || '';
  var w = document.createElement('div'); w.id = 'cai';
  w.innerHTML = '<div class="cai-box" role="dialog" aria-label="Chat with ' + C.name + '"><div class="cai-head"><i>' + logo + '</i><div><b>' + (C.title || C.name + ' Assistant') + '</b><small><span class="cai-dot"></span>Online, replies instantly</small></div><button class="cai-x" aria-label="Close">×</button></div>' +
    '<div class="cai-log" aria-live="polite"></div><div class="cai-chips"></div><form><input placeholder="Ask about shipping, quotes, tracking…" aria-label="Your message"><button aria-label="Send">➤</button></form><div class="cai-by">AI assistant · answers from ' + C.name + ' information</div></div>' +
    '<button class="cai-fab" aria-label="Open chat"><i>' + logo + '</i><span>' + (C.cta || 'Ask us anything') + '</span></button>';
  document.body.appendChild(w);
  var log = w.querySelector('.cai-log'), chips = w.querySelector('.cai-chips'), form = w.querySelector('form'), inp = w.querySelector('input');
  var msgs = [];
  function add(role, text) { var d = document.createElement('div'); d.className = 'cai-m ' + (role === 'user' ? 'u' : 'b'); d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
  function greet() { if (msgs.length) return; add('assistant', C.greeting || ('Hi! I am the ' + C.name + ' assistant. How can I help?')); (C.chips || []).forEach(function (t) { var b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = function () { send(t); }; chips.appendChild(b); }); }
  function send(text) {
    text = String(text || '').trim(); if (!text) return; chips.innerHTML = ''; add('user', text); msgs.push({ role: 'user', content: text }); inp.value = '';
    var t = document.createElement('div'); t.className = 'cai-m b cai-typing'; t.innerHTML = '<span></span><span></span><span></span>'; log.appendChild(t); log.scrollTop = log.scrollHeight;
    fetch(API, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ messages: msgs, context: (document.title || '') + ' ' + (location.hash || '') }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { t.remove(); var reply = j.ok ? j.reply : (j.error || 'Sorry, something went wrong.'); add('assistant', reply); if (j.ok) msgs.push({ role: 'assistant', content: reply }); })
      .catch(function () { t.remove(); add('assistant', 'I could not connect just now. Please call or email the team.'); });
  }
  w.querySelector('.cai-fab').onclick = function () { w.classList.toggle('open'); if (w.classList.contains('open')) { greet(); setTimeout(function () { inp.focus(); }, 50); } };
  w.querySelector('.cai-x').onclick = function () { w.classList.remove('open'); };
  form.onsubmit = function (e) { e.preventDefault(); send(inp.value); };
  window.conceptAiAsk = function (q) { w.classList.add('open'); greet(); send(q); };
})();
