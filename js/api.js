// 前后端同源：API 前缀留空。上线若前端在 COS、函数独立域名，在 js/config.js 配 apiBase。
const API_BASE = (window.SP_CONFIG && SP_CONFIG.apiBase) || localStorage.getItem('sp_api_base') || '';
async function api(method, path, body, withAdmin) {
  const headers = { 'Content-Type': 'application/json' };
  if (withAdmin) {
    const t = localStorage.getItem('sp_admin_token');
    if (t) headers['Authorization'] = 'Bearer ' + t;
  }
  const r = await fetch(API_BASE + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  let j = {};
  try { j = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(j.error || ('请求失败（' + r.status + '）'));
  return j;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmt(t) {
  if (!isFinite(t)) return '0:00';
  t = Math.max(0, Math.floor(t));
  const m = Math.floor(t / 60), s = t % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}
const OPTKEYS = ['A', 'B', 'C', 'D', 'E', 'F'];
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
