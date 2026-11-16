// Ferrn DM helper: opens the chat Studio asks for, hands the message to that tab, and reports back to Studio.
// It never presses send. Only instagram.com and linkedin.com links are opened.
const OK = /^https:\/\/(www\.)?(instagram\.com|linkedin\.com)\//;
const getJobs = async () => (await chrome.storage.session.get('jobs')).jobs || {};
const setJobs = (jobs) => chrome.storage.session.set({ jobs });
const tell = (tabId, msg) => { if (tabId != null) chrome.tabs.sendMessage(tabId, msg).catch(() => {}); };

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    const tabId = sender.tab && sender.tab.id;
    if (msg.type === 'open') {
      if (!OK.test(msg.url || '') || !msg.text) return reply({ ok: false, error: 'Only Instagram and LinkedIn chats can be opened' });
      const tab = await chrome.tabs.create({ url: msg.url, active: true, index: sender.tab ? sender.tab.index + 1 : undefined });
      const jobs = await getJobs();
      jobs[tab.id] = { id: msg.id, text: msg.text, note: msg.note || '', platform: msg.platform, studioTab: tabId, at: Date.now() };
      await setJobs(jobs);
      return reply({ ok: true });
    }
    if (msg.type === 'job') return reply((await getJobs())[tabId] || null);
    if (msg.type === 'status') {
      const jobs = await getJobs();
      const job = jobs[tabId];
      if (!job) return reply({ ok: false });
      tell(job.studioTab, { type: msg.status, id: job.id, detail: msg.detail || '' });
      if (msg.status === 'sent') {
        delete jobs[tabId];
        await setJobs(jobs);
        setTimeout(() => {
          chrome.tabs.remove(tabId).catch(() => {});
          if (job.studioTab != null) chrome.tabs.update(job.studioTab, { active: true }).catch(() => {});
        }, 1200);
      }
      return reply({ ok: true });
    }
    reply(null);
  })();
  return true; // async reply
});

// Closed the chat without sending: Studio keeps it in Ready.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const jobs = await getJobs();
  const job = jobs[tabId];
  if (!job) return;
  delete jobs[tabId];
  await setJobs(jobs);
  tell(job.studioTab, { type: 'closed', id: job.id });
});
