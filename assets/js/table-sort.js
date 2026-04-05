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

  /** Original-language label for filtering (matches table sort column). */
  function languageKey(item) {
    if (!item) return '';
    return String(item.languageLabel || item.languageHint || '').trim();
  }

  /**
   * First option must be `<option value="">All languages</option>`.
   * Adds "Not listed" (__none__) when any row has an empty key.
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

  global.silverScoreTableSort = {
    sortRows: sortRows,
    bindSortableTable: bindSortableTable,
    languageKey: languageKey,
    fillLanguageFilterOptions: fillLanguageFilterOptions,
  };
})(typeof window !== 'undefined' ? window : globalThis);
