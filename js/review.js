const params = new URLSearchParams(location.search);
const code = params.get('c');
const sig = params.get('sig') || '';
const TITLE = { music: '音乐人力能力筛选', sfx: '音效标注人力能力筛选', aesthetic: 'AI 审美测评' };
const SUB = {
  music: 'LISTENING SCREENING · 听辨能力硬门槛 · 每人随机抽题',
  sfx: 'SFX SCREENING · 音效听辨硬门槛 · 每人随机抽题',
  aesthetic: 'A/B BLIND TEST · 审美偏好盲测 · 每人随机抽题'
};
let sub = null;
const grades = { p2: {}, p3: {}, conclusion: '', note: '' };

function isABSub() { return sub && (sub.taskId === 'aesthetic' || sub.type === 'aesthetic'); }
function subKey() { return sub.taskId || sub.type; }
function abLabel(kind, v) {
  const map = {
    listen: { a: 'A 更好听', same: '差不多', b: 'B 更好听' },
    understand: { 0: '不太听此曲风', 1: '熟悉曲风但不太理解', 2: '熟悉且大部分能理解' },
    match: { a: 'A 更匹配', same: '差不多', b: 'B 更匹配' },
    sat: { '-1': '-1 · 30秒内想划走', 0: '0 · 随机播放能听完', 1: '1 · 愿收藏/用作配乐' }
  };
  if (v == null || v === '') return '未作答';
  return (map[kind] && map[kind][v]) != null ? map[kind][v] : String(v);
}

async function load() {
  const root = document.getElementById('rv-root');
  if (!code) { root.innerHTML = '<div class="card muted center">缺少测试码（?c=测试码）。</div>'; return; }
  try {
    if (sig) sub = (await api('GET', '/api/review/' + code + '?sig=' + encodeURIComponent(sig))).submission;
    else sub = (await api('GET', '/api/admin/submission/' + code, null, true)).submission;
  } catch (e) { root.innerHTML = '<div class="card muted center">无法打开答卷：' + esc(e.message) + '<br>请从管理后台“查看答卷”进入。</div>'; return; }
  // 回填已保存的批改
  if (sub.grading) {
    grades.p2 = sub.grading.p2 || {};
    grades.p3 = sub.grading.p3 || {};
    grades.conclusion = sub.grading.conclusion || '';
    grades.note = sub.grading.note || '';
  }
  document.body.setAttribute('data-type', sub.type);
  render();
}

function roundName() { return sub.name + (sub.round > 1 ? '（第' + ['', '一', '二', '三'][sub.round] + '次复测）' : ''); }

function render() {
  const root = document.getElementById('rv-root');
  root.innerHTML = '';
  const pct = sub.p1total ? Math.round(sub.p1rate * 100) : 0;

  // 信息卡
  const info = el('div', 'card');
  info.innerHTML =
    '<h2 style="margin:0 0 8px;font-size:18px">' + esc(TITLE[subKey()] || '能力筛选') + ' · 答卷</h2>' +
    '<div class="kv">' +
    '<b>测试码</b><span>' + esc(sub.code) + '</span>' +
    '<b>姓名/编号</b><span>' + esc(roundName()) + '</span>' +
    '<b>提交时间</b><span>' + esc(sub.ts || '') + '</span>' +
    '<b>联系方式</b><span>' + esc(sub.contact || '—') + '</span>' +
    '<b>邮箱</b><span>' + esc(sub.email || '—') + '</span>' +
    '<b>客观听辨</b><span>' + sub.p1score + '/' + sub.p1total + '（' + pct + '%）· ' +
    (sub.hardFail ? '<span class="pill fail">硬门槛未过</span>' : '<span class="pill on">通过硬门槛</span>') + '</span>' +
    '</div>';
  root.appendChild(info);

  // Part1
  const p1 = el('div', 'card');
  p1.appendChild(el('h2', null, isABSub() ? '第一部分 · A/B 盲测' : '第一部分 · 客观听辨'));
  (sub.p1 || []).forEach((q, i) => {
    const card = el('div', 'q-card');
    if (q && (q.aUrl || q.domain)) { renderABQuestion(card, q, i); }
    else { renderP1Question(card, q, i); }
    p1.appendChild(card);
  });
  root.appendChild(p1);

  // Part2（A/B 盲测无独立主观题，明细已在 Part1）
  if (!isABSub()) {
    const p2 = el('div', 'card');
    p2.appendChild(el('h2', null, subKey() === 'music' ? '第二部分 · 整体听感判断' : '第二部分 · 视频声音描述'));
    (sub.p2 || []).forEach((item, i) => {
      const card = el('div', 'q-card');
      const head = el('div', 'q-head');
      head.appendChild(el('div', 'q-index', String(i + 1)));
      head.appendChild(el('div', 'q-title', (subKey() === 'music' ? '曲目 ' + (i + 1) : item.title) + (item.artist ? ' · ' + item.artist : '')));
      card.appendChild(head);
      if (subKey() === 'music') card.appendChild(createPlayer(item.url, '曲目 ' + (i + 1) + ' · 片段').el);
      else card.appendChild(createVideoPlayer(item.url, item.title).el);
      card.appendChild(el('div', 'ans-text', item.ans || '（未作答）'));
      card.appendChild(rateRow('p2', i, '本题评分（1–10）'));
      p2.appendChild(card);
    });
    root.appendChild(p2);
  }

  // Part3（音乐）
  if (subKey() === 'music' && sub.p3 && sub.p3.length) {
    const p3 = el('div', 'card');
    p3.appendChild(el('h2', null, '第三部分 · 曲式结构分析'));
    sub.p3.forEach((sg, i) => {
      const card = el('div', 'q-card spec-card');
      const head = el('div', 'q-head');
      head.appendChild(el('div', 'q-index', String(i + 1)));
      head.appendChild(el('div', 'q-title', '曲目 ' + (i + 1) + (sg.full ? ' · 完整时长' : ' · 片段') + ' ·《' + sg.title + '》'));
      card.appendChild(head);
      const player = createPlayer(sg.url, '曲目 ' + (i + 1));
      card.appendChild(player.el);
      const host = el('div', 'spec-host');
      card.appendChild(host);
      card.appendChild(el('div', 'muted', '标注结构：' + segSeq(sg.segs)));
      card.appendChild(rateRow('p3', i, '本首评分（1–10）'));
      p3.appendChild(card);
      mountSpectrum(host, player.audio, sg.url, { dur: null, segs: sg.segs || [], readonly: true });
    });
    root.appendChild(p3);
  }

  // 总评
  const fin = el('div', 'card');
  const finHead = el('h2', null, '人工总评');
  if (sub.grading && sub.grading.gradedBy) {
    finHead.appendChild(el('span', 'muted', '  ·  已批改：' + esc(sub.grading.gradedBy) + '（' + esc(sub.grading.gradedAt || '') + '）'));
  }
  fin.appendChild(finHead);
  const concl = el('div', 'field');
  concl.appendChild(el('label', null, '整体结论'));
  const sel = document.createElement('select'); sel.className = 'input';
  sel.innerHTML = '<option value="">— 请选择 —</option><option value="通过">通过</option><option value="待定">待定（可安排复测）</option><option value="不通过">不通过</option>';
  sel.value = grades.conclusion;
  sel.onchange = () => { grades.conclusion = sel.value; renderPrint(); };
  concl.appendChild(sel); fin.appendChild(concl);
  const note = el('div', 'field');
  note.appendChild(el('label', null, '评语（将打印在成绩单上）'));
  const ta = document.createElement('textarea'); ta.className = 'input'; ta.placeholder = '第二、三部分的综合评语…';
  ta.value = grades.note;
  ta.oninput = () => { grades.note = ta.value; renderPrint(); };
  note.appendChild(ta); fin.appendChild(note);
  const act = el('div', null);
  act.style.cssText = 'display:flex;gap:10px;margin-top:12px';
  const saveBtn = document.createElement('button'); saveBtn.className = 'btn'; saveBtn.id = 'btn-save-grade'; saveBtn.style.flex = '1'; saveBtn.textContent = '保存批改';
  saveBtn.onclick = saveGrade;
  const printBtn = document.createElement('button'); printBtn.className = 'btn ghost'; printBtn.id = 'btn-print'; printBtn.textContent = '打印成绩单';
  printBtn.onclick = () => window.print();
  act.appendChild(saveBtn); act.appendChild(printBtn); fin.appendChild(act);
  const gmsg = el('div', 'msg'); gmsg.id = 'grade-msg'; fin.appendChild(gmsg);
  root.appendChild(fin);

  renderPrint();
}

/* 客观题单题渲染：管理员可见正确答案(correct)，候选人公开链接只有 per(对错) */
function renderP1Question(card, q, i) {
  const head = el('div', 'q-head');
  head.appendChild(el('div', 'q-index', String(i + 1)));
  head.appendChild(el('div', 'q-title', q.q || ''));
  card.appendChild(head);
  card.appendChild(createPlayer(q.url, '第 ' + (i + 1) + ' 段音频').el);
  (q.opts || []).forEach((o, oi) => {
    let cls = 'opt';
    const hasKey = q.correct != null;
    const picked = oi === q.pick;
    if (hasKey && oi === q.correct) cls += ' rv-good';
    if (picked) {
      cls += ' rv-pick';
      if (hasKey && oi !== q.correct) cls += ' rv-bad';
    }
    const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.disabled = true;
    let tag = '';
    if (hasKey && oi === q.correct) tag = ' ✓正确答案';
    if (picked) tag += hasKey ? ' · 候选人选此' : (q.per >= 1 ? ' · 候选人选此 ✓' : ' · 候选人选此 ✗');
    b.innerHTML = '<span class="optkey">' + OPTKEYS[oi] + '</span>' + esc(o) + '<span style="margin-left:auto;font-size:12px">' + tag + '</span>';
    card.appendChild(b);
  });
}

/* A/B 盲测题单题渲染：展示 domain/prompt/双播放器/选择与备注，per 标对错 */
function renderABQuestion(card, q, i) {
  const head = el('div', 'q-head');
  head.appendChild(el('div', 'q-index', String(i + 1)));
  head.appendChild(el('div', 'q-title', 'A/B 对比 · 第 ' + (i + 1) + ' 题' + (q.per != null ? (q.per >= 1 ? ' · 匹配判断正确' : ' · 匹配判断有误') : '')));
  card.appendChild(head);
  const meta = el('div', 'ab-prompt');
  meta.appendChild(el('span', 'ab-domain', q.domain || ''));
  meta.appendChild(el('div', 'ab-prompt-text', 'Prompt：' + (q.prompt || '')));
  card.appendChild(meta);
  const players = el('div', 'ab-players');
  [['aUrl', 'A'], ['bUrl', 'B']].forEach((kv) => {
    const col = el('div', 'ab-col');
    col.appendChild(el('div', 'ab-col-label', '模型结果 ' + kv[1]));
    col.appendChild(createPlayer(q[kv[0]], kv[1]).el);
    players.appendChild(col);
  });
  card.appendChild(players);
  const kv = el('div', 'ab-kv');
  kv.appendChild(el('div', 'ab-kv-row', '① 整体听感：' + abLabel('listen', q.listen)));
  kv.appendChild(el('div', 'ab-kv-row', '② 理解程度：' + abLabel('understand', q.understand)));
  kv.appendChild(el('div', 'ab-kv-row', '③ 匹配判断：' + abLabel('match', q.match)));
  kv.appendChild(el('div', 'ab-kv-row', 'A 歌满意度：' + abLabel('sat', q.satA) + '　·　B 歌满意度：' + abLabel('sat', q.satB)));
  kv.appendChild(el('div', 'ab-kv-row', 'A 歌备注：' + esc(q.noteA || '（未填写）')));
  kv.appendChild(el('div', 'ab-kv-row', 'B 歌备注：' + esc(q.noteB || '（未填写）')));
  card.appendChild(kv);
}

async function saveGrade() {
  const msg = document.getElementById('grade-msg');
  msg.className = 'msg'; msg.textContent = ''; msg.classList.remove('show');
  try {
    await api('PUT', '/api/admin/submission/' + code + '/grade',
      { p2: grades.p2, p3: grades.p3, conclusion: grades.conclusion, note: grades.note }, true);
    msg.textContent = '已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false });
    msg.classList.add('show', 'ok');
  } catch (e) {
    msg.textContent = '保存失败：' + e.message + (/登录|401|403/.test(e.message) ? '（请从管理后台登录后批改）' : '');
    msg.classList.add('show', 'err');
  }
}

function rateRow(part, idx, label) {
  const row = el('div', 'rate-row');
  row.appendChild(el('span', null, label + '：'));
  const inp = document.createElement('input');
  inp.className = 'input score-in'; inp.type = 'number'; inp.min = 0; inp.max = 10; inp.step = 1;
  inp.value = grades[part][idx] != null ? grades[part][idx] : '';
  inp.oninput = () => { grades[part][idx] = inp.value; renderPrint(); };
  row.appendChild(inp);
  row.appendChild(el('span', 'muted', '/ 10'));
  return row;
}
function segSeq(segs) {
  if (!segs || !segs.length) return '未标注（允许留空）';
  return segs.slice().sort((a, b) => a.start - b.start).map(s => s.label + '(' + fmt(s.start) + '–' + fmt(s.end) + ')').join(' → ');
}

// 打印成绩单：从标题开始，不含页面其它冗余
function renderPrint() {
  const key = subKey();
  const pct = sub.p1total ? Math.round(sub.p1rate * 100) : 0;
  let h = '<div class="ps-title">' + esc(TITLE[key] || '能力筛选') + ' · 成绩单</div>';
  h += '<div class="ps-sub">' + (SUB[key] || '') + '</div>';
  h += '<div class="ps-kv">' +
    '<div>测试码：' + esc(sub.code) + '</div><div>姓名/编号：' + esc(roundName()) + '</div><div>日期：' + esc(sub.ts || '') + '</div>' +
    '<div>客观听辨：' + sub.p1score + '/' + sub.p1total + '（' + pct + '%）</div><div>硬门槛：' + (sub.hardFail ? '未通过' : '通过') + '</div><div></div></div>';

  if (isABSub()) {
    h += '<div class="ps-h">第一部分 · A/B 盲测（匹配判断得分 ' + sub.p1score + '/' + sub.p1total + '）</div>';
    (sub.p1 || []).forEach((q, i) => {
      const picks = '听感:' + abLabel('listen', q.listen) + '；理解:' + abLabel('understand', q.understand) + '；匹配:' + abLabel('match', q.match) +
        '；A满意度:' + abLabel('sat', q.satA) + '；B满意度:' + abLabel('sat', q.satB);
      h += '<div class="ps-item"><b>第' + (i + 1) + '题（' + (q.per >= 1 ? '匹配正确' : '匹配有误') + '）：</b>' + esc(picks) + '</div>';
    });
  } else {
    h += '<div class="ps-h">第二部分 · ' + (key === 'music' ? '整体听感判断' : '视频声音描述') + '</div>';
    (sub.p2 || []).forEach((it, i) => {
      h += '<div class="ps-item"><b>' + (key === 'music' ? '曲目' + (i + 1) : it.title) + '（评分 ' + (grades.p2[i] || '—') + '/10）：</b>' + esc(it.ans || '（未作答）') + '</div>';
    });
    if (key === 'music' && sub.p3 && sub.p3.length) {
      h += '<div class="ps-h">第三部分 · 曲式结构分析</div>';
      sub.p3.forEach((sg, i) => {
        h += '<div class="ps-item"><b>曲目' + (i + 1) + '《' + esc(sg.title) + '》（评分 ' + (grades.p3[i] || '—') + '/10）：</b>' + esc(segSeq(sg.segs)) + '</div>';
      });
    }
  }
  h += '<div class="ps-line"></div>';
  h += '<div class="ps-item"><b>整体结论：</b>' + esc(grades.conclusion || '（待评定）') + '</div>';
  h += '<div class="ps-item"><b>评语：</b>' + esc(grades.note || '') + '</div>';
  document.getElementById('print-sheet').innerHTML = h;
}

document.getElementById('btn-save-grade') && (document.getElementById('btn-save-grade').onclick = saveGrade);
load();
