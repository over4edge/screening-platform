// 全部任务子页：每页 10 个（两排 × 5），翻页带过渡动画；卡片渲染见 hall-common.js
const PAGE = 10;
let tasks = [], page = 1;

// 窗口化页码：总数多时折叠成 1 … cur-1 cur cur+1 … last
function pageNums(pages, cur) {
  const out = [];
  const push = (v) => out.push(v);
  if (pages <= 7) { for (let i = 1; i <= pages; i++) push(i); return out; }
  push(1);
  const lo = Math.max(2, cur - 1), hi = Math.min(pages - 1, cur + 1);
  if (lo > 2) push('…');
  for (let i = lo; i <= hi; i++) push(i);
  if (hi < pages - 1) push('…');
  push(pages);
  return out;
}

function renderPager() {
  const pages = Math.max(1, Math.ceil(tasks.length / PAGE));
  const pager = document.getElementById('pager');
  if (pages <= 1) { pager.style.display = 'none'; return; }
  pager.style.display = 'flex';
  document.getElementById('pg-prev').disabled = page <= 1;
  document.getElementById('pg-next').disabled = page >= pages;
  const nums = document.getElementById('pg-nums');
  nums.innerHTML = '';
  pageNums(pages, page).forEach(v => {
    if (v === '…') {
      const s = document.createElement('span'); s.className = 'pg-ellipsis'; s.textContent = '…'; nums.appendChild(s);
    } else {
      const b = document.createElement('button');
      b.className = 'pg-num' + (v === page ? ' cur' : '');
      b.textContent = v;
      b.onclick = () => go(v);
      nums.appendChild(b);
    }
  });
}

function go(n) {
  const pages = Math.max(1, Math.ceil(tasks.length / PAGE));
  n = Math.max(1, Math.min(n, pages));
  if (n === page) return;
  page = n;
  const grid = document.getElementById('task-list');
  grid.classList.add('pg-out');          // 退场
  setTimeout(() => {
    grid.innerHTML = '';
    const slice = tasks.slice((page - 1) * PAGE, page * PAGE);
    slice.forEach((t, i) => grid.appendChild(makeCard(t, i)));
    grid.classList.remove('pg-out');      // 入场（卡片逐个动画）
    renderPager();
  }, 190);
}

async function load() {
  const list = document.getElementById('task-list');
  let data;
  try { data = await api('GET', '/api/tasks'); }
  catch (e) { list.innerHTML = '<div class="card center muted">任务加载失败：' + esc(e.message) + '</div>'; return; }
  if (!data.tasks.length) { document.getElementById('empty').style.display = 'block'; return; }
  tasks = data.tasks;
  const slice = tasks.slice(0, PAGE);
  slice.forEach((t, i) => list.appendChild(makeCard(t, i)));
  renderPager();
}
document.getElementById('pg-prev').onclick = () => go(page - 1);
document.getElementById('pg-next').onclick = () => go(page + 1);
load();
