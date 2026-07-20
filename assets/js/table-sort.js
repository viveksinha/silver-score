/**
 * Silver Score — sortable table headers (works with infinite-scroll reset).
 * Use data-sort-key / data-sort-default on <th>, bind with bindSortableTable().
 */
(function (global) {
  'use strict';

  function cmpNum(va, vb) {
    var a = Number(va);
    var b = Number(vb);
    if (isNaN(a)) a = -Infinity;
    if (isNaN(b)) b = -Infinity;
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  /**
   * @param {Array} rows
   * @param {{ key: string, dir: 'asc'|'desc' }} state
   * @param {Object<string, { type: 'number'|'string', val: function(any): *, tiebreak?: function(any,any): number }>} spec
   */
  function sortRows(rows, state, spec) {
    var s = spec[state.key];
    if (!s) return rows.slice();
    var asc = state.dir === 'asc';
    return rows.slice().sort(function (A, B) {
      var va = s.val(A);
      var vb = s.val(B);
      var c;
      if (s.type === 'string') {
        c = String(va || '').localeCompare(String(vb || ''), undefined, { sensitivity: 'base', numeric: true });
      } else {
        c = cmpNum(va, vb);
      }
      if (c !== 0) return asc ? c : -c;
      if (s.tiebreak) {
        var t = s.tiebreak(A, B);
        if (t !== 0) return t;
      }
      return 0;
    });
  }

  /**
   * @param {HTMLTableElement} table
   * @param {{ state: {key:string,dir:string}, spec: Object, onChange: function() }} options
   */
  function bindSortableTable(table, options) {
    var state = options.state;
    var spec = options.spec;
    var onChange = options.onChange;

    function updateHeaderClasses() {
      table.querySelectorAll('thead th[data-sort-key]').forEach(function (th) {
        var k = th.getAttribute('data-sort-key');
        var active = k === state.key;
        th.classList.toggle('th-sortable-active', active);
        th.classList.toggle('th-sort-asc', active && state.dir === 'asc');
        th.classList.toggle('th-sort-desc', active && state.dir === 'desc');
        th.setAttribute('aria-sort', active ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none');
      });
    }

    function activate(k) {
      var def = 'desc';
      var th = table.querySelector('thead th[data-sort-key="' + k + '"]');
      if (th) def = th.getAttribute('data-sort-default') || 'desc';
      if (state.key === k) {
        state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.key = k;
        state.dir = def;
      }
      updateHeaderClasses();
      onChange();
    }

    table.querySelectorAll('thead th[data-sort-key]').forEach(function (th) {
      th.classList.add('th-sortable');
      var k = th.getAttribute('data-sort-key');
      th.setAttribute('tabindex', '0');
      th.setAttribute('role', 'columnheader');
      th.addEventListener('click', function () {
        activate(k);
      });
      th.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate(k);
        }
      });
    });

    updateHeaderClasses();
    return { updateHeaderClasses: updateHeaderClasses, activate: activate };
  }

  var ENGLISH_LANG_KEYS = {
    english: true,
    'american english': true,
    'british english': true,
  };

  /** Original-language label for filtering (matches table sort column). */
  function languageKey(item) {
    if (!item) return '';
    var k = String(item.languageLabel || item.languageHint || '').trim();
    if (k && ENGLISH_LANG_KEYS[k.toLowerCase()]) return '';
    return k;
  }

  function escapeHtmlText(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeHtmlAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  /**
   * Renders a language cell: em dash if empty; muted pill for English; accent pill for other languages.
   * @param {string} [raw]
   * @param {string} [title]
   */
  function languagePillHtml(raw, title) {
    var t = raw != null ? String(raw).trim() : '';
    if (!t) return '—';
    var english = t.toLowerCase() === 'english';
    var cls = english ? 'lang-pill lang-pill--en-label' : 'lang-pill lang-pill--intl';
    var titleAttr = '';
    if (title) titleAttr = ' title="' + escapeHtmlAttr(title) + '"';
    else if (!english) titleAttr = ' title="Original filming language when known"';
    return '<span class="' + cls + '"' + titleAttr + '>' + escapeHtmlText(t) + '</span>';
  }

  /**
   * First option must be `<option value="">All languages</option>`.
   * Adds "Not listed" (__none__) when any row has an empty key.
   * Language names are always appended in **alphabetical** order (see
   * `.cursor/rules/sorted-lists.mdc` — dropdowns are never score-sorted).
   */
  function fillLanguageFilterOptions(selectEl, items) {
    if (!selectEl || !items || !items.length) return;
    var keys = [];
    var anyEmpty = false;
    for (var i = 0; i < items.length; i++) {
      var k = languageKey(items[i]);
      if (k) keys.push(k);
      else anyEmpty = true;
    }
    var seen = {};
    var uniq = [];
    for (var j = 0; j < keys.length; j++) {
      if (!seen[keys[j]]) {
        seen[keys[j]] = true;
        uniq.push(keys[j]);
      }
    }
    uniq.sort(function (a, b) {
      return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
    });
    while (selectEl.options.length > 1) {
      selectEl.remove(1);
    }
    if (anyEmpty) {
      var o0 = document.createElement('option');
      o0.value = '__none__';
      o0.textContent = 'Not listed';
      selectEl.appendChild(o0);
    }
    for (var u = 0; u < uniq.length; u++) {
      var o = document.createElement('option');
      o.value = uniq[u];
      o.textContent = uniq[u];
      selectEl.appendChild(o);
    }
  }

  /* Shared row helpers — single source; consumed by home.js, watchlist-page.js,
     genres-panel.js, and the browse inline controller. */

  function votesN(i) {
    var v = i.votes;
    if (v == null || v === '') return 0;
    return Number(v);
  }

  function formatBadge(type) {
    if (type === 'Movie') return '<span class="format-badge film">Film</span>';
    if (type === 'TV Series') return '<span class="format-badge series">Series</span>';
    if (type === 'TV Mini Series') return '<span class="format-badge mini">Miniseries</span>';
    if (type && type.indexOf('Documentary') !== -1) return '<span class="format-badge doc">Doc</span>';
    return '<span class="format-badge">' + (type || '—') + '</span>';
  }

  function imdbGenreUrl(g) {
    return (
      'https://www.imdb.com/search/title/?genres=' +
      encodeURIComponent(g.toLowerCase().replace(/ /g, '-'))
    );
  }

  function tieTitle(a, b) {
    return String(a.title || '').localeCompare(String(b.title || ''), undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  }

  global.silverScoreTableSort = {
    sortRows: sortRows,
    bindSortableTable: bindSortableTable,
    languageKey: languageKey,
    fillLanguageFilterOptions: fillLanguageFilterOptions,
    languagePillHtml: languagePillHtml,
    escapeHtmlText: escapeHtmlText,
    escapeHtmlAttr: escapeHtmlAttr,
    votesN: votesN,
    formatBadge: formatBadge,
    imdbGenreUrl: imdbGenreUrl,
    tieTitle: tieTitle,
  };
})(typeof window !== 'undefined' ? window : globalThis);
