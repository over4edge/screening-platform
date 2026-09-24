// 任务卡公共渲染（index 大厅与 all 子页共用）：卡片结构、类型标签、时长换算
function fmtMin(sec) {
  if (!sec) return '';
  const m = Math.round(sec / 60);
  return m >= 60 ? (m / 60) + ' 小时' : m + ' 分钟';
}
function typeLabel(t) {
  if (t === 'music') return 'Music';
  if (t === 'sfx' || t === 'SFX') return 'SFX';
  if (t === 'aesthetic' || t === '音乐') return 'Aesthetic';
  return t;
}
function makeCard(t, idx) {
  const card = document.createElement('div');
  card.className = 'card task-card';
  card.style.setProperty('--d', Math.min(idx * 45, 600) + 'ms');
  const metas = [
    '客观听辨 ' + t.meta.part1Count + ' 题（限时 ' + fmtMin(t.meta.part1Limit) + '）',
    (t.meta.part2Label || '主观描述题') + ' ' + t.meta.part2Count + ' 题'
  ];
  if (t.meta.hasPart3) metas.push('曲式分析 ' + (t.meta.part3Count || 2) + ' 首' + (t.type === 'music' ? '（含完整曲目）' : ''));
  card.innerHTML =
    '<h2>' + esc(t.title) + '</h2>' +
    '<div class="tag-wrap"><span class="tag">' + typeLabel(t.type) + '</span></div>' +
    '<div class="subtitle" style="margin:2px 0 6px">' + esc(t.subtitle || '') + '</div>' +
    '<div class="task-meta">' + metas.map(m => '<span class="chipmeta">' + esc(m) + '</span>').join('') + '</div>' +
    '<ul class="req">' + (t.requirements || []).map(r => '<li>' + esc(r) + '</li>').join('') + '</ul>' +
    '<button class="btn btn-solid">进入测评</button>';
  card.querySelector('button').onclick = () => { location.href = 'exam.html?task=' + encodeURIComponent(t.id); };
  return card;
}
