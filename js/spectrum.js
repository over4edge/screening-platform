// 频谱波形区间标注：考试页可拖拽框选并命名；答卷页只读展示，两种模式都可点“试听区间”。
const SPEC_COLORS = ['#4f8cff', '#ff8c42', '#38cfa0', '#ff5d73', '#b07cff', '#ffcf3f', '#5ad8a6', '#f759ab'];
const SPEC_LABELS = ['前奏', '主歌', '副歌', '间奏', '尾奏', '桥段'];
const _waveCache = {};

function getWave(url, cb) {
  if (_waveCache[url] !== undefined) { cb(_waveCache[url]); return; }
  fetch(url, { referrerPolicy: 'no-referrer' })
    .then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
    .then(buf => {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw 0;
      return new Ctx().decodeAudioData(buf);
    })
    .then(ab => {
      const ch = ab.getChannelData(0), N = 180, step = Math.floor(ch.length / N), peaks = [];
      for (let i = 0; i < N; i++) {
        let mx = 0;
        for (let j = i * step; j < (i + 1) * step && j < ch.length; j++) { const a = Math.abs(ch[j]); if (a > mx) mx = a; }
        peaks.push(mx);
      }
      _waveCache[url] = { peaks, dur: ab.duration };
      cb(_waveCache[url]);
    })
    .catch(() => { _waveCache[url] = null; cb(null); });
}
function pseudoWave(seed) {
  const p = []; let x = (seed + 1) * 7919;
  for (let i = 0; i < 180; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const v = (x % 100) / 100, env = 0.55 + 0.45 * Math.sin((i / 180) * Math.PI * 2 + seed);
    p.push(v * env * 0.85);
  }
  return p;
}
function playRange(audio, start, end) {
  if (!audio) return;
  try { audio.pause(); } catch (e) {}
  if (audio._stop) audio.removeEventListener('timeupdate', audio._stop);
  const stop = function () { if (audio.currentTime >= end || audio.ended) { try { audio.pause(); } catch (e) {} audio.removeEventListener('timeupdate', stop); audio._stop = null; } };
  audio._stop = stop; audio.addEventListener('timeupdate', stop);
  try { audio.currentTime = start; } catch (e) {}
  audio.play().catch(() => {});
}

// host: 空容器；audio: 关联的播放器 audio；opts:{dur,segs:[],readonly:bool}
function mountSpectrum(host, audio, url, opts) {
  const o = Object.assign({ dur: 60, segs: [], readonly: false }, opts || {});
  let dur = o.dur || 60;
  const wrap = el('div', 'spec-wrap');
  const canvas = document.createElement('canvas'); canvas.className = 'spec-canvas';
  const ticks = el('div', 'spec-ticks');
  wrap.appendChild(canvas); wrap.appendChild(ticks);
  const labels = el('div', 'spec-labels');
  host.appendChild(wrap); host.appendChild(labels);
  let peaks = null, drag = null;

  function makeTicks() {
    const n = Math.max(2, Math.min(8, Math.round(dur / 30))), step = dur / n;
    ticks.innerHTML = '';
    for (let k = 0; k <= n; k++) {
      const s = document.createElement('span');
      s.style.left = ((k * step) / dur * 100) + '%';
      s.textContent = fmt(k * step);
      ticks.appendChild(s);
    }
  }
  function cw() { return canvas.clientWidth || 640; }
  function xToT(x) { return Math.max(0, Math.min(dur, (x / cw()) * dur)); }
  function sortedSegs() { return o.segs.slice().sort((a, b) => a.start - b.start); }

  function draw() {
    const dpr = window.devicePixelRatio || 1, w = cw(), h = 120;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const pk = peaks || pseudoWave(0), mid = h / 2, bw = w / pk.length;
    ctx.fillStyle = 'rgba(236,230,218,0.55)';
    for (let i = 0; i < pk.length; i++) {
      const bh = Math.max(2, pk[i] * mid * 1.8);
      ctx.fillRect(i * bw + 0.5, mid - bh / 2, Math.max(0.8, bw - 1), bh);
    }
    sortedSegs().forEach((seg, ki) => {
      const x1 = seg.start / dur * w, x2 = seg.end / dur * w, col = SPEC_COLORS[ki % SPEC_COLORS.length];
      ctx.globalAlpha = 0.3; ctx.fillStyle = col; ctx.fillRect(x1, 0, Math.max(2, x2 - x1), h); ctx.globalAlpha = 1;
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(x1 + 0.75, 0.75, Math.max(2, x2 - x1) - 1.5, h - 1.5);
      ctx.fillStyle = col; ctx.font = '700 11px sans-serif'; ctx.textBaseline = 'top';
      ctx.fillText(seg.label, x1 + 5, 5);
    });
    if (drag && drag.start != null && drag.cur != null) {
      const a = Math.min(drag.start, drag.cur), b = Math.max(drag.start, drag.cur);
      ctx.fillStyle = 'rgba(232,163,61,0.25)'; ctx.fillRect(a, 0, Math.max(2, b - a), h);
      ctx.strokeStyle = '#e8a33d'; ctx.lineWidth = 2; ctx.strokeRect(a, 0, Math.max(2, b - a), h);
      ctx.fillStyle = '#f4c46d'; ctx.font = '700 11px sans-serif'; ctx.textBaseline = 'top';
      ctx.fillText(fmt(xToT(a)) + ' – ' + fmt(xToT(b)), a + 5, h - 20);
    }
  }

  function renderList() {
    labels.innerHTML = '';
    if (!o.segs.length) { labels.appendChild(el('div', 'seg-empty', o.readonly ? '本曲未标注结构段落。' : '尚未标注。在频谱上拖动框选段落并命名。')); return; }
    sortedSegs().forEach((seg, ki) => {
      const item = el('div', 'seg-item');
      const dot = el('span', 'dot'); dot.style.background = SPEC_COLORS[ki % SPEC_COLORS.length];
      item.appendChild(dot);
      item.appendChild(el('span', 'seg-txt', (ki + 1) + '. ' + seg.label + ' · ' + fmt(seg.start) + ' – ' + fmt(seg.end)));
      const play = document.createElement('button');
      play.className = 'seg-play'; play.textContent = '▶ 试听';
      play.style.cssText = 'margin-left:auto;border:1px solid rgba(232,163,61,.55);background:transparent;color:#e8a33d;border-radius:6px;padding:2px 9px;cursor:pointer;font-size:12px;';
      play.onclick = () => playRange(audio, seg.start, seg.end);
      item.appendChild(play);
      if (!o.readonly) {
        const del = el('button', 'seg-del', '×'); del.setAttribute('aria-label', '删除');
        del.onclick = () => { o.segs.splice(o.segs.indexOf(seg), 1); renderList(); draw(); };
        item.appendChild(del);
      }
      labels.appendChild(item);
    });
  }

  function openPending(t1, t2) {
    const old = labels.querySelector('.spec-pending'); if (old) old.remove();
    const box = el('div', 'spec-pending');
    box.appendChild(el('div', 'ptime', '已框选 ' + fmt(t1) + ' – ' + fmt(t2) + '，请命名这个段落：'));
    const pre = document.createElement('button');
    pre.className = 'btn ghost'; pre.style.cssText = 'margin:4px 0 2px;padding:6px 14px;font-size:13px;';
    pre.textContent = '▶ 试听此区间'; pre.onclick = () => playRange(audio, t1, t2);
    box.appendChild(pre);
    const chips = el('div', 'chips');
    SPEC_LABELS.forEach(lb => {
      const c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.textContent = lb;
      c.onclick = () => addSeg(t1, t2, lb);
      chips.appendChild(c);
    });
    box.appendChild(chips);
    const row = el('div', 'pendrow');
    const inp = document.createElement('input'); inp.className = 'input pendinp'; inp.placeholder = '或输入自定义结构名';
    const ok = document.createElement('button'); ok.className = 'btn pendok'; ok.textContent = '确定';
    ok.onclick = () => { const v = inp.value.trim(); if (v) addSeg(t1, t2, v); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok.click(); });
    row.appendChild(inp); row.appendChild(ok);
    box.appendChild(row);
    labels.insertBefore(box, labels.firstChild);
    setTimeout(() => inp.focus(), 30);
  }
  function addSeg(t1, t2, label) {
    o.segs.push({ start: t1, end: t2, label });
    const p = labels.querySelector('.spec-pending'); if (p) p.remove();
    renderList(); draw();
  }

  if (!o.readonly) {
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag = { start: e.offsetX, cur: e.offsetX };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      draw();
    });
    canvas.addEventListener('pointermove', e => { if (!drag) return; drag.cur = e.offsetX; draw(); });
    const up = () => {
      if (!drag) return;
      if (drag.start != null && drag.cur != null) {
        const t1 = xToT(Math.min(drag.start, drag.cur)), t2 = xToT(Math.max(drag.start, drag.cur));
        if (t2 - t1 >= 3) openPending(t1, t2);
      }
      drag = null; draw();
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', () => { drag = null; draw(); });
  }

  audio.addEventListener('loadedmetadata', () => {
    const d = audio.duration;
    if (isFinite(d) && d > 0 && !o.dur) { dur = d; makeTicks(); draw(); }
  });
  getWave(url, w => {
    if (w && w.dur && !o.dur) dur = w.dur;
    peaks = w ? w.peaks : null; makeTicks(); draw();
  });
  makeTicks(); draw(); renderList();
  return { getSegs: () => sortedSegs(), redraw: draw };
}
