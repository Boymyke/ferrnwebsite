const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const tl = JSON.parse(fs.readFileSync('timeline.json', 'utf8'));
  const mode = process.argv[2] || 'preview';
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript((t) => { window.TIMELINE = t; }, tl);
  await p.goto('http://127.0.0.1:8799/index.html', { waitUntil: 'load' });
  await p.evaluate(() => window.ready);
  if (mode === 'preview') {
    const ts = process.argv.slice(3).map(Number);
    for (const t of ts) { await p.evaluate((t) => window.render(t), t); await p.screenshot({ path: `prev-${t}.jpg`, type: 'jpeg', quality: 85 }); }
  } else {
    fs.mkdirSync('out', { recursive: true });
    const n = Math.ceil(tl.total * 30);
    for (let i = 0; i < n; i++) {
      await p.evaluate((t) => window.render(t), i / 30);
      await p.screenshot({ path: `out/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
      if (i % 150 === 0) console.log('frame', i, '/', n);
    }
  }
  console.log('errors', errs.slice(0, 5)); await b.close();
})();
