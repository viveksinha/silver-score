(function () {
  var KEY = 'silver-score-theme';
  var LEGACY_KEY = 'movies-site-theme';

  function current() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }

  function apply(next) {
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {}
  }

  function toggle() {
    apply(current() === 'dark' ? 'light' : 'dark');
  }

  function syncButton() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var isDark = current() === 'dark';
    btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    btn.setAttribute(
      'aria-label',
      isDark ? 'Switch to light theme' : 'Switch to dark theme'
    );
    btn.setAttribute('title', isDark ? 'Light mode' : 'Dark mode');
    var label = btn.querySelector('.theme-toggle__label');
    if (label) {
      label.textContent = isDark ? 'Light' : 'Dark';
    } else if (!btn.querySelector('svg')) {
      btn.textContent = isDark ? 'Light' : 'Dark';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    try {
      if (!localStorage.getItem(KEY) && localStorage.getItem(LEGACY_KEY)) {
        localStorage.setItem(KEY, localStorage.getItem(LEGACY_KEY));
      }
    } catch (e) {}
    syncButton();
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        toggle();
        syncButton();
      });
    }
  });
})();
