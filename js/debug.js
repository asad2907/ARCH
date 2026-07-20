/* =========================================================================
   ARCH NAV TIMING INSTRUMENTATION  (temporary diagnostic — safe to remove)
   -------------------------------------------------------------------------
   Goal: measure, on the real device, exactly WHEN the main content becomes
   visible after a navigation and WHICH step gates it (rAF, timers, the
   IntersectionObserver callback, GSAP load, or a thrown error).

   HOW TO USE ON iPhone / iPad Safari:
     1. Open the site once with ?debug=1  e.g.  https://<site>/index.html?debug=1
        (this stores a flag in sessionStorage, so it stays on while you tap
        around Home / Projects / About / Contact / Journal / Services).
     2. A black log panel appears at the bottom. Each line is
            +<ms-since-this-page-started-loading>ms  <event>
     3. Navigate between pages and watch the panel. The important line is
            VISIBLE: <selector>   <-- this is when the main content actually shows
        Compare it to  revealPage(), rAF fired, timeout fired, observer fired.
     4. Report the panel contents back (or screenshot). Append ?debug=0 to stop.

   All logging is a no-op unless the debug flag is set, so this cannot affect
   normal visitors. It only reads state; it never changes the page's behavior.
   ========================================================================= */
(function () {
  'use strict';

  // ---- activation (persists across in-session navigations) -----------------
  var active = false;
  try {
    var qp = new URLSearchParams(location.search);
    if (qp.get('debug') === '1') sessionStorage.setItem('arch-debug', '1');
    if (qp.get('debug') === '0') sessionStorage.removeItem('arch-debug');
    active = sessionStorage.getItem('arch-debug') === '1';
  } catch (e) { /* storage blocked -> stays off */ }

  function ms() { return Math.round(performance.now()); }

  var lines = [];
  var panel = null;

  function buildPanel() {
    if (!active || panel || !document.body) return;
    panel = document.createElement('div');
    panel.id = 'arch-debug-panel';
    panel.setAttribute('style', [
      'position:fixed', 'left:0', 'right:0', 'bottom:0',
      'max-height:46vh', 'overflow:auto', 'z-index:2147483647',
      'background:rgba(0,0,0,0.86)', 'color:#39ff14',
      'font:10px/1.35 ui-monospace,Menlo,Consolas,monospace',
      'padding:6px 8px 10px', 'white-space:pre-wrap', 'word-break:break-word',
      'pointer-events:auto', 'border-top:2px solid #39ff14',
      '-webkit-user-select:text', 'user-select:text'
    ].join(';'));
    document.body.appendChild(panel);
    render();
    // Tap the panel to clear it.
    panel.addEventListener('click', function () { lines.length = 0; render(); });
  }

  function render() {
    if (panel) {
      panel.textContent = lines.join('\n');
      panel.scrollTop = panel.scrollHeight;
    }
  }

  // Global logger, usable from script.js as: window.DBG && DBG('...')
  window.DBG = function (label) {
    var line = '+' + ms() + 'ms  ' + label;
    lines.push(line);
    if (lines.length > 300) lines.shift();
    try { console.log('[ARCH]', line); } catch (e) {}
    if (active) { buildPanel(); render(); }
    return line;
  };

  if (!active) {
    // Still expose a working DBG (console-only) but skip the heavy probes.
    DBG('debug.js loaded (inactive — add ?debug=1 to enable overlay)');
    return;
  }

  // ---- initial state snapshot ----------------------------------------------
  var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
  DBG('debug.js loaded | page=' + (document.body && document.body.dataset ? document.body.dataset.page : '?') +
      ' | html.class="' + document.documentElement.className + '"' +
      ' | navType=' + (nav ? nav.type : 'n/a') +
      ' | gsap=' + (typeof window.gsap));

  // ---- rAF vs setTimeout probe (measures iOS post-navigation rAF deferral) --
  requestAnimationFrame(function () { DBG('PROBE: first requestAnimationFrame fired'); });
  setTimeout(function () { DBG('PROBE: first setTimeout(0) fired'); }, 0);

  // ---- paint timing --------------------------------------------------------
  try {
    if (window.PerformanceObserver) {
      var po = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (en) {
          DBG('PAINT: ' + en.name + ' @ ' + Math.round(en.startTime) + 'ms');
        });
      });
      po.observe({ type: 'paint', buffered: true });
    }
  } catch (e) {}

  // ---- lifecycle events ----------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () { buildPanel(); DBG('event: DOMContentLoaded'); });
  window.addEventListener('load', function () {
    DBG('event: window.load');
    if (nav) {
      DBG('navTiming: responseEnd=' + Math.round(nav.responseEnd) +
          ' domInteractive=' + Math.round(nav.domInteractive) +
          ' DCL=' + Math.round(nav.domContentLoadedEventEnd) +
          ' loadEnd=' + Math.round(nav.loadEventEnd));
    }
  });
  window.addEventListener('pageshow', function (e) { DBG('event: pageshow persisted=' + e.persisted); });
  window.addEventListener('pagehide', function (e) { DBG('event: pagehide persisted=' + e.persisted); });

  // ---- error capture (a thrown error would silently leave content hidden) --
  window.addEventListener('error', function (e) {
    DBG('*** JS ERROR: ' + (e.message || (e.error && e.error.message) || e.type) +
        ' @ ' + (e.filename || '?') + ':' + (e.lineno || '?'));
  });
  window.addEventListener('unhandledrejection', function (e) {
    DBG('*** PROMISE REJECTION: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });

  // ---- main-content visibility sampler -------------------------------------
  // Poll (via setTimeout so it keeps working even if rAF is throttled) the
  // computed opacity/transform of representative main-content elements and log
  // the exact moment each first becomes visible.
  var SELECTORS = [
    '.page-section.active h1 .line-reveal-inner',
    '.page-section.active .line-reveal-inner',
    '.page-section.active .reveal-up',
    '.page-section.active .reveal-fade'
  ];
  var tracked = [];

  function collectTargets() {
    SELECTORS.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el && !tracked.some(function (t) { return t.el === el; })) {
        tracked.push({ sel: sel, el: el, shown: false, logged0: false });
      }
    });
  }

  function translateY(cs) {
    var tf = cs.transform;
    if (!tf || tf === 'none') return 0;
    var m = tf.match(/matrix(3d)?\(([^)]+)\)/);
    if (!m) return 0;
    var p = m[2].split(',').map(parseFloat);
    return m[1] ? (p[13] || 0) : (p[5] || 0); // ty for 2d/3d matrices
  }

  function isVisible(el) {
    var cs = getComputedStyle(el);
    return parseFloat(cs.opacity) > 0.9 && Math.abs(translateY(cs)) < 4;
  }

  var pollStart = performance.now();
  function poll() {
    collectTargets();
    tracked.forEach(function (t) {
      if (!t.logged0) {
        t.logged0 = true;
        var cs = getComputedStyle(t.el);
        DBG('track "' + t.sel + '": start opacity=' + cs.opacity + ' ty=' + Math.round(translateY(cs)) + 'px');
      }
      if (!t.shown && isVisible(t.el)) {
        t.shown = true;
        DBG('>>> VISIBLE: "' + t.sel + '"');
      }
    });
    if (performance.now() - pollStart < 5000) setTimeout(poll, 50);
    else DBG('sampler stopped (5s elapsed)');
  }

  if (document.body) { buildPanel(); poll(); }
  else document.addEventListener('DOMContentLoaded', function () { buildPanel(); poll(); });
}());
