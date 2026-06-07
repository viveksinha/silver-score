/**
 * Silver Score — IMDb watchlist table (watchlist.html).
 * Expects window.WATCHLIST from watchlist-data.js and silverScoreTableSort + infinite-scroll.
 */
(function () {
  'use strict';

  var S = window.silverScoreTableSort;
  var data = window.WATCHLIST;
  if (!S || !data || !Array.isArray(data.items)) {
    console.error('watchlist-page.js: load watchlist-data.js, table-sort.js, and infinite-scroll.js first.');
    return;
  }

  var allItems = data.items;
  var filtered = [];
  var PAGE_SIZE = 15;
  var scrollCtl = null;
  var tieTitle = function (a, b) {
    return String(a.title || '').localeCompare(String(b.title || ''), undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  };
  var sortState = { key: 'imdbRating', dir: 'desc' };

  function votesN(i) {
    var v = i.votes;
    if (v == null || v === '') return 0;
    return Number(v);
  }

  var sortSpec = {
    title: { type: 'string', val: function (i) { return i.title; } },
    language: {
      type: 'string',
      val: function (i) { return i.languageLabel || i.languageHint || ''; },
      tiebreak: tieTitle,
    },
    year: { type: 'number', val: function (i) { return i.year; }, tiebreak: tieTitle },
    type: { type: 'string', val: function (i) { return i.type; } },
    imdbRating: { type: 'number', val: function (i) { return i.imdbRating; }, tiebreak: tieTitle },
    votes: { type: 'number', val: votesN, tiebreak: tieTitle },
    genres: {
      type: 'string',
      val: function (i) { return (i.genres || []).join(', '); },
      tiebreak: tieTitle,
    },
  };

  var sortSelectMap = {
    imdbRating: { key: 'imdbRating', dir: 'desc' },
    imdbRatingLow: { key: 'imdbRating', dir: 'asc' },
    year: { key: 'year', dir: 'desc' },
    yearOld: { key: 'year', dir: 'asc' },
    titleAsc: { key: 'title', dir: 'asc' },
    titleDesc: { key: 'title', dir: 'desc' },
    votesDesc: { key: 'votes', dir: 'desc' },
    votesAsc: { key: 'votes', dir: 'asc' },
    genresAsc: { key: 'genres', dir: 'asc' },
    genresDesc: { key: 'genres', dir: 'desc' },
  };

  function formatBadge(type) {
    if (type === 'Movie') return '<span class="format-badge film">Film</span>';
    if (type === 'TV Series') return '<span class="format-badge series">Series</span>';
    if (type === 'TV Mini Series') return '<span class="format-badge mini">Miniseries</span>';
    return '<span class="format-badge">' + (type || '—') + '</span>';
  }

  function imdbGenreUrl(g) {
    return (
      'https://www.imdb.com/search/title/?genres=' +
      encodeURIComponent(g.toLowerCase().replace(/ /g, '-'))
    );
  }

  function decadeOf(year) {
    if (!year) return '';
    return String(Math.floor(year / 10) * 10) + 's';
  }

  var genreSet = new Set();
  allItems.forEach(function (i) {
    (i.genres || []).forEach(function (g) { genreSet.add(g); });
  });
  var gf = document.getElementById('genre-filter');
  Array.from(genreSet)
    .sort(function (a, b) {
      return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
    })
    .forEach(function (g) {
      var opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      gf.appendChild(opt);
    });

  var decadeSet = new Set();
  allItems.forEach(function (i) {
    var d = decadeOf(i.year);
    if (d) decadeSet.add(d);
  });
  var df = document.getElementById('decade-filter');
  Array.from(decadeSet)
    .sort()
    .forEach(function (d) {
      var opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      df.appendChild(opt);
    });

  S.fillLanguageFilterOptions(document.getElementById('language-filter'), allItems);

  var metaEl = document.getElementById('watchlist-meta');
  if (metaEl && data.meta) {
    var n = data.meta.totalUnrated != null ? data.meta.totalUnrated : allItems.length;
    metaEl.textContent =
      n === 1 ? '1 title on the shelf' : n + ' titles on the shelf — not yet rated by us';
  }

  function buildFiltered() {
    var search = document.getElementById('search').value.toLowerCase();
    var typeF = document.getElementById('type-filter').value;
    var genreF = document.getElementById('genre-filter').value;
    var decadeF = document.getElementById('decade-filter').value;
    var langF = document.getElementById('language-filter').value;
    var minImdb = document.getElementById('imdb-filter').value;

    filtered = allItems.filter(function (i) {
      if (search && !String(i.title || '').toLowerCase().includes(search)) return false;
      if (typeF && i.type !== typeF) return false;
      if (genreF && !(i.genres || []).includes(genreF)) return false;
      if (decadeF && decadeOf(i.year) !== decadeF) return false;
      var lk = S.languageKey(i);
      if (langF === '__none__') {
        if (lk) return false;
      } else if (langF && lk !== langF) return false;
      if (minImdb) {
        var r = parseFloat(minImdb, 10);
        if (i.imdbRating < r) return false;
      }
      return true;
    });
  }

  function stateToSelectValue(st) {
    for (var val in sortSelectMap) {
      if (!Object.prototype.hasOwnProperty.call(sortSelectMap, val)) continue;
      var m = sortSelectMap[val];
      if (m.key === st.key && m.dir === st.dir) return val;
    }
    return '__custom';
  }

  function applySortSelectToState() {
    var sortBy = document.getElementById('sort-by').value;
    if (sortBy === '__custom') return;
    var m = sortSelectMap[sortBy];
    if (m) {
      sortState.key = m.key;
      sortState.dir = m.dir;
    }
  }

  function refreshTable() {
    var table = document.getElementById('watchlist-table');
    var tbody = document.querySelector('#watchlist-table tbody');
    if (scrollCtl) scrollCtl.teardown();
    scrollCtl = createSilverScoreInfiniteScroll({
      getItems: function () { return S.sortRows(filtered, sortState, sortSpec); },
      pageSize: PAGE_SIZE,
      anchorAfter: table,
      root: table.closest('.table-scroll'),
      render: function (items, ctx) {
        var html = items
          .map(function (i) {
            var langRaw = i.languageLabel || i.languageHint;
            var lang = S.languagePillHtml(langRaw, 'Original language when listed');
            return (
              '<tr>' +
              '<td><a href="' +
              i.url +
              '" target="_blank" rel="noopener noreferrer">' +
              i.title +
              '</a></td>' +
              '<td style="font-size:0.75rem;max-width:7rem">' +
              lang +
              '</td>' +
              '<td>' +
              i.year +
              '</td>' +
              '<td>' +
              formatBadge(i.type) +
              '</td>' +
              '<td><span class="imdb-badge">' +
              i.imdbRating +
              '</span></td>' +
              '<td style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text-secondary)">' +
              votesN(i).toLocaleString() +
              '</td>' +
              '<td style="font-size:0.75rem;color:var(--text-secondary);max-width:200px">' +
              (i.genres || [])
                .map(function (g) {
                  return (
                    '<a href="' +
                    imdbGenreUrl(g) +
                    '" target="_blank" rel="noopener noreferrer" style="color:var(--text-secondary)">' +
                    g +
                    '</a>'
                  );
                })
                .join(', ') +
              '</td>' +
              '</tr>'
            );
          })
          .join('');
        if (ctx.append) tbody.insertAdjacentHTML('beforeend', html);
        else tbody.innerHTML = html;
        var n = tbody.querySelectorAll('tr').length;
        var total = filtered.length;
        document.getElementById('result-count').textContent =
          total === 0
            ? 'No titles match your filters'
            : n >= total
              ? 'Showing all ' + total + ' title' + (total === 1 ? '' : 's')
              : 'Showing ' + n + ' of ' + total + ' titles';
      },
    });
    scrollCtl.reset();
  }

  function applyFilters() {
    buildFiltered();
    applySortSelectToState();
    if (tableBinder) tableBinder.updateHeaderClasses();
    document.getElementById('sort-by').value = stateToSelectValue(sortState);
    refreshTable();
  }

  var tableEl = document.getElementById('watchlist-table');
  var tableBinder = S.bindSortableTable(tableEl, {
    state: sortState,
    spec: sortSpec,
    onChange: function () {
      document.getElementById('sort-by').value = stateToSelectValue(sortState);
      refreshTable();
    },
  });

  ['search', 'type-filter', 'genre-filter', 'decade-filter', 'language-filter', 'imdb-filter'].forEach(
    function (id) {
      var el = document.getElementById(id);
      el.addEventListener(id === 'search' ? 'input' : 'change', applyFilters);
    },
  );

  document.getElementById('sort-by').addEventListener('change', function () {
    applySortSelectToState();
    if (tableBinder) tableBinder.updateHeaderClasses();
    refreshTable();
  });

  applyFilters();
})();
