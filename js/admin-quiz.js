// 题库编辑器：素材管理 + 三部分题目在线编辑，全部保存在服务端 uploads/<task>/。
const taskId = new URLSearchParams(location.search).get('task') || '';
const API_BASE = (window.SP_CONFIG && SP_CONFIG.apiBase) || localStorage.getItem('sp_api_base') || '';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let bank = { part1: [], part2: [], part3: [] };
let media = []; // {name, url}

function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2200); }
function api(method, path, body) {
  const headers = {};
  const t = localStorage.getItem('sp_admin_token');
  if (t) headers['Authorization'] = 'Bearer ' + t;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(API_BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }).then(async r => {
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(j.error || ('请求失败（' + r.status + '）'));
    return j;
  });
}

/* ---------- 素材库 ---------- */
function renderMedia() {
  const g = $('media-grid');
  if (!media.length) { g.innerHTML = '<div class="empty">暂无素材，先上传音频文件。</div>'; return; }
  g.innerHTML = '';
  media.forEach(m => {
    const refs = countRefs(m.name);
    const item = document.createElement('div'); item.className = 'media-item';
    const f = document.createElement('div'); f.className = 'fname'; f.textContent = m.name;
    const a = document.createElement('audio'); a.controls = true; a.preload = 'none'; a.src = m.url;
    const ops = document.createElement('div'); ops.className = 'ops';
    const ref = document.createElement('span');
    ref.className = 'ref' + (refs ? '' : ' bad');
    ref.textContent = refs ? ('被 ' + refs + ' 题引用') : '未引用';
    const del = document.createElement('button'); del.className = 'btn small danger'; del.textContent = '删除';
    del.onclick = async () => {
      const tip = refs ? '该素材正被 ' + refs + ' 题引用，删除后对应题目音频会失效，仍要删除吗？' : '确定删除该素材？';
      if (!confirm(tip)) return;
      try { await api('DELETE', '/api/admin/tasks/' + encodeURIComponent(taskId) + '/media', { name: m.name }); toast('已删除 ' + m.name); await loadAll(); }
      catch (e) { toast(e.message); }
    };
    ops.appendChild(ref); ops.appendChild(del);
    item.appendChild(f); item.appendChild(a); item.appendChild(ops);
    g.appendChild(item);
  });
}
function countRefs(name) {
  const rel = 'media/' + name;
  let n = 0;
  n += bank.part1.filter(q => q.url === rel).length;
  n += bank.part2.filter(q => q.url === rel).length;
  n += bank.part3.filter(q => q.url === rel).length;
  return n;
}
$('btn-upload').onclick = async () => {
  const files = $('file-input').files;
  if (!files.length) return toast('请先选择文件');
  const prog = $('upload-prog'); prog.textContent = '0/' + files.length;
  let ok = 0, fail = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const fd = new FormData(); fd.append('file', f);
    try {
      const r = await fetch(API_BASE + '/api/admin/tasks/' + encodeURIComponent(taskId) + '/media', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('sp_admin_token') }, body: fd
      });
      const j = await r.json();
      if (!r.ok) { fail++; console.warn(f.name, j.error); } else ok++;
    } catch (e) { fail++; console.warn(f.name, e.message); }
    prog.textContent = (i + 1) + '/' + files.length;
  }
  $('file-input').value = '';
  toast('上传完成：成功 ' + ok + '，失败 ' + fail);
  await loadAll();
};

/* ---------- 题目渲染 ---------- */
function mediaOptions(sel) {
  let h = '<option value="">（无）</option>';
  media.forEach(m => {
    const rel = 'media/' + m.name;
    h += '<option value="' + esc(rel) + '"' + (rel === sel ? ' selected' : '') + '>' + esc(m.name) + '</option>';
  });
  return h;
}
function mediaRow(sel) {
  const row = document.createElement('div'); row.className = 'row';
  const selEl = document.createElement('select'); selEl.className = 'media';
  selEl.innerHTML = mediaOptions(sel);
  const aud = document.createElement('audio'); aud.controls = true; aud.preload = 'none';
  const upd = () => { const v = selEl.value; const mm = media.find(x => 'media/' + x.name === v); aud.src = mm ? mm.url : ''; };
  selEl.onchange = upd; upd();
  row.appendChild(selEl); row.appendChild(aud);
  return { el: row, sel: selEl, aud };
}

function renderPart1() {
  const host = $('part-p1'); host.innerHTML = '';
  if (!bank.part1.length) host.innerHTML = '<div class="empty">还没有客观题。点击下方「+ 添加客观题」。</div>';
  bank.part1.forEach((q, i) => {
    const card = document.createElement('div'); card.className = 'q-card';
    const head = document.createElement('div'); head.className = 'q-head';
    head.innerHTML = '<div class="q-index">' + (i + 1) + '</div><span class="sp"></span><button class="btn small danger">删除本题</button>';
    head.lastElementChild.onclick = () => { bank.part1.splice(i, 1); renderAll(); };
    card.appendChild(head);

    const mr = mediaRow(q.url); card.appendChild(mr.el);

    const rq = document.createElement('div'); rq.className = 'row';
    rq.innerHTML = '<label class="lbl">题干</label>';
    const qi = document.createElement('input'); qi.type = 'text'; qi.className = 'q'; qi.placeholder = '例如：这段音频主要是什么声音？';
    qi.value = q.q || ''; qi.oninput = () => { q.q = qi.value; };
    rq.appendChild(qi); card.appendChild(rq);

    const optsHost = document.createElement('div');
    const renderOpts = () => {
      optsHost.innerHTML = '';
      q.opts.forEach((o, oi) => {
        const or = document.createElement('div'); or.className = 'opt-row';
        or.innerHTML = '<span class="opt-tag">' + String.fromCharCode(65 + oi) + '</span>';
        const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'ans' + i;
        radio.checked = (q.ans === o); radio.onchange = () => { q.ans = o; renderOpts(); };
        const inp = document.createElement('input'); inp.type = 'text'; inp.value = o;
        inp.placeholder = '选项内容'; inp.oninput = () => { const old = o; q.opts[oi] = inp.value; if (q.ans === old) q.ans = inp.value; };
        const del = document.createElement('button'); del.className = 'btn small danger'; del.textContent = '×';
        del.onclick = () => { if (q.opts.length <= 2) return toast('至少保留两个选项'); q.opts.splice(oi, 1); if (!q.opts.includes(q.ans)) q.ans = ''; renderOpts(); };
        or.appendChild(radio); or.appendChild(inp); or.appendChild(del);
        optsHost.appendChild(or);
      });
      const add = document.createElement('button'); add.className = 'btn small mt'; add.textContent = '+ 添加选项';
      add.onclick = () => { q.opts.push(''); renderOpts(); };
      optsHost.appendChild(add);
    };
    renderOpts();
    card.appendChild(optsHost);
    host.appendChild(card);
  });
  const add = document.createElement('button'); add.className = 'btn'; add.style.marginTop = '4px'; add.textContent = '+ 添加客观题';
  add.onclick = () => { bank.part1.push({ q: '', url: '', opts: ['', '', '', ''], ans: '' }); renderPart1(); };
  host.appendChild(add);
}

function renderPart2() {
  const host = $('part-p2'); host.innerHTML = '';
  if (!bank.part2.length) host.innerHTML = '<div class="empty">还没有主观题。点击下方「+ 添加主观题」。</div>';
  bank.part2.forEach((q, i) => {
    const card = document.createElement('div'); card.className = 'q-card';
    const head = document.createElement('div'); head.className = 'q-head';
    head.innerHTML = '<div class="q-index">' + (i + 1) + '</div><span class="sp"></span><button class="btn small danger">删除本题</button>';
    head.lastElementChild.onclick = () => { bank.part2.splice(i, 1); renderAll(); };
    card.appendChild(head);
    const mr = mediaRow(q.url); card.appendChild(mr.el);
    const r1 = document.createElement('div'); r1.className = 'row';
    r1.innerHTML = '<label class="lbl">题名</label>';
    const ti = document.createElement('input'); ti.type = 'text'; ti.className = 'q'; ti.placeholder = '例如：请描述这段音频的声音';
    ti.value = q.title || ''; ti.oninput = () => { q.title = ti.value; };
    r1.appendChild(ti); card.appendChild(r1);
    const r2 = document.createElement('div'); r2.className = 'row';
    r2.innerHTML = '<label class="lbl">最少字数</label>';
    const mi = document.createElement('input'); mi.type = 'number'; mi.min = '1'; mi.style.width = '90px'; mi.value = q.min || 15;
    mi.oninput = () => { q.min = Math.max(1, Number(mi.value) || 15); };
    r2.appendChild(mi); card.appendChild(r2);
    host.appendChild(card);
  });
  const add = document.createElement('button'); add.className = 'btn'; add.style.marginTop = '4px'; add.textContent = '+ 添加主观题';
  add.onclick = () => { bank.part2.push({ title: '', url: '', min: 15 }); renderPart2(); };
  host.appendChild(add);
}

function renderPart3() {
  const host = $('part-p3'); host.innerHTML = '';
  if (!bank.part3.length) host.innerHTML = '<div class="empty">还没有曲式分析题。点击下方「+ 添加曲式题」。</div>';
  bank.part3.forEach((q, i) => {
    const card = document.createElement('div'); card.className = 'q-card';
    const head = document.createElement('div'); head.className = 'q-head';
    head.innerHTML = '<div class="q-index">' + (i + 1) + '</div><span class="sp"></span><button class="btn small danger">删除本题</button>';
    head.lastElementChild.onclick = () => { bank.part3.splice(i, 1); renderAll(); };
    card.appendChild(head);
    const mr = mediaRow(q.url); card.appendChild(mr.el);
    const r1 = document.createElement('div'); r1.className = 'row';
    r1.innerHTML = '<label class="lbl">题名</label>';
    const ti = document.createElement('input'); ti.type = 'text'; ti.className = 'q'; ti.placeholder = '例如：完整音频结构分析';
    ti.value = q.title || ''; ti.oninput = () => { q.title = ti.value; };
    r1.appendChild(ti); card.appendChild(r1);
    const r2 = document.createElement('div'); r2.className = 'row';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!q.full;
    cb.onchange = () => { q.full = cb.checked; };
    r2.appendChild(cb); r2.appendChild(document.createTextNode('完整时长（整首，用于完整曲式辨认）'));
    card.appendChild(r2);
    host.appendChild(card);
  });
  const add = document.createElement('button'); add.className = 'btn'; add.style.marginTop = '4px'; add.textContent = '+ 添加曲式题';
  add.onclick = () => { bank.part3.push({ title: '', url: '', full: false }); renderPart3(); };
  host.appendChild(add);
}

function renderAll() { renderPart1(); renderPart2(); renderPart3(); renderMedia(); }

/* ---------- tab 切换 ---------- */
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
  ['p1', 'p2', 'p3'].forEach(pp => { $('part-' + pp).style.display = pp === t.dataset.part ? 'block' : 'none'; });
});

/* ---------- 保存 ---------- */
function validate() {
  for (let i = 0; i < bank.part1.length; i++) {
    const q = bank.part1[i];
    if (!q.url) return '第 ' + (i + 1) + ' 道客观题未选择音频文件';
    if (!(q.q || '').trim()) return '第 ' + (i + 1) + ' 道客观题缺少题干';
    const opts = q.opts.map(o => (o || '').trim()).filter(Boolean);
    if (opts.length < 2) return '第 ' + (i + 1) + ' 道客观题至少需要两个选项';
    if (!opts.includes(q.ans)) return '第 ' + (i + 1) + ' 道客观题未标记正确答案';
  }
  for (let i = 0; i < bank.part2.length; i++) {
    if (!bank.part2[i].url) return '第 ' + (i + 1) + ' 道主观题未选择音频文件';
    if (!(bank.part2[i].title || '').trim()) return '第 ' + (i + 1) + ' 道主观题缺少题名';
  }
  for (let i = 0; i < bank.part3.length; i++) {
    if (!bank.part3[i].url) return '第 ' + (i + 1) + ' 道曲式题未选择音频文件';
  }
  if (!bank.part1.length && !bank.part2.length && !bank.part3.length) return '题库为空，至少添加一道题';
  return null;
}
$('btn-save').onclick = async () => {
  // 规范化：去掉空行选项
  bank.part1.forEach(q => { q.opts = q.opts.map(o => (o || '').trim()).filter(Boolean); });
  const err = validate();
  if (err) return toast(err);
  $('btn-save').disabled = true;
  try {
    await api('PUT', '/api/admin/tasks/' + encodeURIComponent(taskId) + '/quiz', { bank });
    $('saved-mark').style.display = '';
    setTimeout(() => { $('saved-mark').style.display = 'none'; }, 2500);
    toast('题库已保存（保存在服务端，刷新不丢）');
    renderMedia();
  } catch (e) { toast(e.message); }
  $('btn-save').disabled = false;
};

/* ---------- 加载 ---------- */
async function loadAll() {
  try {
    const d = await api('GET', '/api/admin/tasks/' + encodeURIComponent(taskId) + '/quiz');
    bank = { part1: d.bank.part1 || [], part2: d.bank.part2 || [], part3: d.bank.part3 || [] };
    media = d.media || [];
    const ttlEl = $('ttl'), tsubEl = $('tsub');
    ttlEl.textContent = d.task.title || '题库编辑器';
    if (tsubEl) tsubEl.textContent = d.task.type + ' · 上传题库';
    renderAll();
  } catch (e) {
    if (/登录|401/.test(e.message)) { location.href = 'admin.html'; return; }
    $('ttl').textContent = '加载失败：' + e.message;
  }
}
if (!taskId) { $('ttl').textContent = '缺少 task 参数，请从管理后台进入'; }
else loadAll();
