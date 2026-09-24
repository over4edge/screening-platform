// 大厅首屏最多两排（5 列 × 2），更多任务跳 all.html 分页浏览；卡片渲染见 hall-common.js
const HOME_PAGE = 10;

async function load() {
  const list = document.getElementById('task-list');
  let data;
  try { data = await api('GET', '/api/tasks'); }
  catch (e) { list.innerHTML = '<div class="card center muted">任务加载失败：' + esc(e.message) + '</div>'; return; }
  if (!data.tasks.length) { document.getElementById('empty').style.display = 'block'; return; }
  const all = data.tasks;
  all.slice(0, HOME_PAGE).forEach((t, i) => list.appendChild(makeCard(t, i)));
  if (all.length > HOME_PAGE) {
    const more = document.createElement('div');
    more.className = 'card task-card more-card';
    more.style.setProperty('--d', Math.min(HOME_PAGE * 45, 600) + 'ms');
    more.innerHTML = '<div class="more-inner"><span class="more-plus">+</span><span>查看全部 ' + all.length + ' 个任务</span><span class="muted" style="font-size:12px">分页浏览 · 每页 10 个</span></div>';
    more.onclick = () => { location.href = 'all.html'; };
    list.appendChild(more);
  }
}
load();
