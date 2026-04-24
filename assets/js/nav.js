/* Silver Score — nav.js
 * Mobile disclosure + compact-on-scroll.
 * Expects markup:
 *   <nav>
 *     <div class="container">
 *       <a class="logo-link">…</a>
 *       <button class="nav-toggle" aria-expanded="false" aria-controls="nav-panel" aria-label="Open navigation">…</button>
 *       <div class="nav-panel" id="nav-panel" data-state="closed">
 *         <div class="nav-links">…</div>
 *         <button id="theme-toggle" class="theme-toggle">…</button>
 *       </div>
 *     </div>
 *   </nav>
 */
(function () {
  var navEl = null;
  var toggleBtn = null;
  var panel = null;
  var lastFocused = null;
  var mql = window.matchMedia('(min-width: 860px)');

  function focusable(root) {
    return Array.prototype.slice.call(
      root.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    );
  }

  function openPanel() {
    if (!panel || !toggleBtn) return;
    lastFocused = document.activeElement;
    panel.setAttribute('data-state', 'open');
    toggleBtn.setAttribute('aria-expanded', 'true');
    toggleBtn.setAttribute('aria-label', 'Close navigation');
    document.body.setAttribute('data-nav-open', 'true');
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('click', onOutsideClick, true);
    var first = focusable(panel)[0];
    if (first) first.focus();
  }

  function closePanel(restoreFocus) {
    if (!panel || !toggleBtn) return;
    panel.setAttribute('data-state', 'closed');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-label', 'Open navigation');
    document.body.removeAttribute('data-nav-open');
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('click', onOutsideClick, true);
    if (restoreFocus && lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel(true);
      return;
    }
    if (e.key !== 'Tab') return;
    var items = focusable(panel);
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onOutsideClick(e) {
    if (!panel || !toggleBtn) return;
    if (panel.contains(e.target) || toggleBtn.contains(e.target)) return;
    closePanel(false);
  }

  function onMediaChange(e) {
    if (e.matches && panel && panel.getAttribute('data-state') === 'open') {
      closePanel(false);
    }
  }

  function setupScrollCompact() {
    if (!navEl) return;
    var raf = null;
    var threshold = 96;
    function update() {
      raf = null;
      if (window.scrollY > threshold) {
        navEl.setAttribute('data-compact', 'true');
        document.body.setAttribute('data-nav-compact', 'true');
      } else {
        navEl.removeAttribute('data-compact');
        document.body.removeAttribute('data-nav-compact');
      }
    }
    window.addEventListener(
      'scroll',
      function () {
        if (raf === null) raf = window.requestAnimationFrame(update);
      },
      { passive: true }
    );
    update();
  }

  function setupScrollHintRails() {
    var rails = document.querySelectorAll('.featured-rail-wrap');
    if (!rails.length) return;
    rails.forEach(function (wrap) {
      var scroller = wrap.querySelector('.featured-rail');
      if (!scroller) return;
      function check() {
        var max = scroller.scrollWidth - scroller.clientWidth;
        var atEnd = max <= 2 || scroller.scrollLeft >= max - 2;
        wrap.classList.toggle('is-scroll-end', atEnd);
      }
      scroller.addEventListener('scroll', check, { passive: true });
      window.addEventListener('resize', check);
      setTimeout(check, 200);
      check();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    navEl = document.querySelector('nav[aria-label="Main"]') || document.querySelector('nav');
    if (!navEl) {
      setupScrollHintRails();
      return;
    }
    toggleBtn = navEl.querySelector('.nav-toggle');
    panel = navEl.querySelector('.nav-panel');
    if (toggleBtn && panel) {
      toggleBtn.addEventListener('click', function () {
        var open = toggleBtn.getAttribute('aria-expanded') === 'true';
        if (open) closePanel(true);
        else openPanel();
      });
      if (mql.addEventListener) mql.addEventListener('change', onMediaChange);
      else if (mql.addListener) mql.addListener(onMediaChange);
      panel.addEventListener('click', function (e) {
        var t = e.target;
        if (t && t.closest && t.closest('a[href]')) closePanel(false);
      });
    }
    setupScrollCompact();
    setupScrollHintRails();
  });
})();
