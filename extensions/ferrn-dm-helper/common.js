// Shared by the Instagram and LinkedIn scripts: the small Ferrn badge and safe typing into a chat box.
var FERRN = (() => {
  const visible = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let badge;
  function say(text, tone) {
    if (!badge) {
      badge = document.createElement('div');
      badge.setAttribute('data-ferrn-badge', '');
      badge.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;max-width:320px;padding:12px 14px;border-radius:8px;'
        + 'font:500 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#fff;background:#111;box-shadow:0 6px 24px rgba(0,0,0,.25);border:1px solid #333';
      document.documentElement.appendChild(badge);
    }
    badge.style.borderColor = tone === 'ok' ? '#1f9d63' : tone === 'warn' ? '#d08a1f' : '#333';
    badge.innerHTML = '<div style="font-weight:700;margin-bottom:2px">Ferrn</div>';
    const p = document.createElement('div'); p.textContent = text; badge.appendChild(p);
  }
  const has = (el, text) => norm(el.innerText || el.textContent).includes(norm(text).slice(0, 30));
  /** Types the message into the chat box. Paste first (keeps line breaks, never triggers send), then insertText. */
  let intent = 0;
  const sentSince = () => intent && Date.now() - intent < 5000;
  const markIntent = () => { intent = Date.now(); };
  async function typeInto(el, text, flatFallback) {
    el.focus();
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    } catch { /* older browser */ }
    for (let i = 0; i < 8; i++) { await wait(50); if (has(el, text)) return true; }
    if (sentSince()) return true; // you pressed Enter already: never type it a second time
    el.focus();
    document.execCommand('insertText', false, flatFallback ? text.replace(/\s*\n+\s*/g, ' ') : text);
    await wait(300);
    return has(el, text);
  }
  const status = (s, detail) => chrome.runtime.sendMessage({ type: 'status', status: s, detail }).catch(() => {});
  const job = () => chrome.runtime.sendMessage({ type: 'job' }).catch(() => null);
  const btnText = (el) => norm(el.getAttribute('aria-label') || el.innerText || el.textContent);
  return { visible, norm, wait, say, typeInto, status, job, btnText, markIntent };
})();
