// 音频 / 视频播放器：同一时刻只允许一个媒体播放；进度条可点击、可拖动。
let activeMedia = null;

function createPlayer(url, label) {
  const wrap = el('div', 'player');
  const audio = document.createElement('audio');
  audio.src = url; audio.preload = 'metadata'; audio.referrerPolicy = 'no-referrer';
  audio.style.display = 'none'; // 播放源挂在 DOM 上（保证可 seek），UI 用自定义进度条
  const btn = el('button', 'play-btn'); btn.type = 'button'; btn.setAttribute('aria-label', '播放');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  const eq = el('div', 'eq'); for (let i = 0; i < 5; i++) eq.appendChild(el('span'));
  const meta = el('div', 'pmeta');
  const pl = el('div', 'plabel', label || '试听');
  const prog = el('div', 'prog'); const fill = el('div', 'prog-fill'); prog.appendChild(fill);
  const pt = el('div', 'ptime', '0:00 / 0:00');
  meta.appendChild(pl); meta.appendChild(prog); meta.appendChild(pt);
  wrap.appendChild(btn); wrap.appendChild(eq); wrap.appendChild(meta); wrap.appendChild(audio);

  function setP(on) {
    wrap.classList.toggle('playing', on);
    btn.innerHTML = on
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  }
  audio.addEventListener('timeupdate', () => {
    if (isFinite(audio.duration) && audio.duration > 0) fill.style.width = (audio.currentTime / audio.duration * 100) + '%';
    pt.textContent = fmt(audio.currentTime) + ' / ' + fmt(audio.duration);
  });
  audio.addEventListener('loadedmetadata', () => { pt.textContent = '0:00 / ' + fmt(audio.duration); });
  audio.addEventListener('play', () => { if (activeMedia && activeMedia !== audio) { try { activeMedia.pause(); } catch (e) {} } activeMedia = audio; setP(true); });
  audio.addEventListener('pause', () => setP(false));
  audio.addEventListener('ended', () => { setP(false); fill.style.width = '100%'; });

  function seekAt(clientX) {
    const r = prog.getBoundingClientRect();
    if (!r.width || !(isFinite(audio.duration) && audio.duration > 0)) return;
    const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    try { audio.currentTime = ratio * audio.duration; } catch (e) {}
    fill.style.width = ratio * 100 + '%';
    pt.textContent = fmt(ratio * audio.duration) + ' / ' + fmt(audio.duration);
  }
  let seeking = false;
  prog.style.cursor = 'pointer';
  prog.addEventListener('pointerdown', e => { seeking = true; try { prog.setPointerCapture(e.pointerId); } catch (x) {} seekAt(e.clientX); });
  prog.addEventListener('pointermove', e => { if (seeking) seekAt(e.clientX); });
  prog.addEventListener('pointerup', () => { seeking = false; });
  prog.addEventListener('pointercancel', () => { seeking = false; });
  btn.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  });
  return { el: wrap, audio };
}

function createVideoPlayer(url, label) {
  const wrap = el('div', 'vplayer');
  wrap.appendChild(el('div', 'plabel', label || '视频'));
  let video = null;
  if (url) {
    video = document.createElement('video');
    video.src = url; video.controls = true; video.preload = 'metadata';
    video.playsInline = true; video.referrerPolicy = 'no-referrer';
    video.className = 'vvideo';
    video.addEventListener('play', () => { if (activeMedia && activeMedia !== video) { try { activeMedia.pause(); } catch (e) {} } activeMedia = video; });
    wrap.appendChild(video);
  } else {
    wrap.appendChild(el('div', 'vph', '视频素材待接入'));
  }
  return { el: wrap, video };
}
