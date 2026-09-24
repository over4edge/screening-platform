// 统一考试 runner：音乐 / 音效共用；抽题与判分全部走后端，前端不持有答案。
const taskId = new URLSearchParams(location.search).get('task') || '';
let task = null, paper = null, formUrl = '';
const sel = { p1: {}, ab: [], p2Text: {}, p3Segs: [], specs: [] };
let r1 = null, timer = null, p1Left = 0, leaveCount = 0, person = { name: '', contact: '', email: '' };

const MUSIC_P2_NOTE = '试听片段后请描述：主要乐器、乐器技法、情绪；若出现乐器变化、技法变化请一并说明；能听出和声走向、核心动机可作为加分项。';
const SFX_P2_PLACEHOLDER = '请按三类描述这段视频里的声音：\n① 人声：有无 / 人数 / 性别年龄 / 情绪 / 说话·喊叫·哭笑·歌唱；\n② 音效：动作声与物体声（脚步、开关门、碰撞、操作等），逐一列出；\n③ 环境音：室内/室外、自然/城市、背景底噪、远近与混响；\n可按声音出现的先后顺序写。';

function show(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0 });
}
function flash(id, text) { const m = document.getElementById(id); if (text) { m.textContent = text; m.classList.add('show'); } else m.classList.remove('show'); }
function fmtMin(sec) { const m = Math.round(sec / 60); return m >= 60 ? (m / 60) + ' 小时' : m + ' 分钟'; }

async function initLanding() {
  try {
    const data = await api('GET', '/api/tasks');
    task = data.tasks.find(t => t.id === taskId);
  } catch (e) { /* ignore */ }
  if (!task) {
    document.getElementById('view-landing').innerHTML = '<div class="card center muted">任务不存在或已下架，请返回<a href="index.html">任务大厅</a>。</div>';
    return;
  }
  document.body.setAttribute('data-type', task.type);
  document.getElementById('logo').textContent = task.type === 'music' ? '乐' : (task.type === 'sfx' ? '效' : '审');
  document.getElementById('landing-title').textContent = task.title;
  document.getElementById('landing-subtitle').textContent = task.subtitle || '';
  const metas = [];
  if ((task.type === 'aesthetic' || task.id === 'aesthetic')) {
    metas.push('A/B 盲测 ' + task.meta.part1Count + ' 题 · 限时 ' + fmtMin(task.meta.part1Limit));
    metas.push('含埋题一致性校验');
  } else {
    metas.push('客观听辨 ' + task.meta.part1Count + ' 题 · 限时 ' + fmtMin(task.meta.part1Limit));
    metas.push((task.meta.part2Label || '主观描述题') + ' ' + task.meta.part2Count + ' 题');
    if (task.meta.hasPart3) metas.push('曲式分析 ' + (task.meta.part3Count || 2) + ' 首');
  }
  document.getElementById('landing-meta').innerHTML = metas.map(m => '<span class="chipmeta">' + esc(m) + '</span>').join('');
  document.getElementById('landing-req').innerHTML = task.requirements.map(r => '<li>' + esc(r) + '</li>').join('');
}

async function startTest() {
  const name = document.getElementById('in-name').value.trim();
  const contact = document.getElementById('in-contact').value.trim();
  const email = document.getElementById('in-email').value.trim();
  if (!name) return flash('landing-msg', '请填写姓名/编号。');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return flash('landing-msg', '请填写正确的邮箱。');
  try {
    const r = await api('POST', '/api/exam/start', { taskId, name, contact, email });
    paper = r; formUrl = r.formUrl || '';
    person = { name, contact, email };
    sel.p1 = {}; sel.p2Text = {}; sel.p3Segs = paper.part3.map(() => []); sel.specs = [];
    renderPart1(); show('view-part1'); startTimer();
  } catch (e) { flash('landing-msg', e.message); }
}

/* ---------- Part 1 ---------- */
function renderPart1() {
  if ((task.type === 'aesthetic' || task.id === 'aesthetic')) return renderABPart();
  const list = document.getElementById('p1-list');
  list.innerHTML = '';
  document.getElementById('p1-total').textContent = paper.part1.length;
  paper.part1.forEach((q, qi) => {
    const card = el('div', 'q-card');
    const head = el('div', 'q-head');
    head.appendChild(el('div', 'q-index', String(qi + 1)));
    head.appendChild(el('div', 'q-title', q.q));
    card.appendChild(head);
    card.appendChild(createPlayer(q.url, '第 ' + (qi + 1) + ' 段音频').el);
    q.opts.forEach((opt, oi) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'opt';
      b.innerHTML = '<span class="optkey">' + OPTKEYS[oi] + '</span>' + esc(opt);
      b.onclick = () => {
        card.querySelectorAll('.opt').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel'); sel.p1[qi] = oi;
      };
      card.appendChild(b);
    });
    list.appendChild(card);
  });
}

/* A/B 盲测题渲染 */
function renderABPart() {
  document.getElementById('p1-total').textContent = paper.part1.length;
  const list = document.getElementById('p1-list');
  list.innerHTML = '';
  sel.ab = paper.part1.map(() => ({ listen: null, understand: null, match: null, satA: null, satB: null, noteA: '', noteB: '' }));
  paper.part1.forEach((q, qi) => {
    const card = el('div', 'q-card ab-card');
    const head = el('div', 'q-head');
    head.appendChild(el('div', 'q-index', String(qi + 1)));
    head.appendChild(el('div', 'q-title', 'A/B 对比 · 第 ' + (qi + 1) + ' 题'));
    card.appendChild(head);

    // Domain + Prompt
    const meta = el('div', 'ab-prompt');
    meta.appendChild(el('span', 'ab-domain', q.domain));
    meta.appendChild(el('div', 'ab-prompt-text', 'Prompt：' + q.prompt));
    card.appendChild(meta);

    // A/B 双播放器
    const players = el('div', 'ab-players');
    const colA = el('div', 'ab-col');
    colA.appendChild(el('div', 'ab-col-label', '模型结果 A'));
    colA.appendChild(createPlayer(q.aUrl, 'A').el);
    const colB = el('div', 'ab-col');
    colB.appendChild(el('div', 'ab-col-label', '模型结果 B'));
    colB.appendChild(createPlayer(q.bUrl, 'B').el);
    players.appendChild(colA); players.appendChild(colB);
    card.appendChild(players);

    // 三题选择
    const ask = (label, optsArr, key) => {
      const row = el('div', 'ab-ask');
      row.appendChild(el('div', 'ab-ask-label', label));
      const g = el('div', 'ab-opts');
      optsArr.forEach(o => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'opt ab-opt';
        b.textContent = o.t;
        b.onclick = () => {
          row.querySelectorAll('.opt').forEach(x => x.classList.remove('sel'));
          b.classList.add('sel');
          sel.ab[qi][key] = o.v;
        };
        g.appendChild(b);
      });
      row.appendChild(g);
      return row;
    };
    card.appendChild(ask('① 你觉得哪首整体更好听/效果更好？（不考虑 prompt，只凭听觉）', [
      { t: 'A 更好听', v: 'a' }, { t: '差不多', v: 'same' }, { t: 'B 更好听', v: 'b' }
    ], 'listen'));
    card.appendChild(ask('② 你对这个 prompt 及音乐指令的理解程度？', [
      { t: '我不太听这个曲风', v: 0 }, { t: '熟悉曲风，但其他信息不太理解', v: 1 }, { t: '熟悉且大部分能理解', v: 2 }
    ], 'understand'));
    card.appendChild(ask('③ 你认为哪首和 prompt 更匹配？', [
      { t: 'A 更匹配', v: 'a' }, { t: '差不多', v: 'same' }, { t: 'B 更匹配', v: 'b' }
    ], 'match'));

    // 满意度 + 备注
    const satBlock = el('div', 'ab-sat-block');
    ['A', 'B'].forEach((side, si) => {
      const key = side === 'A' ? 'satA' : 'satB';
      const noteKey = side === 'A' ? 'noteA' : 'noteB';
      const row = el('div', 'ab-sat-row');
      row.appendChild(el('div', 'ab-sat-label', side + ' 歌满意程度'));
      const g = el('div', 'ab-opts');
      [
        { t: '-1 30秒内想划走', v: -1 },
        { t: '0 随机播放能听完', v: 0 },
        { t: '1 愿意收藏/用作配乐', v: 1 }
      ].forEach(o => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'opt ab-opt';
        b.textContent = o.t;
        b.onclick = () => {
          row.querySelectorAll('.opt').forEach(x => x.classList.remove('sel'));
          b.classList.add('sel');
          sel.ab[qi][key] = o.v;
        };
        g.appendChild(b);
      });
      row.appendChild(g);
      const ta = document.createElement('textarea'); ta.className = 'input ab-note';
      ta.placeholder = side + ' 歌备注（具体描述听感/优缺点，不要套话，不少于 10 字）';
      ta.oninput = () => { sel.ab[qi][noteKey] = ta.value; };
      row.appendChild(ta);
      satBlock.appendChild(row);
    });
    card.appendChild(satBlock);

    list.appendChild(card);
  });
}
function startTimer() {
  stopTimer();
  p1Left = paper.config.part1Limit; leaveCount = 0; paintBar();
  document.addEventListener('visibilitychange', onLeave);
  timer = setInterval(() => {
    p1Left--; paintBar();
    if (p1Left <= 0) { stopTimer(); alert('第一部分作答时间已到，系统自动交卷（未作答按错误计）。'); submitPart1(true); }
  }, 1000);
}
function onLeave() { if (document.hidden && timer) { leaveCount++; paintBar(); } }
function paintBar() {
  const t = document.getElementById('p1-timer');
  t.textContent = fmt(p1Left);
  t.classList.toggle('urgent', p1Left <= 60);
  document.getElementById('p1-leave').textContent = leaveCount;
}
function stopTimer() { if (timer) { clearInterval(timer); timer = null; } document.removeEventListener('visibilitychange', onLeave); }

async function submitPart1(auto) {
  if ((task.type === 'aesthetic' || task.id === 'aesthetic')) {
    if (!auto) {
      for (let i = 0; i < sel.ab.length; i++) {
        const a = sel.ab[i];
        if (a.listen == null || a.understand == null || a.match == null || a.satA == null || a.satB == null) {
          return flash('part1-msg', '第 ' + (i + 1) + ' 题还有未完成的选择项。');
        }
        if ((a.noteA || '').trim().length < 5) return flash('part1-msg', '第 ' + (i + 1) + ' 题 A 歌备注过于简短。');
        if ((a.noteB || '').trim().length < 5) return flash('part1-msg', '第 ' + (i + 1) + ' 题 B 歌备注过于简短。');
      }
    }
    flash('part1-msg', '');
    stopTimer();
    let abG;
    try {
      abG = await api('POST', '/api/exam/grade1', { code: paper.code, picks: sel.ab });
    } catch (e) { flash('part1-msg', e.message); return; }
    // A/B 审美测评：不展示分数；未过线直接结束，过线则交卷等待人工批改
    if (!abG.pass) { alert('未达到通过线，本次筛选到此结束，感谢参与。'); return; }
    doSubmit();
    return;
  }
  if (!auto) {
    const unanswered = paper.part1.filter((_, i) => sel.p1[i] == null).length;
    if (unanswered > 0) return flash('part1-msg', '还有 ' + unanswered + ' 题未作答（不会显示正确答案，仅可看到对错）。');
  }
  flash('part1-msg', '');
  stopTimer();
  const picks = paper.part1.map((_, i) => (sel.p1[i] == null ? null : sel.p1[i]));
  try {
    r1 = await api('POST', '/api/exam/grade1', { code: paper.code, picks });
  } catch (e) { flash('part1-msg', e.message); return; }
  renderPart1Result();
}
function renderPart1Result() {
  const rate = r1.rate, pass = r1.pass, pct = Math.round(rate * 100);
  const ring = document.getElementById('p1-ring');
  ring.className = 'ring ' + (pass ? 'pass' : 'fail');
  ring.style.setProperty('--p', (rate * 100) + '%');
  document.getElementById('p1-num').textContent = r1.score + '/' + r1.total;
  const v = document.getElementById('p1-verdict'), sub = document.getElementById('p1-verdict-sub');
  v.className = 'verdict ' + (pass ? 'pass' : 'fail');
  v.textContent = pass ? '通过听辨硬门槛' : '未通过听辨硬门槛';
  sub.textContent = pass
    ? '得分率 ' + pct + '%。请继续完成后续主观部分。'
    : '得分率 ' + pct + '% 未达到通过线。本次筛选到此结束，感谢参与。';
  const body = document.getElementById('p1-result-body'); body.innerHTML = '';
  paper.part1.forEach((q, i) => {
    const ok = r1.marks[i];
    const item = el('div', 'result-item ' + (ok ? 'good' : 'bad'));
    item.appendChild(el('h3', null, (i + 1) + '. ' + (ok ? '回答正确' : '回答有误')));
    item.appendChild(el('div', 'rtxt', q.q));
    const pick = sel.p1[i];
    item.appendChild(el('div', 'rmeta', '你的答案：' + (pick == null ? '未作答' : q.opts[pick])));
    body.appendChild(item);
  });
  const next = document.getElementById('p1-next'); next.innerHTML = '';
  if (pass) {
    if ((task.type === 'aesthetic' || task.id === 'aesthetic')) {
      const b = document.createElement('button'); b.className = 'btn block';
      b.textContent = '提交并完成测评';
      b.onclick = () => doSubmit();
      next.appendChild(b);
    } else {
      const b = document.createElement('button'); b.className = 'btn block';
      b.textContent = '进入第二部分 · ' + (paper.config.part2Label || '主观描述题');
      b.onclick = () => renderPart2();
      next.appendChild(b);
    }
  } else {
    next.appendChild(el('p', 'muted', '你的测试码为 ' + paper.code + '，可凭此码向招聘方查询结果。'));
    const home = document.createElement('a'); home.className = 'btn ghost block'; home.href = 'index.html'; home.textContent = '返回任务大厅';
    next.appendChild(home);
  }
  show('view-part1result');
}

/* ---------- Part 2 ---------- */
function renderPart2() {
  const isMusic = task.type === 'music';
  const label = paper.config.part2Label || '主观描述题';
  const hasP3 = !!(paper.part3 && paper.part3.length);
  const isVideo = /.(mp4|webm|mov)$/i.test((paper.part2[0] && paper.part2[0].url) || '');
  document.getElementById('p2-title').textContent = '第二部分 · ' + label;
  document.getElementById('p2-intro').textContent = isMusic
    ? MUSIC_P2_NOTE + ' 每题不少于 ' + paper.part2[0].min + ' 字。'
    : (isVideo
      ? '完整观看视频，按「人声 / 音效 / 环境音」三类拆解描述，每题不少于 ' + paper.part2[0].min + ' 字。'
      : '试听音频后描述所听内容，每题不少于 ' + paper.part2[0].min + ' 字。');
  const list = document.getElementById('p2-list'); list.innerHTML = '';
  paper.part2.forEach((item, i) => {
    const card = el('div', 'q-card');
    const head = el('div', 'q-head');
    head.appendChild(el('div', 'q-index', String(i + 1)));
    head.appendChild(el('div', 'q-title', isMusic ? ('曲目 ' + (i + 1)) : (item.title + (isVideo ? ' · 观看后描述声音' : ' · 试听并描述'))));
    card.appendChild(head);
    if (!isVideo) {
      card.appendChild(el('p', 'p2note', '试听片段后描述整体听感（风格 / 配器 / 音色 / 节奏 / 氛围，以及上面要求的各项）。'));
      card.appendChild(createPlayer(item.url, '音频 ' + (i + 1) + ' · 片段').el);
    } else {
      card.appendChild(el('p', 'p2note', '可反复观看、进度条可拖动。'));
      card.appendChild(createVideoPlayer(item.url, item.title).el);
    }
    const ta = document.createElement('textarea'); ta.className = 'input';
    ta.placeholder = isMusic ? ('例：主要乐器为钢琴与弦乐，采用分解和弦技法，情绪由舒缓转向明亮；中段加入鼓组，技法转为柱式和弦……（不少于 ' + item.min + ' 字）') : SFX_P2_PLACEHOLDER;
    ta.oninput = () => { sel.p2Text[i] = ta.value; };
    card.appendChild(ta);
    list.appendChild(card);
  });
  document.getElementById('btn-p2-submit').textContent = hasP3 ? '提交并进入第三部分' : '提交并完成测评';
  show('view-part2');
}
async function submitPart2() {
  let bad = -1;
  paper.part2.forEach((item, i) => { if ((sel.p2Text[i] || '').trim().length < item.min && bad < 0) bad = i; });
  if (bad >= 0) return flash('part2-msg', '第 ' + (bad + 1) + ' 题作答不足 ' + paper.part2[bad].min + ' 字。');
  flash('part2-msg', '');
  if (paper.part3 && paper.part3.length) renderPart3();
  else await doSubmit();
}

/* ---------- Part 3（音乐） ---------- */
function renderPart3() {
  const list = document.getElementById('p3-list'); list.innerHTML = '';
  sel.specs = [];
  paper.part3.forEach((sg, i) => {
    const card = el('div', 'q-card spec-card');
    const head = el('div', 'q-head');
    head.appendChild(el('div', 'q-index', String(i + 1)));
    head.appendChild(el('div', 'q-title', '曲目 ' + (i + 1) + ' · 结构标注' + (sg.full ? '（完整时长）' : '（片段）')));
    card.appendChild(head);
    card.appendChild(el('div', 'spec-sub', '《' + sg.title + '》' + (sg.artist || '') + (sg.full ? ' · 完整时长 · 请辨认整首曲式结构' : ' · 片段 · 覆盖多个段落')));
    const player = createPlayer(sg.url, '曲目 ' + (i + 1) + (sg.full ? ' · 完整歌曲' : ' · 结构片段'));
    card.appendChild(player.el);
    const host = el('div', 'spec-host');
    card.appendChild(host);
    list.appendChild(card);
    const spec = mountSpectrum(host, player.audio, sg.url, { dur: sg.dur, segs: sel.p3Segs[i], readonly: false });
    sel.specs[i] = spec;
  });
  show('view-part3');
}
async function submitPart3() {
  const p3 = paper.part3.map((_, i) => ({ segs: sel.specs[i].getSegs() }));
  for (let i = 0; i < p3.length; i++) {
    if (p3[i].segs.some(s => !s.label || !(s.end > s.start))) return flash('part3-msg', '第 ' + (i + 1) + ' 首存在无效区间，请检查。');
  }
  sel.p3Final = p3;
  flash('part3-msg', '');
  await doSubmit();
}

/* ---------- 交卷与结果 ---------- */
async function doSubmit() {
  const body = {
    code: paper.code,
    p2: (task.type === 'aesthetic' || task.id === 'aesthetic') ? [] : paper.part2.map((_, i) => ({ ans: (sel.p2Text[i] || '').trim() })),
    p3: (paper.part3 && paper.part3.length) ? (sel.p3Final || paper.part3.map((_, i) => ({ segs: sel.specs[i].getSegs() }))) : []
  };
  let r;
  try { r = await api('POST', '/api/exam/submit', body); }
  catch (e) { alert(e.message); return; }
  const isAB = (task.type === 'aesthetic' || task.id === 'aesthetic');
  document.getElementById('res-code').textContent = r.code;
  document.getElementById('res-score').textContent = isAB
    ? '答卷已提交，等待招聘方人工批改。'
    : '客观听辨得分 ' + r.score + '/' + r.total + '（' + Math.round(r.rate * 100) + '%），主观部分待招聘方人工评定。';
  document.getElementById('res-note').textContent = isAB
    ? '请凭测试码 ' + r.code + ' 查询结果。最后一步：点击下方按钮到飞书核对报名信息并上传简历（每人仅限一次）。'
    : '请凭测试码 ' + r.code + ' 查询结果。最后一步：点击下方按钮到飞书核对报名信息并上传简历（每人仅限一次）。';
  const actions = document.getElementById('res-actions'); actions.innerHTML = '';
  if (formUrl) {
    const parts = ['prefill_' + encK('姓名') + '=' + encodeURIComponent(person.name),
      'prefill_' + encK('联系方式') + '=' + encodeURIComponent(person.contact),
      'prefill_' + encK('邮箱') + '=' + encodeURIComponent(person.email),
      'prefill_' + encK('网页版答卷链接') + '=' + encodeURIComponent(r.reviewUrl)];
    const url = formUrl + '?' + parts.join('&');
    const b = document.createElement('button'); b.className = 'btn block';
    b.textContent = '前往飞书提交报名信息并上传简历';
    b.onclick = () => window.open(url, '_blank');
    actions.appendChild(b);
  }
  const copy = document.createElement('button'); copy.className = 'btn ghost block';
  copy.textContent = '复制测试码与答卷链接';
  copy.onclick = () => copyText('测试码：' + r.code + '\n网页版答卷：' + r.reviewUrl);
  actions.appendChild(copy);
  show('view-result');
}
function encK(k) { return encodeURIComponent(k); }
function copyText(txt) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok2, fb); else fb();
  function ok2() { alert('已复制'); }
  function fb() { const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); alert('已复制'); } catch (e) {} ta.remove(); }
}

document.getElementById('btn-start').onclick = startTest;
document.getElementById('btn-p1-submit').onclick = () => submitPart1(false);
document.getElementById('btn-p2-submit').onclick = submitPart2;
document.getElementById('btn-p3-submit').onclick = submitPart3;
document.getElementById('in-name').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('in-contact').focus(); });
initLanding();
