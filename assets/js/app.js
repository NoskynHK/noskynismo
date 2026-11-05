/* Il Noskynismo — app.js */
(function () {
  'use strict';

  var D = window.NSK_I18N || {};
  var PAGES = ['home', 'manifesto', 'diritti', 'economia', 'cultura', 'inno', 'tessera', 'partecipa', 'verifica', 'pagina'];
  var TITLE_KEY = { home: 'title.home', manifesto: 'title.manifesto', diritti: 'title.rights', economia: 'title.economy', cultura: 'title.culture', inno: 'title.anthem', tessera: 'title.card', partecipa: 'title.join', verifica: 'title.verify' };
  var WORDMARK = { it: 'Il <em>Noskynismo</em>', en: 'The <em>Noskynismo</em>', de: 'Der <em>Noskynismo</em>', ru: '<em>Носкинизм</em>' };
  var CODE_HASH = 3714687719143868; // cyrb53 del codice segreto
  var conn = navigator.connection || {};
  var lowEnd = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4) || conn.saveData === true || /2g/.test(conn.effectiveType || '');
  var reduceMotion = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || lowEnd;
  if (reduceMotion) document.documentElement.classList.add('lite');

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function cyrb53(str, seed) {
    seed = seed || 0;
    var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  /* ---------------- i18n ---------------- */
  var lang = 'it';
  function t(key) { return (D[lang] && D[lang][key]) || (D.it && D.it[key]) || key; }

  function detectLang() {
    var s = store.get('nsk-lang');
    if (s && D[s]) return s;
    var n = ((navigator.languages && navigator.languages[0]) || navigator.language || 'it').slice(0, 2).toLowerCase();
    return D[n] ? n : 'it';
  }
  function applyLang(l) {
    lang = D[l] ? l : 'it';
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-ph]').forEach(function (el) { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
    $$('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    $$('[data-i18n-alt]').forEach(function (el) { el.setAttribute('alt', t(el.getAttribute('data-i18n-alt'))); });
    $('#wm-text').innerHTML = WORDMARK[lang];
    $$('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)); });
    var d = $('meta[name="description"]'); if (d) d.setAttribute('content', t('meta.desc'));
    var f = $('#f-lang'); if (f) f.value = lang;
    document.title = pageTitle(currentPage());
    store.set('nsk-lang', lang);
    updatePlayLabel();
    if (cardReady) drawCard();
    if (cvInit) convRender();
    if (window.NSK_LYRICS) renderLyrics();
    if (verifyInit && currentPage() === 'verifica') renderVerify();
  }


  /* ---------------- contenuti modificabili dal CMS ---------------- */
  var dynPages = null;
  function pageTitle(page) {
    if (page === 'pagina') { var p = findDyn(); return (p && p.titolo ? p.titolo + ' — ' : '') + 'Il Noskynismo'; }
    return t(TITLE_KEY[page]);
  }
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function loadContent() {
    var groups = window.NSK_GROUPS || [], keys = window.NSK_KEYS || {};
    var texts = Promise.all(groups.map(function (g) { return getJSON('content/testi-' + g + '.json'); })).then(function (arr) {
      var changed = false;
      arr.forEach(function (o) {
        if (!o) return;
        Object.keys(o).forEach(function (fk) {
          var k = keys[fk], v = o[fk];
          if (!k || !v) return;
          Object.keys(v).forEach(function (l) {
            if (typeof v[l] === 'string' && v[l].trim() && D[l] && D[l][k] !== v[l]) { D[l][k] = v[l]; changed = true; }
          });
        });
      });
      if (changed) applyLang(lang);
    });
    var pages = getJSON('content/pagine.json').then(function (p) {
      dynPages = Array.isArray(p) ? p.filter(function (x) { return x && x.slug; }) : [];
      addDynNav();
      if (currentPage() === 'pagina') { renderDyn(); document.title = pageTitle('pagina'); }
    });
    return Promise.all([texts, pages]);
  }
  function slugOf(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''); }
  function findDyn() {
    if (!dynPages) return null;
    var slug = slugOf(decodeURIComponent((location.hash || '').replace('#', '').split('/')[1] || ''));
    for (var i = 0; i < dynPages.length; i++) if (slugOf(dynPages[i].slug) === slug) return dynPages[i];
    return null;
  }
  function addDynNav() {
    $$('[data-dyn]').forEach(function (a) { a.remove(); });
    var nav = $('#main-nav'), foot = $('footer nav');
    (dynPages || []).forEach(function (p) {
      if (!p.menu) return;
      [nav, foot].forEach(function (box) {
        if (!box) return;
        var a = document.createElement('a');
        a.href = '#pagina/' + slugOf(p.slug); a.textContent = p.titolo || p.slug; a.setAttribute('data-dyn', '1');
        box.appendChild(a);
      });
    });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeUrl(u) {
    u = String(u || '').trim();
    if (/^(https?:|mailto:|#)/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return '#';
    return u.replace(/^\//, '');
  }
  function cleanHtml(h) {
    var doc = new DOMParser().parseFromString('<div>' + String(h || '') + '</div>', 'text/html'), root = doc.body.firstChild;
    $$('script,style,iframe,object,embed,link,meta,form', root).forEach(function (n) { n.remove(); });
    $$('*', root).forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        var nm = a.name.toLowerCase();
        if (nm.indexOf('on') === 0) n.removeAttribute(a.name);
        else if ((nm === 'href' || nm === 'src') && /^\s*(javascript|data|vbscript):/i.test(a.value)) n.removeAttribute(a.name);
      });
      if (n.tagName === 'A' && /^https?:/i.test(n.getAttribute('href') || '')) { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener'); }
      if (n.tagName === 'IMG') { n.setAttribute('loading', 'lazy'); n.setAttribute('src', safeUrl(n.getAttribute('src'))); }
    });
    return root.innerHTML;
  }
  function ytId(u) {
    var m = String(u || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }
  function dynBlock(b) {
    var h = '';
    switch (b.tipo) {
      case 'testo':
        h = (b.titolo ? '<h2>' + esc(b.titolo) + '</h2>' : '') + '<div class="dyn-rich">' + cleanHtml(b.testo) + '</div>'; break;
      case 'immagine':
        if (!b.immagine) return '';
        h = '<figure class="dyn-fig"><img src="' + esc(safeUrl(b.immagine)) + '" alt="' + esc(b.didascalia || '') + '" loading="lazy">' + (b.didascalia ? '<figcaption>' + esc(b.didascalia) + '</figcaption>' : '') + '</figure>'; break;
      case 'citazione':
        h = '<blockquote class="dyn-quote"><p>' + esc(b.testo) + '</p>' + (b.autore ? '<cite>' + esc(b.autore) + '</cite>' : '') + '</blockquote>'; break;
      case 'elenco':
        h = (b.titolo ? '<h2>' + esc(b.titolo) + '</h2>' : '') + '<ul class="dyn-list">' + (b.voci || []).map(function (v) { return '<li>' + esc(v) + '</li>'; }).join('') + '</ul>'; break;
      case 'pulsante':
        h = '<p class="dyn-btn"><a class="btn btn-primary" href="' + esc(safeUrl(b.link)) + '"' + (/^https?:/i.test(b.link || '') ? ' target="_blank" rel="noopener"' : '') + '>' + esc(b.etichetta || 'Apri') + '</a></p>'; break;
      case 'video':
        var id = ytId(b.link); if (!id) return '';
        h = '<div class="dyn-video"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '" title="Video" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>'; break;
      case 'file':
        if (!b.file) return '';
        h = '<p class="dyn-btn"><a class="btn" href="' + esc(safeUrl(b.file)) + '" target="_blank" rel="noopener">⬇ ' + esc(b.etichetta || 'Scarica') + '</a></p>'; break;
      default: return '';
    }
    return '<div class="dyn-block reveal">' + h + '</div>';
  }
  function renderDyn() {
    var root = $('#dyn-root'); if (!root) return;
    if (!dynPages) { root.innerHTML = '<section class="page-hero"><div class="wrap"><p>…</p></div></section>'; return; }
    var p = findDyn();
    if (!p) { root.innerHTML = '<section class="page-hero"><div class="wrap"><h1>404</h1><p>Pagina non trovata.</p><p class="dyn-btn"><a class="btn btn-primary" href="#home">Home</a></p></div></section>'; return; }
    root.innerHTML = '<section class="page-hero"><div class="wrap"><h1>' + esc(p.titolo) + '</h1>' + (p.sottotitolo ? '<p>' + esc(p.sottotitolo) + '</p>' : '') + '</div></section>' +
      '<section class="block"><div class="wrap dyn-wrap">' + (p.blocchi || []).map(dynBlock).join('') + '</div></section>';
    observeReveals();
  }

  /* ---------------- router ---------------- */
  function currentPage() {
    var h = (location.hash || '').replace('#', '').trim().split('/')[0];
    return PAGES.indexOf(h) !== -1 ? h : 'home';
  }
  var lastPage = null;
  function render() {
    var page = currentPage();
    $$('.page').forEach(function (el) { el.classList.toggle('active', el.getAttribute('data-page') === page); });
    $$('.links a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-page') === page); });
    document.title = pageTitle(page);
    if (page === 'pagina') renderDyn();
    $$('.links a[data-dyn]').forEach(function (a) { a.classList.toggle('active', page === 'pagina' && a.getAttribute('href') === location.hash); });
    $('#nav').classList.remove('open');
    $('#menu-btn').setAttribute('aria-expanded', 'false');
    if (page !== lastPage) window.scrollTo(0, 0);
    if (lastPage === 'inno' && page !== 'inno') pauseAudio();
    lastPage = page;
    observeReveals();
    fxActive = page === 'home';
    if (fxActive) fxStart();
    if (page === 'tessera') initCard();
    if (page === 'verifica') { initVerify(); renderVerify(); }
    if (page === 'inno') initPlayer();
    vizActive = page === 'inno';
    if (vizActive) vizLoop();
  }

  /* ---------------- nav / theme / scroll ---------------- */
  function initChrome() {
    var nav = $('#nav'), mb = $('#menu-btn');
    mb.addEventListener('click', function () {
      var o = nav.classList.toggle('open');
      mb.setAttribute('aria-expanded', String(o));
    });
    document.addEventListener('click', function (e) { if (!nav.contains(e.target)) nav.classList.remove('open'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') nav.classList.remove('open'); });
    $$('.lang button').forEach(function (b) { b.addEventListener('click', function () { applyLang(b.getAttribute('data-lang')); }); });

    var tb = $('#theme-btn');
    function setTheme(th) {
      document.documentElement.setAttribute('data-theme', th);
      tb.firstChild.textContent = th === 'light' ? '☀' : '☾';
      var m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', th === 'light' ? '#fff6fb' : '#130d1c');
      store.set('nsk-theme', th);
    }
    setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    tb.addEventListener('click', function () { setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'); });

    var bar = $('#progress'), top = $('#to-top'), ticking = false;
    function onScroll() {
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
      top.hidden = scrollY < 700;
      ticking = false;
    }
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); });
    onScroll();
  }

  /* ---------------- reveal + counters ---------------- */
  var io = null;
  function observeReveals() {
    var pending = $$('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) { pending.forEach(function (e) { e.classList.add('in'); }); return; }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var el = en.target;
          var delay = Math.min(parseInt(el.getAttribute('data-d') || '0', 10), 400);
          setTimeout(function () { el.classList.add('in'); }, delay);
          if (el.classList.contains('stats')) countUp(el);
          io.unobserve(el);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    }
    // piccolo effetto a cascata nei gruppi
    $$('.pillars, .index-grid, .banknote-grid, .articles, .econ-grid, .cult-grid').forEach(function (g) {
      $$('.reveal', g).forEach(function (el, i) { el.setAttribute('data-d', String((i % 4) * 80)); });
    });
    pending.forEach(function (el) { io.observe(el); });
  }
  function countUp(box) {
    if (reduceMotion) return;
    $$('[data-count]', box).forEach(function (b) {
      var to = parseInt(b.getAttribute('data-count'), 10), t0 = performance.now();
      (function step(now) {
        var p = Math.min(1, (now - t0) / 1000);
        b.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }

  /* ---------------- hero particles ---------------- */
  var fxActive = false, fxRunning = false, fxParts = [], fxCv, fxCtx, fxW = 0, fxH = 0;
  var GLYPHS = ['♡', '✦', '✧', '♥', '✦'];
  var COLORS = ['#ff86bd', '#69f0c1', '#b392ff', '#7fd4ff', '#ffc2de'];
  function fxResize() {
    var r = fxCv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    fxW = r.width; fxH = r.height;
    fxCv.width = Math.round(fxW * dpr); fxCv.height = Math.round(fxH * dpr);
    fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function fxMake(initial) {
    return { x: Math.random() * fxW, y: initial ? Math.random() * fxH : fxH + 20, s: 10 + Math.random() * 20, v: 12 + Math.random() * 26, g: GLYPHS[(Math.random() * GLYPHS.length) | 0], c: COLORS[(Math.random() * COLORS.length) | 0], ph: Math.random() * 6.28, a: .25 + Math.random() * .5 };
  }
  function fxStart() {
    if (reduceMotion || innerWidth < 700) return;
    fxCv = fxCv || $('#fx'); if (!fxCv) return;
    fxCtx = fxCtx || fxCv.getContext('2d');
    fxResize();
    var n = 16;
    fxParts = []; for (var i = 0; i < n; i++) fxParts.push(fxMake(true));
    if (fxRunning) return;
    fxRunning = true;
    var last = performance.now();
    (function loop(now) {
      if (!fxActive || document.hidden) { fxRunning = false; return; }
      if (now - last < 33) { requestAnimationFrame(loop); return; }
      var dt = Math.min(.05, (now - last) / 1000); last = now;
      fxCtx.clearRect(0, 0, fxW, fxH);
      for (var i = 0; i < fxParts.length; i++) {
        var p = fxParts[i];
        p.y -= p.v * dt; p.ph += dt;
        p.x += Math.sin(p.ph) * 14 * dt;
        if (p.y < -30) fxParts[i] = fxMake(false);
        fxCtx.globalAlpha = p.a;
        fxCtx.fillStyle = p.c;
        fxCtx.font = p.s + 'px serif';
        fxCtx.fillText(p.g, p.x, p.y);
      }
      requestAnimationFrame(loop);
    })(last);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && fxActive) fxStart(); if (!document.hidden && vizActive) vizLoop(); });
  addEventListener('resize', function () { if (fxActive && fxCv) fxResize(); });

  /* ---------------- lightbox ---------------- */
  function initLightbox() {
    var dlg = $('#lightbox'), img = $('#lb-img'), cap = $('#lb-cap');
    if (!dlg) return;
    $$('.banknote-card, .poster-card').forEach(function (b) {
      b.addEventListener('click', function () {
        img.src = b.getAttribute('data-src');
        var k = b.getAttribute('data-key');
        img.alt = t(k);
        cap.textContent = t(k) + (D.it[k + '.p'] ? ' — ' + t(k + '.p') : '');
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      });
    });
    function close() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
    $('#lb-close').addEventListener('click', close);
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.tagName === 'FIGURE') close(); });
  }

  /* ---------------- anthem player ---------------- */
  var audio, playerReady = false, actx = null, analyser = null, freq = null, realViz = false, vizActive = false, vizRunning = false, simT = 0;
  function fmt(s) { if (!isFinite(s)) return '0:00'; s = Math.floor(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function setRange(el) { el.style.setProperty('--p', (el.value - el.min) / (el.max - el.min) * 100 + '%'); }
  function updatePlayLabel() {
    var pb = $('#play'); if (!pb) return;
    var playing = audio && !audio.paused;
    pb.setAttribute('aria-label', t(playing ? 'a.pause' : 'a.play'));
  }
  function setPlayIcon(playing) {
    $('#play-ic').setAttribute('d', playing ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'M8 5v14l11-7z');
    $('#player').classList.toggle('playing', playing);
    updatePlayLabel();
  }
  function pauseAudio() { if (audio && !audio.paused) audio.pause(); }
  function initPlayer() {
    audio = audio || $('#audio');
    if (!window.NSK_LYRICS) loadScript('assets/js/lyrics.js', renderLyrics); else if (!lyrBuilt) renderLyrics();
    if (audio.preload !== 'metadata' && audio.readyState === 0) { audio.preload = 'metadata'; try { audio.load(); } catch (e) {} }
    if (playerReady) return;
    playerReady = true;
    var seek = $('#seek'), vol = $('#vol'), cur = $('#t-cur'), dur = $('#t-dur'), play = $('#play'), loop = $('#loop');
    dur.textContent = '3:19';
    setRange(seek); setRange(vol);
    audio.volume = .8;
    audio.addEventListener('loadedmetadata', function () { dur.textContent = fmt(audio.duration); });
    audio.addEventListener('timeupdate', function () {
      lyrSync(audio.currentTime);
      if (!audio.duration) return;
      if (!seeking) { seek.value = Math.round(audio.currentTime / audio.duration * 1000); setRange(seek); }
      cur.textContent = fmt(audio.currentTime);
    });
    audio.addEventListener('play', function () { setPlayIcon(true); });
    audio.addEventListener('pause', function () { setPlayIcon(false); });
    audio.addEventListener('ended', function () { lyrIdx = -2; lyrSync(0); setPlayIcon(false); seek.value = 0; setRange(seek); });
    audio.addEventListener('error', function () { $('#p-err').hidden = false; });
    var seeking = false;
    seek.addEventListener('input', function () {
      seeking = true; setRange(seek);
      if (audio.duration) cur.textContent = fmt(seek.value / 1000 * audio.duration);
    });
    seek.addEventListener('change', function () {
      if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration;
      seeking = false;
    });
    vol.addEventListener('input', function () { audio.volume = vol.value / 100; setRange(vol); });
    loop.addEventListener('click', function () {
      audio.loop = !audio.loop;
      loop.setAttribute('aria-pressed', String(audio.loop));
    });
    play.addEventListener('click', function () {
      if (audio.paused) {
        setupAnalyser();
        var pr = audio.play();
        if (pr && pr.catch) pr.catch(function () { $('#p-err').hidden = false; });
      } else audio.pause();
    });
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: 'Inno del Noskynismo', artist: 'NoskynHK & Sig.Lev', artwork: [{ src: 'assets/img/icon-256.png', sizes: '256x256', type: 'image/png' }] });
        navigator.mediaSession.setActionHandler('play', function () { audio.play(); });
        navigator.mediaSession.setActionHandler('pause', function () { audio.pause(); });
      } catch (e) {}
    }
  }
  /* testo dell'inno, evidenziato mentre suona */
  var lyrBuilt = false, lyrIdx = -1;
  function renderLyrics() {
    var L = window.NSK_LYRICS, box = $('#lyr-body'); if (!L || !box) return;
    var tx = L.text[lang] || L.text.it, h = '';
    L.blocks.forEach(function (b, i) {
      h += '<p class="lyr' + (b.ch ? ' chorus' : '') + (i === lyrIdx ? ' on' : '') + '" data-i="' + i + '">' + tx[b.k].map(esc).join('<br>') + '</p>';
    });
    box.innerHTML = h; lyrBuilt = true;
  }
  function lyrSync(ct) {
    var L = window.NSK_LYRICS; if (!L || !lyrBuilt) return;
    var idx = -1; L.blocks.forEach(function (b, i) { if (ct >= b.t) idx = i; });
    if (idx === lyrIdx) return;
    lyrIdx = idx;
    var box = $('#lyr-body');
    $$('.lyr', box).forEach(function (el, i) { el.classList.toggle('on', i === idx); });
    var el = idx >= 0 ? $$('.lyr', box)[idx] : null;
    if (el && box.scrollHeight > box.clientHeight) box.scrollTo({ top: Math.max(0, el.offsetTop - box.clientHeight / 3), behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  function setupAnalyser() {
    if (actx || !/^https?:$/.test(location.protocol)) return; // da file:// l'audio andrebbe in silenzio: uso l'animazione simulata
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      actx = new AC();
      var src = actx.createMediaElementSource(audio);
      analyser = actx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = .82;
      src.connect(analyser); analyser.connect(actx.destination);
      freq = new Uint8Array(analyser.frequencyBinCount);
      realViz = true;
    } catch (e) { realViz = false; }
    if (actx && actx.state === 'suspended') actx.resume();
  }
  function vizLoop() {
    if (vizRunning) return;
    vizRunning = true;
    var cv = $('#viz'); cv.width = cv.height = 480; var c = cv.getContext('2d'), N = 64, S = cv.width, mid = S / 2, last = 0;
    var vals = new Float32Array(N);
    (function frame(now) {
      if (!vizActive || document.hidden) { vizRunning = false; return; }
      if (now - last < 33) { requestAnimationFrame(frame); return; }
      last = now;
      simT += .033;
      var playing = audio && !audio.paused;
      if (playing && realViz && analyser) {
        analyser.getByteFrequencyData(freq);
        var sum = 0;
        for (var i = 0; i < N; i++) {
          var k = i < N / 2 ? i : N - 1 - i;
          var v = freq[Math.min(freq.length - 1, 2 + k * 2)] / 255;
          vals[i] += (v - vals[i]) * .5; sum += v;
        }
      } else {
        for (var j = 0; j < N; j++) {
          var kk = j < N / 2 ? j : N - 1 - j;
          var amp = playing ? .55 : .12;
          var tv = amp * (.5 + .5 * Math.sin(simT * (playing ? 5 : 1.5) + kk * .5) * Math.sin(simT * 1.7 + kk * .21)) + (playing ? .15 * Math.random() : 0);
          vals[j] += (tv - vals[j]) * .25;
        }
      }
      c.clearRect(0, 0, S, S);
      c.lineCap = 'round'; c.lineWidth = 6;
      var r0 = S * .31, rmax = S * .17;
      for (var n = 0; n < N; n++) {
        var a = n / N * Math.PI * 2 - Math.PI / 2, len = 6 + vals[n] * rmax;
        c.strokeStyle = 'hsl(' + (330 - (n < N / 2 ? n : N - n) / (N / 2) * 170) + ',92%,68%)';
        c.beginPath();
        c.moveTo(mid + Math.cos(a) * r0, mid + Math.sin(a) * r0);
        c.lineTo(mid + Math.cos(a) * (r0 + len), mid + Math.sin(a) * (r0 + len));
        c.stroke();
      }
      requestAnimationFrame(frame);
    })(performance.now());
  }

  /* ---------------- membership card ---------------- */
  var cardReady = false, cardInit = false, emblemImg = null, unlocked = false;
  function loadScript(src, cb) { var s = document.createElement('script'); s.src = src; s.onload = cb; s.onerror = cb; document.head.appendChild(s); }
  function initCard() {
    if (cardInit) { drawCard(); return; }
    cardInit = true;
    var nome = $('#tess-nome'), ruolo = $('#tess-ruolo'), custom = $('#tess-custom');
    var raf = 0;
    function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(drawCard); }
    nome.addEventListener('input', schedule); ruolo.addEventListener('change', schedule); custom.addEventListener('input', schedule);

    $('#tess-unlock').addEventListener('click', tryUnlock);
    $('#tess-code').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); tryUnlock(); } });
    function tryUnlock() {
      var v = $('#tess-code').value.trim(), st = $('#code-status');
      if (!v) return;
      if (cyrb53(v) === CODE_HASH) {
        unlocked = true; store.set('nsk-unlocked', '1');
        showUnlocked(); st.className = 'tess-status'; st.textContent = t('k.code.ok');
        $('#tess-custom').focus();
      } else { st.className = 'tess-status err'; st.textContent = t('k.code.bad'); }
    }
    function showUnlocked() { $('#custom-wrap').hidden = false; $('#tess-code').value = ''; }
    if (store.get('nsk-unlocked') === '1') { unlocked = true; showUnlocked(); }

    $('#tess-download').addEventListener('click', downloadCard);
    $('#tess-print').addEventListener('click', printCard);

    var go = function () {
      cardReady = true; drawCard();
      if (document.fonts && document.fonts.load) {
        Promise.all([document.fonts.load('700 40px Manrope', 'Аб'), document.fonts.load('600 40px Manrope', 'Аб'), document.fonts.load('700 40px Manrope'), document.fonts.load('600 40px Manrope'), document.fonts.load('italic 400 40px "Instrument Serif"')]).then(drawCard, function () {});
        document.fonts.ready.then(drawCard);
      }
    };
    var pending = 2;
    function done() { if (--pending === 0) go(); }
    function withEmblem() {
      if (window.NSK_EMBLEM) { emblemImg = new Image(); emblemImg.onload = done; emblemImg.onerror = done; emblemImg.src = window.NSK_EMBLEM; } else done();
    }
    if (window.NSKQR) done(); else loadScript('assets/js/qr.js', done);
    if (window.NSK_EMBLEM) withEmblem(); else loadScript('assets/js/emblem-data.js', withEmblem);
  }

  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function seeded(seed) { var s = seed % 2147483647; if (s <= 0) s += 2147483646; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }
  function fit(c, text, maxW, px, tpl, min) {
    while (px > (min || 24)) { c.font = tpl.replace('$', px); if (c.measureText(text).width <= maxW) break; px -= 2; }
    c.font = tpl.replace('$', px); return px;
  }
  function cardState() {
    var custom = unlocked ? ($('#tess-custom').value || '').trim() : '';
    var i = parseInt($('#tess-ruolo').value, 10) || 0;
    return { custom: custom, idx: custom ? 255 : i, role: custom || t('k.r' + (i + 1)) };
  }
  /* ---------------- codice N. criptato + verifica ---------------- */
  var SALT = 'nsk-levi-2026', B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function toBytes(str) { var u = unescape(encodeURIComponent(str)), o = [], i; for (i = 0; i < u.length; i++) o.push(u.charCodeAt(i)); return o; }
  function fromBytes(a) { var str = '', i; for (i = 0; i < a.length; i++) str += String.fromCharCode(a[i]); try { return decodeURIComponent(escape(str)); } catch (e) { return str; } }
  function keystream(iv, n) {
    var x = (cyrb53(SALT + iv) >>> 0) || 1, o = [], i;
    for (i = 0; i < n; i++) { x ^= (x << 13); x >>>= 0; x ^= (x >>> 17); x ^= (x << 5); x >>>= 0; o.push(x & 255); }
    return o;
  }
  function b32enc(bytes) {
    var out = '', bits = 0, val = 0;
    bytes.forEach(function (b) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32.charAt((val >>> (bits - 5)) & 31); bits -= 5; } val &= (1 << bits) - 1; });
    if (bits) out += B32.charAt((val << (5 - bits)) & 31);
    return out;
  }
  function b32dec(str) {
    var out = [], bits = 0, val = 0, i, idx;
    for (i = 0; i < str.length; i++) {
      idx = B32.indexOf(str.charAt(i)); if (idx < 0) return null;
      val = (val << 5) | idx; bits += 5;
      if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; val &= (1 << bits) - 1; }
    }
    return out;
  }
  function checksum(body) { return cyrb53(body.join(',') + SALT) & 0xffff; }
  function encodeCard(name, idx, custom, year) {
    var nb = toBytes(name).slice(0, 90), p = [1, idx, year - 2000, nb.length].concat(nb);
    if (idx === 255) { var rb = toBytes(custom).slice(0, 60); p.push(rb.length); p = p.concat(rb); }
    var chk = checksum(p); p.push(chk >> 8, chk & 255);
    var iv = cyrb53(name + '|' + idx + '|' + custom) & 255, ks = keystream(iv, p.length), out = [iv];
    p.forEach(function (b, i) { out.push(b ^ ks[i]); });
    return 'NSK-' + b32enc(out).match(/.{1,5}/g).join('-');
  }
  function decodeCard(code) {
    var str = String(code || '').toUpperCase().replace(/^\s*NSK[-\s]*/, '').replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
    var raw = b32dec(str); if (!raw || raw.length < 8) return null;
    var iv = raw[0], ks = keystream(iv, raw.length - 1), p = raw.slice(1).map(function (b, i) { return b ^ ks[i]; });
    var chk = (p[p.length - 2] << 8) | p[p.length - 1], body = p.slice(0, -2);
    if (checksum(body) !== chk || body[0] !== 1) return null;
    var idx = body[1], nl = body[3]; if (4 + nl > body.length || (idx > 2 && idx !== 255)) return null;
    var r = { year: 2000 + body[2], idx: idx, name: fromBytes(body.slice(4, 4 + nl)), custom: '' };
    if (idx === 255) { var rl = body[4 + nl]; if (5 + nl + rl > body.length) return null; r.custom = fromBytes(body.slice(5 + nl, 5 + nl + rl)); }
    return r;
  }
  function esc(str) { return String(str).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var verifyInit = false;
  function initVerify() {
    if (verifyInit) return; verifyInit = true;
    $('#v-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var c = $('#v-code').value.trim(), h = 'verifica/' + encodeURIComponent(c);
      if (location.hash === '#' + h) renderVerify(); else location.hash = h;
    });
  }
  function renderVerify() {
    var box = $('#v-result'), part = (location.hash || '').split('/')[1], code = '';
    try { code = decodeURIComponent(part || ''); } catch (e) { code = part || ''; }
    $('#v-code').value = code;
    if (!code) { box.className = 'v-result'; box.innerHTML = ''; return; }
    var r = decodeCard(code);
    if (!r) { box.className = 'v-result bad'; box.innerHTML = '<div class="v-ico" aria-hidden="true">✕</div><h2>' + t('v.bad') + '</h2><p>' + t('v.bad.d') + '</p>'; return; }
    var role = r.idx === 255 ? r.custom : t('k.r' + (r.idx + 1));
    box.className = 'v-result ok';
    box.innerHTML = '<div class="v-ico" aria-hidden="true">✓</div><h2>' + t('v.ok') + '</h2><dl>' +
      '<div><dt>' + t('v.holder') + '</dt><dd>' + esc(r.name) + '</dd></div>' +
      '<div><dt>' + t('v.role') + '</dt><dd>' + esc(role) + '</dd></div>' +
      '<div><dt>' + t('v.since') + '</dt><dd>' + r.year + '</dd></div></dl>';
  }
  function drawCard() {
    var cv = $('#tess-canvas'); if (!cv) return;
    var c = cv.getContext('2d'), W = cv.width, H = cv.height;
    var name = ($('#tess-nome').value || '').trim() || t('k.cv.default');
    var st = cardState(), role = st.role, year = new Date().getFullYear();
    var num = encodeCard(name, st.idx, st.custom, year);
    cv.setAttribute('data-code', num);
    var rnd = seeded(cyrb53(num) % 100000 + 7);

    c.clearRect(0, 0, W, H);
    c.save(); rr(c, 0, 0, W, H, 54); c.clip();

    var bg = c.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#1d1033'); bg.addColorStop(.55, '#2b1448'); bg.addColorStop(1, '#0f2f3a');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    var g1 = c.createRadialGradient(W * .82, H * .2, 0, W * .82, H * .2, 720);
    g1.addColorStop(0, 'rgba(255,134,189,.55)'); g1.addColorStop(1, 'rgba(255,134,189,0)');
    c.fillStyle = g1; c.fillRect(0, 0, W, H);
    var g2 = c.createRadialGradient(W * .08, H * .95, 0, W * .08, H * .95, 700);
    g2.addColorStop(0, 'rgba(105,240,193,.38)'); g2.addColorStop(1, 'rgba(105,240,193,0)');
    c.fillStyle = g2; c.fillRect(0, 0, W, H);

    // pieghe della gonna
    for (var i = 0; i < 9; i++) {
      c.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(255,134,189,.07)';
      var xb = W * .52 + i * 92;
      c.beginPath(); c.moveTo(xb, 0); c.lineTo(xb + 58, 0); c.lineTo(xb - 40, H); c.lineTo(xb - 100, H); c.closePath(); c.fill();
    }
    // stelline e cuori
    var gl = ['✦', '♡', '✧', '♥'], co = ['#ffc2de', '#9ff5d8', '#d3c0ff', '#ffffff'];
    for (var s = 0; s < 34; s++) {
      c.globalAlpha = .18 + rnd() * .5; c.fillStyle = co[(rnd() * 4) | 0];
      c.font = (14 + rnd() * 26) + 'px serif'; c.fillText(gl[(rnd() * 4) | 0], rnd() * W, rnd() * H);
    }
    c.globalAlpha = 1;
    // banda olografica
    var hol = c.createLinearGradient(0, H, W, 0);
    hol.addColorStop(0, 'rgba(255,255,255,0)'); hol.addColorStop(.42, 'rgba(255,255,255,0)');
    hol.addColorStop(.5, 'rgba(255,200,230,.16)'); hol.addColorStop(.56, 'rgba(160,255,230,.14)'); hol.addColorStop(.62, 'rgba(190,170,255,.14)'); hol.addColorStop(.7, 'rgba(255,255,255,0)');
    c.fillStyle = hol; c.fillRect(0, 0, W, H);
    c.restore();

    // bordo sfumato
    var bd = c.createLinearGradient(0, 0, W, H);
    bd.addColorStop(0, '#ff86bd'); bd.addColorStop(.5, '#b392ff'); bd.addColorStop(1, '#69f0c1');
    rr(c, 5, 5, W - 10, H - 10, 50); c.strokeStyle = bd; c.lineWidth = 6; c.stroke();
    rr(c, 22, 22, W - 44, H - 44, 38); c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 2; c.stroke();

    // emblema
    var cx = W - 330, cy = 372, r = 205;
    c.save(); c.shadowColor = 'rgba(255,134,189,.7)'; c.shadowBlur = 70;
    c.beginPath(); c.arc(cx, cy, r + 14, 0, 7); c.fillStyle = 'rgba(255,134,189,.25)'; c.fill(); c.restore();
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip();
    var disc = c.createRadialGradient(cx - 70, cy - 90, 10, cx, cy, r);
    disc.addColorStop(0, '#4a2b72'); disc.addColorStop(1, '#1d1033');
    c.fillStyle = disc; c.fillRect(cx - r, cy - r, r * 2, r * 2);
    if (emblemImg && emblemImg.complete && emblemImg.naturalWidth) c.drawImage(emblemImg, cx - r * .96, cy - r * .96, r * 1.92, r * 1.92);
    c.restore();
    c.beginPath(); c.arc(cx, cy, r, 0, 7); c.strokeStyle = bd; c.lineWidth = 8; c.stroke();
    c.beginPath(); c.arc(cx, cy, r + 30, 0, 7); c.setLineDash([2, 16]); c.lineCap = 'round'; c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 5; c.stroke(); c.setLineDash([]);

    // testi
    var lx = 96, maxW = W - 760 - lx;
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#69f0c1'; c.font = '800 28px Manrope, sans-serif';
    if ('letterSpacing' in c) c.letterSpacing = '5px';
    c.fillText(t('k.cv.head'), lx + 40, 118);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    c.beginPath(); c.arc(lx + 12, 108, 11, 0, 7); c.fillStyle = '#ff86bd'; c.fill();

    var tg = c.createLinearGradient(lx, 0, lx + 640, 0);
    tg.addColorStop(0, '#ffb3d6'); tg.addColorStop(.6, '#cdb8ff'); tg.addColorStop(1, '#8ff3d3');
    c.fillStyle = tg; c.font = 'italic 400 128px "Instrument Serif", Georgia, serif';
    c.fillText('Il Noskynismo', lx, 262);

    c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(lx, 306, maxW, 3);

    c.fillStyle = '#c9bcd8'; c.font = '700 26px Manrope, sans-serif'; c.fillText(t('k.cv.issued').toUpperCase(), lx, 384);
    c.fillStyle = '#ffffff'; fit(c, name, maxW, 76, '800 $px Manrope, sans-serif', 34); c.fillText(name, lx, 464);

    c.fillStyle = '#c9bcd8'; c.font = '700 26px Manrope, sans-serif'; c.fillText(t('k.cv.role').toUpperCase(), lx, 556);
    c.fillStyle = '#ff9fcb'; fit(c, role, maxW, 46, '800 $px Manrope, sans-serif', 24); c.fillText(role, lx, 612);

    // QR code: apre la pagina di verifica con il codice già inserito
    if (window.NSKQR) {
      var q = NSKQR.make(location.href.split('#')[0] + '#verifica/' + num), ms = Math.max(4, Math.floor(224 / q.size)), qs = ms * q.size, pl = qs + 40, px = cx - pl / 2, py = 662;
      c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 26; rr(c, px, py, pl, pl, 22); c.fillStyle = '#fdf7fc'; c.fill(); c.restore();
      c.fillStyle = '#1d1033';
      for (var qy = 0; qy < q.size; qy++) for (var qx = 0; qx < q.size; qx++) if (q.get(qx, qy)) c.fillRect(px + 20 + qx * ms, py + 20 + qy * ms, ms, ms);
    }
    // codice N. criptato
    var parts = num.split('-'), lines = [], cur = '';
    parts.forEach(function (pt) { var nx = cur ? cur + '-' + pt : pt; if (nx.length > 29 && cur) { lines.push(cur + '-'); cur = pt; } else cur = nx; });
    lines.push(cur);
    c.fillStyle = '#c9bcd8'; c.font = '700 24px Manrope, sans-serif'; c.fillText('N.', lx, 712);
    c.fillStyle = '#efe6f6'; c.font = '700 25px ui-monospace, Menlo, Consolas, monospace';
    var shown = lines.slice(0, 6);
    shown.forEach(function (l, i) { c.fillText(l, lx, 750 + i * 33); });
    c.fillStyle = '#c9bcd8'; c.font = '600 26px Manrope, sans-serif';
    c.fillText(t('k.cv.since') + ' ' + year, lx, Math.min(750 + shown.length * 33 + 16, 896));

    c.fillStyle = 'rgba(255,255,255,.62)'; c.font = 'italic 400 36px "Instrument Serif", Georgia, serif';
    c.fillText(t('k.cv.motto'), lx, H - 84);
  }
  function downloadCard() {
    var cv = $('#tess-canvas'), st = $('#tess-status');
    drawCard();
    cv.toBlob(function (blob) {
      if (!blob) { st.className = 'tess-status err'; st.textContent = t('k.err'); return; }
      var raw = ($('#tess-nome').value || 'socio').trim().toLowerCase();
      var slug = raw.normalize ? raw.normalize('NFD').replace(/[̀-ͯ]/g, '') : raw;
      slug = slug.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'socio';
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'tessera-noskynismo-' + slug + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      st.className = 'tess-status'; st.textContent = t('k.saved');
      setTimeout(function () { if (st.textContent === t('k.saved')) st.textContent = ''; }, 3500);
    }, 'image/png');
  }

  /* ---------------- stampa tessera: PDF A4 fronte + retro (85,6 x 54 mm) ---------------- */
  function jpegSize(b) {
    var i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 255) { i++; continue; }
      var m = b[i + 1];
      if (m >= 192 && m <= 207 && m !== 196 && m !== 200 && m !== 204) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
    return null;
  }
  function buildPdf(front, back) {
    var enc = new TextEncoder(), parts = [], pos = 0, offs = [];
    function add(x) { var u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); pos += u.length; }
    function obj(n, head, stream) {
      offs[n] = pos;
      add(n + ' 0 obj\n' + head.replace('%L', stream ? stream.length : 0) + '\n');
      if (stream) { add('stream\n'); add(stream); add('\nendstream\n'); }
      add('endobj\n');
    }
    var mm = 72 / 25.4, cw = 85.6 * mm, ch = 54 * mm, PW = 595.276, PH = 841.89, x = (PW - cw) / 2;
    var y1 = PH - 30 * mm - ch, y2 = y1 - 10 * mm - ch, c = '0.3 w 0 G\n';
    function card(im, y) {
      c += 'q ' + cw.toFixed(2) + ' 0 0 ' + ch.toFixed(2) + ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' cm /' + im + ' Do Q\n';
      var L = 4 * mm, g = 1.2 * mm;
      [x, x + cw].forEach(function (cx, ix) { [y, y + ch].forEach(function (cy, iy) {
        var sx = ix ? 1 : -1, sy = iy ? 1 : -1;
        c += (cx + sx * g).toFixed(2) + ' ' + cy.toFixed(2) + ' m ' + (cx + sx * (g + L)).toFixed(2) + ' ' + cy.toFixed(2) + ' l S\n';
        c += cx.toFixed(2) + ' ' + (cy + sy * g).toFixed(2) + ' m ' + cx.toFixed(2) + ' ' + (cy + sy * (g + L)).toFixed(2) + ' l S\n';
      }); });
    }
    card('Im1', y1); card('Im2', y2);
    c += 'BT /F1 7 Tf 0.3 g ' + (PW / 2 - 135).toFixed(1) + ' 28 Td (Il Noskynismo - stampa al 100% / print at 100% (actual size) - 85.6 x 54 mm) Tj ET\n';
    var fs = jpegSize(front), bs = jpegSize(back);
    add('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im1 4 0 R /Im2 5 0 R >> /Font << /F1 7 0 R >> >> /Contents 6 0 R >>');
    obj(4, '<< /Type /XObject /Subtype /Image /Width ' + fs.w + ' /Height ' + fs.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %L >>', front);
    obj(5, '<< /Type /XObject /Subtype /Image /Width ' + bs.w + ' /Height ' + bs.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %L >>', back);
    var cs = enc.encode(c); obj(6, '<< /Length %L >>', cs);
    obj(7, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    var xr = pos; add('xref\n0 8\n0000000000 65535 f \n');
    for (var i = 1; i <= 7; i++) add(('0000000000' + offs[i]).slice(-10) + ' 00000 n \n');
    add('trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  }
  function printCard() {
    var cv = $('#tess-canvas'), st = $('#tess-status'), btn = $('#tess-print');
    drawCard();
    st.className = 'tess-status'; st.textContent = t('k.printing'); btn.disabled = true;
    var W = 2022, H = 1276, tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
    var c = tmp.getContext('2d'), sh = cv.height - 68, sw = Math.round(sh * W / H);
    c.fillStyle = '#1d1033'; c.fillRect(0, 0, W, H); c.imageSmoothingQuality = 'high';
    c.drawImage(cv, Math.round((cv.width - sw) / 2), 34, sw, sh, 0, 0, W, H);
    var front = new Promise(function (res, rej) { tmp.toBlob(function (b) { b ? b.arrayBuffer().then(res, rej) : rej(); }, 'image/jpeg', .92); });
    var back = fetch('assets/img/tessera-retro.jpg').then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); });
    Promise.all([front, back]).then(function (a) {
      var blob = buildPdf(new Uint8Array(a[0]), new Uint8Array(a[1]));
      var url = URL.createObjectURL(blob), l = document.createElement('a');
      l.href = url; l.download = 'tessera-noskynismo-A4.pdf';
      document.body.appendChild(l); l.click(); l.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 6000);
      st.textContent = t('k.printed');
    }).catch(function () { st.className = 'tess-status err'; st.textContent = t('k.err'); })
      .then(function () { btn.disabled = false; });
  }

  /* ---------------- convertitore Levvino ---------------- */
  var cvInit = false, cvDir = 'cur', LOC = { it: 'it-IT', en: 'en-GB', de: 'de-DE', ru: 'ru-RU' };
  // unità di valuta per 1 Levvino (2 franchi = 1 Levvino; gli altri cambi sono indicativi e inventati)
  var CUR = { CHF: 2, EUR: 2.14, USD: 2.5, JPY: 380, KRW: 3500, RUB: 200 };
  var NOTES = [500, 200, 100, 50, 20, 10, 5, 2, 1];
  function curName(code) {
    try { return new Intl.DisplayNames([LOC[lang] || 'it-IT'], { type: 'currency' }).of(code); } catch (e) { return code; }
  }
  function convRender() {
    var inp = $('#cv-in'), out = $('#cv-out'), nt = $('#cv-notes'), sel = $('#cv-cur'); if (!inp) return;
    var code = sel.value || 'CHF', per = CUR[code], levName = t('e.cv.lev'), cn = code + ' · ' + curName(code);
    Array.prototype.forEach.call(sel.options, function (o) { o.textContent = o.value + ' · ' + curName(o.value); });
    $('#cv-from').textContent = cvDir === 'cur' ? cn : levName;
    $('#cv-to').textContent = cvDir === 'cur' ? levName : cn;
    var loc = LOC[lang] || 'it-IT', big = per >= 100, nf = new Intl.NumberFormat(loc, { maximumFractionDigits: big ? 0 : 2, minimumFractionDigits: big ? 0 : 2 }), nf2 = new Intl.NumberFormat(loc, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    $('#cv-rate').textContent = '1 Lv = ' + new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }).format(per) + ' ' + code;
    var v = parseFloat(String(inp.value).replace(/\s/g, '').replace(',', '.'));
    if (!isFinite(v) || v < 0 || v > 1e12) { out.textContent = '—'; nt.innerHTML = '<span class="cv-lbl">' + t('e.cv.none') + '</span>'; return; }
    var lev = cvDir === 'cur' ? v / per : v, res = cvDir === 'cur' ? lev : v * per;
    out.textContent = cvDir === 'cur' ? nf2.format(res) + ' Lv' : nf.format(res) + ' ' + code;
    var whole = Math.floor(lev + 1e-9), rest = Math.round((lev - whole) * 100) / 100, html = '';
    if (whole > 0 && whole < 1e7) {
      NOTES.forEach(function (n) { var k = Math.floor(whole / n); whole -= k * n; if (k) html += '<span class="cv-chip"><b>' + k + '×</b> ' + n + ' Lv</span>'; });
    }
    if (rest >= 0.01) html += '<span class="cv-chip">' + t('e.cv.change') + ' ' + nf2.format(rest) + ' Lv</span>';
    nt.innerHTML = html ? '<span class="cv-lbl">' + t('e.cv.notes') + '</span>' + html : '';
  }
  function initConverter() {
    var inp = $('#cv-in'), sel = $('#cv-cur'); if (!inp) return;
    Object.keys(CUR).forEach(function (c) { var o = document.createElement('option'); o.value = c; sel.appendChild(o); });
    cvInit = true;
    inp.addEventListener('input', convRender);
    sel.addEventListener('change', convRender);
    $('#cv-swap').addEventListener('click', function () {
      var v = parseFloat(String(inp.value).replace(',', '.')), per = CUR[sel.value];
      cvDir = cvDir === 'cur' ? 'lev' : 'cur';
      if (isFinite(v)) { var r = cvDir === 'lev' ? v / per : v * per; inp.value = (Math.round(r * 100) / 100).toString().replace('.', lang === 'en' ? '.' : ','); }
      convRender();
    });
    convRender();
  }

  /* ---------------- app installabile (service worker) ---------------- */
  function initPwa() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  /* ---------------- Formspree ---------------- */
  function initForm() {
    var form = $('#idea-form'); if (!form) return;
    var st = $('#f-status'), btn = $('#f-send');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = $('#f-msg').value.trim();
      if (msg.length < 3) { st.className = 'tess-status err'; st.textContent = t('j.req'); return; }
      $('#f-lang').value = lang;
      btn.disabled = true; st.className = 'tess-status'; st.textContent = t('j.sending');
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
        .then(function (r) {
          if (r.ok) { st.textContent = t('j.ok'); form.reset(); $('#f-lang').value = lang; return; }
          return r.json().then(function (j) { return j; }, function () { return {}; }).then(function (j) {
            var m = (j && j.errors && j.errors.map(function (x) { return x.message; }).join(', ')) || (j && j.error) || '';
            st.className = 'tess-status err';
            st.textContent = t('j.err') + ' [' + r.status + (m ? ': ' + m : '') + ']';
          });
        })
        .catch(function () {
          // rete/CORS (es. pagina aperta da file://): ripiego sull'invio classico di Formspree
          st.textContent = t('j.sending');
          form.target = '_blank';
          HTMLFormElement.prototype.submit.call(form);
        })
        .then(function () { btn.disabled = false; });
    });
    var sh = $('#share-btn');
    if (sh) sh.addEventListener('click', function () {
      var data = { title: document.title, text: t('meta.desc'), url: location.origin && location.origin !== 'null' ? location.href.split('#')[0] : location.href };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(data.url).then(function () { toast(t('ui.copied')); }, function () {});
    });
  }
  function toast(msg) {
    var d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#fff;color:#2a0f26;padding:12px 20px;border-radius:999px;font:700 .9rem Manrope,sans-serif;z-index:400;box-shadow:0 10px 30px rgba(0,0,0,.4)';
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2200);
  }

  /* ---------------- ☭ easter egg ---------------- */
  var eggOpen = false;
  function openEgg() {
    if (eggOpen) return; eggOpen = true;
    var egg = $('#egg'); egg.hidden = false; document.body.style.overflow = 'hidden';
    store.set('nsk-egg', '1');
    $('#egg-close').focus();
    var cv = $('#egg-fx'), c = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2);
    var W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    var ps = []; for (var i = 0; i < 46; i++) ps.push({ x: Math.random() * W, y: Math.random() * H - H, s: (16 + Math.random() * 40) * dpr, v: (40 + Math.random() * 120) * dpr, g: Math.random() < .5 ? '☭' : '★', a: .2 + Math.random() * .6, r: Math.random() * 6 });
    var last = performance.now();
    (function loop(now) {
      if (!eggOpen) return;
      var dt = Math.min(.05, (now - last) / 1000); last = now;
      c.clearRect(0, 0, W, H); c.textBaseline = 'top';
      ps.forEach(function (p) {
        p.y += p.v * dt; p.r += dt;
        if (p.y > H) { p.y = -60 * dpr; p.x = Math.random() * W; }
        c.globalAlpha = p.a; c.fillStyle = Math.random() < .002 ? '#fff' : '#ffd24a';
        c.font = p.s + 'px serif'; c.fillText(p.g, p.x + Math.sin(p.r) * 20 * dpr, p.y);
      });
      requestAnimationFrame(loop);
    })(last);
  }
  function closeEgg() { eggOpen = false; $('#egg').hidden = true; document.body.style.overflow = ''; }
  function initEgg() {
    $('#egg-close').addEventListener('click', closeEgg);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && eggOpen) { closeEgg(); return; }
      var tg = e.target && e.target.tagName;
      if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
      buf.push(e.key.length === 1 ? e.key.toLowerCase() : e.key); if (buf.length > 20) buf.shift();
      var s = buf.join('|');
      if (s.indexOf(KONAMI) !== -1 || s.indexOf(WORD) !== -1) { buf = []; openEgg(); }
    });
    var clicks = 0, tm = 0, fe = $('#foot-emblem');
    fe.addEventListener('click', function () {
      clicks++; clearTimeout(tm); tm = setTimeout(function () { clicks = 0; }, 2500);
      if (clicks >= 7) { clicks = 0; openEgg(); }
    });
    try { console.log('%c☭ svoboda', 'font:700 20px serif;color:#ffd24a;background:#6b0a14;padding:4px 10px;border-radius:6px'); } catch (e) {}
  }
  var buf = [], KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'].join('|'), WORD = 's|v|o|b|o|d|a';

  /* ---------------- boot ---------------- */
  function boot() {
    initChrome();
    initLightbox();
    initForm();
    initConverter();
    initPwa();
    initEgg();
    applyLang(detectLang());
    addEventListener('hashchange', render);
    render();
    loadContent();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
