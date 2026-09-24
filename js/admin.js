let tasks = [];
const $ = id => document.getElementById(id);
let me = { user: '', role: '', name: '' };
// esc 由 api.js 提供（全量转义 & < > " '）
function showPanel(on) {
  $('login-card').style.display = on ? 'none' : 'block';
  $('panel').style.display = on ? 'block' : 'none';
  $('edit-card').style.display = 'none';
}
async function login() {
  const user = $('in-user').value.trim();
  const pw = $('in-pw').value;
  try {
    const r = await api('POST', '/api/admin/login', { user, password: pw });
    localStorage.setItem('sp_admin_token', r.token);
    me = { user: r.user, role: r.role, name: r.name || r.user };
    localStorage.setItem('sp_admin_me', JSON.stringify(me));
    enter();
  } catch (e) { $('login-msg').textContent = e.message; $('login-msg').classList.add('show'); }
}
function enter() {
  try { const m = JSON.parse(localStorage.getItem('sp_admin_me') || 'null'); if (m && m.user) me = m; } catch (e) {}
  showPanel(true);
  const isSuper = me.role === 'super';
  const roleLabel = isSuper ? '总管理员' : '批改员';
  $('whoami').textContent = me.user + ' · ' + roleLabel;
  $('tab-tasks').style.display = isSuper ? '' : 'none';
  $('tab-accounts').style.display = isSuper ? '' : 'none';
  if (!isSuper) { switchTab('tab-subs'); } else { switchTab('tab-tasks'); }
  if (isSuper) loadTasks();
  loadSubs();
  if (isSuper) loadAccounts();
}
function logout() { localStorage.removeItem('sp_admin_token'); localStorage.removeItem('sp_admin_me'); me = { user: '', role: '', name: '' }; showPanel(false); }
function switchTab(name) {
  ['tab-tasks', 'tab-subs', 'tab-accounts'].forEach(t => $(t).classList.toggle('on', t === name));
  $('pane-tasks').style.display = name === 'tab-tasks' ? 'block' : 'none';
  $('pane-subs').style.display = name === 'tab-subs' ? 'block' : 'none';
  $('pane-accounts').style.display = name === 'tab-accounts' ? 'block' : 'none';
  if (name === 'tab-subs') loadSubs();
  if (name === 'tab-accounts') loadAccounts();
}

/* ---------- 任务管理 ---------- */
async function loadTasks() {
  try { tasks = (await api('GET', '/api/admin/tasks', null, true)).tasks; }
  catch (e) { if (/登录|401/.test(e.message)) { logout(); } return; }
  $('f-task').innerHTML = '<option value="">全部任务</option>' + tasks.map(t => '<option value="' + esc(t.id) + '">' + esc(t.title) + '</option>').join('');
  const tb = $('task-rows'); tb.innerHTML = '';
  tasks.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + esc(t.id) + '</td>' +
      '<td>' + esc(t.title) + '</td>' +
      '<td>' + esc(t.type) + '</td>' +
      '<td><span class="pill ' + (t.status === 'on' ? 'on' : 'off') + '">' + (t.status === 'on' ? '上架' : '下架') + '</span></td>' +
      '<td>' + t.config.part1Count + '</td>' +
      '<td>' + t.config.part2Count + (t.type === 'music' ? ' +曲式2' : '') + '</td>' +
      '<td>' + Math.round(t.config.passRate * 100) + '%</td>' +
      '<td>' + Math.round(t.config.part1Limit / 60) + ' 分钟</td>' +
      '<td></td>';
    const ops = tr.lastElementChild;
    const edit = document.createElement('button'); edit.className = 'btn small ghost'; edit.textContent = '编辑';
    edit.onclick = () => openEdit(t);
    const tog = document.createElement('button'); tog.className = 'btn small ghost'; tog.style.marginLeft = '6px';
    tog.textContent = t.status === 'on' ? '下架' : '上架';
    tog.onclick = async () => { await api('PUT', '/api/admin/tasks/' + encodeURIComponent(t.id), { status: t.status === 'on' ? 'off' : 'on' }, true); loadTasks(); };
    const del = document.createElement('button'); del.className = 'btn small ghost'; del.style.marginLeft = '6px'; del.style.color = 'var(--bad)'; del.style.borderColor = 'var(--bad)';
    del.textContent = '删除';
    del.onclick = async () => { if (confirm('确定删除任务「' + t.title + '」？已产生的答卷保留。')) { await api('DELETE', '/api/admin/tasks/' + encodeURIComponent(t.id), null, true); loadTasks(); } };
    if (t.bank === 'upload') {
      const quiz = document.createElement('button'); quiz.className = 'btn small pri'; quiz.style.marginLeft = '6px';
      quiz.textContent = '题库';
      quiz.title = '在线编辑题库（素材上传 + 出题 + 答案）';
      quiz.onclick = () => { location.href = 'admin-quiz.html?task=' + encodeURIComponent(t.id); };
      ops.appendChild(quiz);
    }
    ops.appendChild(edit); ops.appendChild(tog); ops.appendChild(del);
    tb.appendChild(tr);
  });
}
let bankMode = 'zip'; // zip | online
function setBankMode(m) {
  bankMode = m;
  $('mode-zip').className = 'btn small' + (m === 'zip' ? ' pri' : '');
  $('mode-online').className = 'btn small' + (m === 'online' ? ' pri' : '');
  $('zip-block').style.display = m === 'zip' ? '' : 'none';
  $('online-block').style.display = m === 'online' ? '' : 'none';
}
function openEdit(t) {
  const isNew = !t;
  t = t || { id: '', type: '', title: '', subtitle: '', requirements: [], status: 'on', config: { part1Count: 0, part2Count: 0, passRate: 0.7, part1Limit: 360, p2Min: 15 } };
  $('edit-card').style.display = 'block';
  $('edit-title').textContent = isNew ? '新建任务' : '编辑任务 · ' + t.title;
  $('t-id').value = t.id;
  $('t-id2').value = t.id; $('t-id2').disabled = !isNew;
  $('t-type').value = t.type || '';
  $('t-title').value = t.title || '';
  $('t-subtitle').value = t.subtitle || '';
  $('t-p2label').value = (t.config && t.config.part2Label) || '';
  $('t-req').value = (t.requirements || []).join('\n');
  $('t-status').value = t.status || 'on';
  $('c-p1').value = (t.config && t.config.part1Count) != null ? t.config.part1Count : '';
  $('c-p2').value = (t.config && t.config.part2Count) != null ? t.config.part2Count : '';
  $('c-pass').value = Math.round((t.config && t.config.passRate != null ? t.config.passRate : 0.7) * 100);
  $('c-limit').value = Math.round((t.config && t.config.part1Limit || 360) / 60);
  $('c-p2min').value = (t.config && t.config.p2Min) || 15;
  $('t-zip').value = '';
  const zl = $('zip-label');
  if (zl) zl.textContent = isNew ? '题库 ZIP（新建必传）' : '题库 ZIP（编辑不改题库，仅改下方信息）';
  const zf = $('t-zip');
  if (zf) zf.disabled = !isNew;
  // 模式切换：仅新建任务显示
  $('bank-mode-wrap').style.display = isNew ? '' : 'none';
  if (isNew) setBankMode('zip');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function saveTask() {
  const isNew = !$('t-id').value;
  const id = $('t-id2').value.trim();
  if (!id) return editErr('请填写任务 ID（英文，如 music2）。');
  const type = $('t-type').value.trim() || '自定义';
  const zipFile = $('t-zip') && $('t-zip').files && $('t-zip').files[0];
  const old = tasks.find(x => x.id === $('t-id').value);

  if (isNew && bankMode === 'zip') {
    if (!zipFile) return editErr('新建任务需上传题库 ZIP（或切换到「在线题库编辑」）。');
    if (zipFile.name && !/\.zip$/i.test(zipFile.name)) return editErr('请选择 .zip 文件。');
  }

  const common = {
    type,
    title: $('t-title').value.trim(),
    subtitle: $('t-subtitle').value.trim(),
    part2Label: $('t-p2label').value.trim(),
    requirements: $('t-req').value.split('\n').map(s => s.trim()).filter(Boolean),
    status: $('t-status').value,
    passRate: Number($('c-pass').value) || 70,
    part1Limit: Number($('c-limit').value) || 10,
    p2Min: Number($('c-p2min').value) || 15,
    part1Count: Number($('c-p1').value) || 0,
    part2Count: Number($('c-p2').value) || 0
  };
  try {
    if (isNew && bankMode === 'online') {
      const body = {
        id,
        type: common.type,
        title: common.title,
        subtitle: common.subtitle,
        requirements: common.requirements,
        status: common.status,
        bank: 'upload',
        config: {
          part1Count: 0, part2Count: 0, part3Count: 0,
          passRate: (Number($('c-pass').value) || 70) / 100,
          part1Limit: (Number($('c-limit').value) || 10) * 60,
          p2Min: Number($('c-p2min').value) || 15,
          p3MinSegs: 0,
          part2Label: common.part2Label
        }
      };
      await api('POST', '/api/admin/tasks', body, true);
      $('edit-card').style.display = 'none';
      loadTasks();
      toast('任务已创建，正在打开题库编辑器…');
      location.href = 'admin-quiz.html?task=' + encodeURIComponent(id);
      return;
    } else if (isNew) {
      const fd = new FormData();
      fd.append('zip', zipFile);
      fd.append('id', id);
      for (const k of Object.keys(common)) fd.append(k, String(common[k]));
      await upload('/api/admin/tasks/upload', fd, true);
    } else {
      const body = {
        id,
        type: common.type,
        title: common.title,
        subtitle: common.subtitle,
        requirements: common.requirements,
        status: common.status,
        config: {
          part1Count: common.part1Count,
          part2Count: common.part2Count,
          part3Count: (old && old.config && old.config.part3Count) || (type === 'music' ? 2 : 0),
          passRate: (Number($('c-pass').value) || 70) / 100,
          part1Limit: (Number($('c-limit').value) || 10) * 60,
          p2Min: Number($('c-p2min').value) || 15,
          p3MinSegs: 0,
          part2Label: common.part2Label
        }
      };
      await api('PUT', '/api/admin/tasks/' + encodeURIComponent($('t-id').value), body, true);
    }
    $('edit-card').style.display = 'none';
    loadTasks();
  } catch (e) { editErr(e.message); }
}
// FormData 上传（multipart，带管理 token）
async function upload(path, fd, withAdmin) {
  const headers = {};
  if (withAdmin) {
    const t = localStorage.getItem('sp_admin_token');
    if (t) headers['Authorization'] = 'Bearer ' + t;
  }
  const r = await fetch(API_BASE + path, { method: 'POST', headers, body: fd });
  let j = {};
  try { j = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(j.error || ('请求失败（' + r.status + '）'));
  return j;
}
function editErr(m) { const e = $('edit-msg'); e.textContent = m; e.classList.add('show'); }
let _toastEl = null;
function toast(m) {
  if (!_toastEl) {
    _toastEl = document.createElement('div');
    _toastEl.style.cssText = 'position:fixed;bottom:26px;left:50%;transform:translateX(-50%);background:#1c1f24;color:#fff;padding:9px 18px;border-radius:8px;font-size:13px;z-index:99;box-shadow:0 4px 18px rgba(0,0,0,.25)';
    document.body.appendChild(_toastEl);
  }
  _toastEl.textContent = m;
  _toastEl.style.display = 'block';
  clearTimeout(_toastEl._t);
  _toastEl._t = setTimeout(() => { _toastEl.style.display = 'none'; }, 2400);
}

/* ---------- 提交记录 ---------- */
async function loadSubs() {
  const taskId = $('f-task').value, q = $('f-q').value.trim();
  let rows = [];
  try {
    const path = '/api/admin/submissions?' + new URLSearchParams({ taskId, q });
    rows = (await api('GET', path, null, true)).submissions;
  } catch (e) { if (/登录|401/.test(e.message)) logout(); return; }
  const tb = $('sub-rows'); tb.innerHTML = '';
  if (!rows.length) { tb.innerHTML = '<tr><td colspan="9" class="muted center" style="text-align:center">暂无提交记录</td></tr>'; return; }
  rows.forEach(s => {
    const tr = document.createElement('tr');
    const name = s.name + (s.round > 1 ? ' <span class="pill hard">R' + s.round + '</span>' : '');
    const pct = s.p1total ? Math.round(s.p1rate * 100) : 0;
    const status = s.hardFail
      ? '<span class="pill fail">硬门槛未过</span>'
      : (s.reviewed ? '<span class="pill on">已人工评</span>' : '<span class="pill warn">已完成·待人工评</span>');
    tr.innerHTML =
      '<td><b>' + esc(s.code) + '</b></td>' +
      '<td>' + esc(s.taskId) + '</td>' +
      '<td>' + name + '</td>' +
      '<td>' + esc(s.contact || '') + '</td>' +
      '<td>' + esc(s.email || '') + '</td>' +
      '<td>' + s.p1score + '/' + s.p1total + '（' + pct + '%）</td>' +
      '<td>' + status + '</td>' +
      '<td class="muted">' + esc(s.ts || '') + '</td>' +
      '<td></td>';
    const view = document.createElement('button'); view.className = 'btn small'; view.textContent = '查看答卷';
    // 不带 sig 走管理员通道（返回含正确答案，供人工批改）；候选人公开链接带 sig 走脱敏版
    view.onclick = () => window.open('review.html?c=' + encodeURIComponent(s.code), '_blank');
    tr.lastElementChild.appendChild(view);
    tb.appendChild(tr);
  });
}

/* ---------- 账号管理（仅总管理员） ---------- */
async function loadAccounts() {
  let rows = [];
  try { rows = (await api('GET', '/api/admin/accounts', null, true)).accounts; }
  catch (e) { return; }
  const tb = $('acc-rows'); tb.innerHTML = '';
  rows.forEach(a => {
    const tr = document.createElement('tr');
    const roleTxt = a.role === 'super' ? '总管理员' : '批改员';
    tr.innerHTML =
      '<td><b>' + esc(a.user) + '</b>' + (a.user === me.user ? ' <span class="pill on">我</span>' : '') + '</td>' +
      '<td>' + esc(a.name || '') + '</td>' +
      '<td>' + roleTxt + '</td>' +
      '<td>' + (a.pending ? '<span class="pill warn">待启用</span>' : (a.disabled ? '<span class="pill fail">已停用</span>' : '<span class="pill on">正常</span>')) + '</td>' +
      '<td class="muted">' + esc(a.createdAt ? new Date(a.createdAt).toLocaleString('zh-CN', { hour12: false }) : '') + '</td>' +
      '<td></td>';
    const ops = tr.lastElementChild;
    if (a.user !== me.user) {
      const pw = document.createElement('button'); pw.className = 'btn small ghost'; pw.textContent = '重置口令';
      pw.onclick = async () => {
        const np = prompt('为账号「' + a.user + '」设置新口令（至少 6 位）：');
        if (!np) return;
        try { await api('PUT', '/api/admin/accounts/' + encodeURIComponent(a.user), { password: np }, true); alert('口令已重置'); }
        catch (e) { alert(e.message); }
      };
      ops.appendChild(pw);
      const role = document.createElement('button'); role.className = 'btn small ghost'; role.style.marginLeft = '6px';
      role.textContent = a.role === 'super' ? '降为批改员' : '设为总管理员';
      role.onclick = async () => {
        try { await api('PUT', '/api/admin/accounts/' + encodeURIComponent(a.user), { role: a.role === 'super' ? 'grader' : 'super' }, true); loadAccounts(); }
        catch (e) { alert(e.message); }
      };
      ops.appendChild(role);
      const tog = document.createElement('button'); tog.className = 'btn small ghost'; tog.style.marginLeft = '6px';
      tog.textContent = a.disabled ? '启用' : '停用';
      tog.onclick = async () => {
        try { await api('PUT', '/api/admin/accounts/' + encodeURIComponent(a.user), { disabled: !a.disabled }, true); loadAccounts(); }
        catch (e) { alert(e.message); }
      };
      ops.appendChild(tog);
      const del = document.createElement('button'); del.className = 'btn small ghost'; del.style.marginLeft = '6px'; del.style.color = 'var(--bad)'; del.style.borderColor = 'var(--bad)';
      del.textContent = '删除';
      del.onclick = async () => {
        if (!confirm('确定删除账号「' + a.user + '」？')) return;
        try { await api('DELETE', '/api/admin/accounts/' + encodeURIComponent(a.user), null, true); loadAccounts(); }
        catch (e) { alert(e.message); }
      };
      ops.appendChild(del);
    } else {
      ops.appendChild(el('span', 'muted', '—'));
    }
    tb.appendChild(tr);
  });
}
async function createAccount() {
  const user = $('a-user').value.trim();
  const name = $('a-name').value.trim();
  const role = $('a-role').value;
  const password = $('a-pw').value;
  const msg = $('acc-msg'); msg.textContent = ''; msg.classList.remove('show');
  try {
    await api('POST', '/api/admin/accounts', { user, name, role, password }, true);
    $('a-user').value = ''; $('a-name').value = ''; $('a-pw').value = '';
    loadAccounts();
  } catch (e) { msg.textContent = e.message; msg.classList.add('show'); }
}

$('btn-login').onclick = login;
$('in-pw').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
$('in-user').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

/* ---------- 批改员自助注册 ---------- */
function showReg(on) {
  $('login-form').style.display = on ? 'none' : 'block';
  $('register-form').style.display = on ? 'block' : 'none';
  $('login-msg').textContent = ''; $('login-msg').className = 'msg';
  $('reg-msg').textContent = ''; $('reg-msg').className = 'msg';
}
async function register() {
  const name = $('r-name').value.trim();
  const user = $('r-user').value.trim();
  const pw = $('r-pw').value;
  const pw2 = $('r-pw2').value;
  const msg = $('reg-msg'); msg.textContent = ''; msg.className = 'msg';
  if (pw !== pw2) { msg.textContent = '两次口令不一致'; msg.classList.add('show', 'err'); return; }
  try {
    const r = await api('POST', '/api/admin/register', { name, user, password: pw });
    msg.textContent = r.message || '注册成功，待总管理员启用后即可登录';
    msg.classList.add('show', 'ok');
    $('r-name').value = ''; $('r-user').value = ''; $('r-pw').value = ''; $('r-pw2').value = '';
    setTimeout(() => showReg(false), 1600);
  } catch (e) { msg.textContent = e.message; msg.classList.add('show', 'err'); }
}
$('go-register').onclick = (e) => { e.preventDefault(); showReg(true); };
$('go-login').onclick = (e) => { e.preventDefault(); showReg(false); };
$('btn-register').onclick = register;
$('r-pw2').addEventListener('keydown', e => { if (e.key === 'Enter') register(); });
$('btn-logout').onclick = logout;
$('tab-tasks').onclick = () => switchTab('tab-tasks');
$('tab-subs').onclick = () => switchTab('tab-subs');
$('tab-accounts').onclick = () => switchTab('tab-accounts');
$('mode-zip').onclick = () => setBankMode('zip');
$('mode-online').onclick = () => setBankMode('online');
$('btn-new').onclick = () => openEdit(null);
$('btn-save').onclick = saveTask;
$('btn-cancel').onclick = () => { $('edit-card').style.display = 'none'; };
$('btn-search').onclick = loadSubs;
$('f-q').addEventListener('keydown', e => { if (e.key === 'Enter') loadSubs(); });
$('f-task').onchange = loadSubs;
$('btn-acc-create').onclick = createAccount;

if (localStorage.getItem('sp_admin_token')) enter(); else showPanel(false);
