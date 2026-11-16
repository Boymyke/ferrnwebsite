// Lets Ferrn Studio know the helper is installed and relays between the page and the helper.
document.documentElement.dataset.ferrnHelper = chrome.runtime.getManifest().version;
const post = (data) => window.postMessage({ source: 'ferrn-helper', ...data }, location.origin);
window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || e.data.source !== 'ferrn-studio' || e.data.type !== 'open') return;
  const d = e.data;
  try {
    chrome.runtime.sendMessage({ type: 'open', url: d.url, id: d.id, text: d.text, note: d.note, platform: d.platform }, (r) => {
      if (chrome.runtime.lastError || !r || !r.ok) post({ type: 'error', id: d.id, detail: (r && r.error) || 'The helper did not answer. Reload this page.' });
      else post({ type: 'opened', id: d.id });
    });
  } catch { post({ type: 'error', id: d.id, detail: 'The helper was updated. Reload this page.' }); }
});
chrome.runtime.onMessage.addListener((m) => { post({ type: m.type, id: m.id, detail: m.detail }); });
