// 全站主题：默认跟随系统（prefers-color-scheme），手动切换后记住选择（localStorage）。
// 用法：页面在 <head> 尽早引入本脚本；切换按钮调用 SPTheme.toggle()。
(function () {
  var KEY = 'sp-theme';
  function apply(t) { document.documentElement.setAttribute('data-theme', t); }
  function current() {
    var saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  window.SPTheme = {
    current: current,
    toggle: function () {
      var t = current() === 'dark' ? 'light' : 'dark';
      localStorage.setItem(KEY, t);
      apply(t);
      return t;
    }
  };
  apply(current());
  // 未手动选择时，跟随系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    if (!localStorage.getItem(KEY)) apply(e.matches ? 'dark' : 'light');
  });
})();
