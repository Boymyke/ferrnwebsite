/* Ferrn client documents: signature pad, sign / respond, receipt upload, copy and print. No dependencies. */
(function () {
  'use strict';
  var body = document.body;
  var base = body.getAttribute('data-base') || '';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  $$('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-copy');
      var done = function () { var t = b.textContent; b.textContent = 'Copied'; b.classList.add('ok'); setTimeout(function () { b.textContent = t; b.classList.remove('ok'); }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(v).then(done, function () { window.prompt('Copy', v); });
      else window.prompt('Copy', v);
    });
  });

  function post(url, data, isForm) {
    return fetch(url, {
      method: 'POST', credentials: 'same-origin',
      headers: isForm ? { accept: 'application/json' } : { 'content-type': 'application/json', accept: 'application/json' },
      body: isForm ? data : JSON.stringify(data),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.ok === false) throw new Error(j.error || 'Something went wrong. Please try again.'); return j; });
    });
  }

  /* ── signature pad ── */
  var canvas = $('#sig-canvas');
  var mode = 'draw';
  var drawn = false;
  if (canvas) {
    var ctx = canvas.getContext('2d');
    var lastW = 0;
    var size = function () {
      var w = canvas.parentElement.clientWidth;
      if (!w || w === lastW) return;
      lastW = w;
      var h = Math.max(160, Math.min(220, Math.round(w * 0.32)));
      var dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2.4;
      drawn = false;
      canvas.parentElement.classList.remove('has-ink');
    };
    size();
    window.addEventListener('resize', size);
    var down = false, px = 0, py = 0;
    var pos = function (e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', function (e) {
      down = true; canvas.setPointerCapture(e.pointerId);
      var p = pos(e); px = p[0]; py = p[1];
      ctx.beginPath(); ctx.arc(px, py, 1.1, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
      drawn = true; canvas.parentElement.classList.add('has-ink'); e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!down) return;
      var p = pos(e);
      var w = e.pressure && e.pointerType === 'pen' ? 1.2 + e.pressure * 2.6 : 2.4;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px, py, (px + p[0]) / 2, (py + p[1]) / 2);
      ctx.lineTo(p[0], p[1]); ctx.stroke();
      px = p[0]; py = p[1]; e.preventDefault();
    });
    var up = function () { down = false; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('pointerleave', up);
    $('#sig-clear').addEventListener('click', function () { lastW = 0; size(); });

    $$('.sig-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.getAttribute('data-mode');
        $$('.sig-tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
        $$('.sig-pane').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== mode; });
        if (mode === 'draw') { lastW = 0; size(); }
        else { var t = $('#sig-typed'); if (!t.value) t.value = ($('#sign-form [name=name]').value || ''); t.dispatchEvent(new Event('input')); t.focus(); }
      });
    });
    var typed = $('#sig-typed');
    typed.addEventListener('input', function () { $('#sig-typed-preview').textContent = typed.value; });
  }

  function typedSignature(text) {
    var c = document.createElement('canvas');
    c.width = 1000; c.height = 260;
    var x = c.getContext('2d');
    var font = '"Pinyon Script", cursive';
    var draw = function () {
      var px = 120;
      x.font = px + 'px ' + font;
      while (x.measureText(text).width > 920 && px > 40) { px -= 6; x.font = px + 'px ' + font; }
      x.fillStyle = '#111'; x.textBaseline = 'middle'; x.textAlign = 'center';
      x.fillText(text, 500, 140);
      return c.toDataURL('image/png');
    };
    if (document.fonts && document.fonts.load) return document.fonts.load('120px "Pinyon Script"').then(draw, draw);
    return Promise.resolve(draw());
  }

  var signForm = $('#sign-form');
  if (signForm) {
    signForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('#sign-err'); err.textContent = '';
      var f = signForm.elements;
      var name = f.name.value.trim();
      if (name.length < 2) { err.textContent = 'Please enter your full name.'; f.name.focus(); return; }
      if (!f.agree.checked) { err.textContent = 'Please tick the box to confirm you agree.'; return; }
      var sigP;
      if (mode === 'type') {
        var t = $('#sig-typed').value.trim();
        if (t.length < 2) { err.textContent = 'Please type your signature.'; return; }
        sigP = typedSignature(t);
      } else {
        if (!drawn) { err.textContent = 'Please draw your signature in the box, or switch to “Type signature”.'; return; }
        sigP = Promise.resolve(canvas.toDataURL('image/png'));
      }
      var btn = signForm.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Signing…';
      sigP.then(function (sig) {
        return post(base + '/sign', { name: name, title: f.title.value.trim(), agree: true, mode: mode, signature: sig, content_hash: f.content_hash.value });
      }).then(function (r) {
        btn.textContent = 'Signed ✓';
        window.location.href = r.invoice_url || base;
      }).catch(function (x) { err.textContent = x.message; btn.disabled = false; btn.textContent = 'Sign proposal'; });
    });
  }

  var respond = $('#respond-form');
  if (respond) {
    respond.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('#respond-err'); err.textContent = '';
      var kind = (respond.querySelector('[name=kind]:checked') || {}).value || 'changes';
      var msg = respond.elements.message.value.trim();
      if (msg.length < 3) { err.textContent = 'Please add a short message.'; return; }
      if (kind === 'decline' && !window.confirm('Decline this proposal? You can still contact us later.')) return;
      var btn = respond.querySelector('button'); btn.disabled = true;
      post(base + '/respond', { kind: kind, message: msg }).then(function () {
        respond.innerHTML = '<p class="ok-msg">Thank you — we’ve received your message and will reply within one working day.</p>';
        if (kind === 'decline') setTimeout(function () { window.location.reload(); }, 1200);
      }).catch(function (x) { err.textContent = x.message; btn.disabled = false; });
    });
  }

  /* ── receipts ── */
  var rf = $('#receipt-form');
  if (rf) {
    var input = rf.querySelector('input[type=file]');
    var list = $('#drop-files');
    var show = function () { list.textContent = Array.prototype.map.call(input.files, function (f) { return f.name; }).join(', '); };
    input.addEventListener('change', show);
    var drop = rf.querySelector('.drop');
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length) { input.files = e.dataTransfer.files; show(); } });
    rf.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('#receipt-err'); err.textContent = '';
      if (!input.files.length) { err.textContent = 'Choose at least one file.'; return; }
      for (var i = 0; i < input.files.length; i++) {
        if (input.files[i].size > 10 * 1024 * 1024) { err.textContent = input.files[i].name + ' is larger than 10 MB.'; return; }
      }
      var btn = rf.querySelector('button'); btn.disabled = true; btn.textContent = 'Uploading…';
      post(base + '/receipts', new FormData(rf), true).then(function () {
        window.location.href = base + '?uploaded=1';
      }).catch(function (x) { err.textContent = x.message; btn.disabled = false; btn.textContent = 'Upload receipt'; });
    });
  }
})();
