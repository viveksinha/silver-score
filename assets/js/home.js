/**
 * Silver Score home — expects DATA, silverScoreTableSort, createSilverScoreInfiniteScroll (load data.js, table-sort, infinite-scroll before this file).
 */
(function (global) {
  'use strict';

  /* const DATA from data.js is a global binding, not window.DATA — read identifier or window after build */
  var data = typeof DATA !== 'undefined' ? DATA : global.DATA;
  var S = global.silverScoreTableSort;
  var RT = global.silverScoreRt;
  if (!data || !S) {
    console.error('home.js: load data.js, table-sort.js, and infinite-scroll.js first.');
    return;
  }
  if (!RT) {
    RT = {
      cellHtml: function () {
        return '—';
      },
    };
  }

  function votesN(i) {
    var v = i.votes;
    if (v == null || v === '') return 0;
    return Number(v);
  }

  function displayLang(i) {
    var L = i.languageLabel != null ? i.languageLabel : i.languageHint;
    if (L == null || L === '') return '';
    if (String(L).toLowerCase() === 'english') return '';
    return String(L);
  }

  function escapeHtmlText(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** IMDb language when known; otherwise a neutral fallback for clearly international rows. */
  function languageLabelOrInternational(i) {
    var k = S.languageKey(i);
    if (k && String(k).toLowerCase() !== 'english') return k;
    return 'International';
  }

  function itemDirectors(i) {
    var d = i.directors;
    if (d == null || d === '') return [];
    if (Array.isArray(d)) return d;
    if (typeof d === 'string') {
      return d.split(',').map(function (s) {
        return s.trim();
      }).filter(Boolean);
    }
    return [];
  }

  function imdbGenreUrl(g) {
    return (
      'https://www.imdb.com/search/title/?genres=' +
      encodeURIComponent(g.toLowerCase().replace(/ /g, '-'))
    );
  }
  function imdbPersonUrl(n) {
    return 'https://www.imdb.com/find/?q=' + encodeURIComponent(n) + '&s=nm';
  }

  function formatBadge(type) {
    if (type === 'Movie') return '<span class="format-badge film">Film</span>';
    if (type === 'TV Series') return '<span class="format-badge series">Series</span>';
    if (type === 'TV Mini Series') return '<span class="format-badge mini">Miniseries</span>';
    return '<span class="format-badge">' + (type || '—') + '</span>';
  }

  function directorVibeScore(d) {
    var starTier = d.avg >= 9 ? 3 : d.avg >= 8.5 ? 2 : d.avg >= 8 ? 1 : 0;
    return d.avg * 2.2 + d.count * 0.18 + starTier * 2.8;
  }

  function directorVibeStars(d) {
    if (d.avg >= 9) return '&#9733;&#9733;&#9733;';
    if (d.avg >= 8.5) return '&#9733;&#9733;';
    if (d.avg >= 8) return '&#9733;';
    return '';
  }

  var pitchEl = document.getElementById('hero-pitch');
  if (pitchEl) {
    pitchEl.innerHTML =
      '~<strong class="pitch-stat">8,500+</strong> hours across <strong class="pitch-stat">1,000+</strong> titles on IMDb. We keep coming back to <strong class="pitch-stat">tension, craft, and stories that don’t talk down</strong>. Start below — or jump to <a href="pages/read.html#curated-lists">lists</a>, <a href="pages/hidden-gems.html">under-voted gems</a>, or the <a href="pages/browse.html">full list</a>.';
  }

  function daysSinceRated(iso) {
    if (!iso) return 99999;
    var t = new Date(iso + (iso.length <= 10 ? 'T12:00:00' : '')).getTime();
    if (isNaN(t)) return 99999;
    return (Date.now() - t) / (1000 * 60 * 60 * 24);
  }

  function formatRatedOn(iso) {
    if (!iso) return '—';
    var pad = iso.length <= 10 ? 'T12:00:00' : '';
    var d = new Date(iso + pad);
    if (isNaN(d.getTime())) return iso;
    try {
      if (iso.length > 10) {
        return new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(d);
      }
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
    } catch (e) {
      return iso;
    }
  }

  function relativeRated(iso) {
    var days = daysSinceRated(iso);
    if (days >= 99998) return '';
    if (days < 1) return 'Recently';
    if (days < 7) return 'This week';
    if (days < 30) return 'This month';
    if (days < 365) return 'This year';
    return '';
  }

  function isLikelyNonEnglish(i) {
    var o = (i.originalTitle || '').trim();
    var t = (i.title || '').trim();
    if (o && t && o.toLowerCase() !== t.toLowerCase()) return true;
    if (!/^[\x00-\x7F]+$/.test(o || t || '')) return true;
    return false;
  }

  function isEnglishPrimary(i) {
    var k = S.languageKey(i);
    if (k && String(k).toLowerCase() === 'english') return true;
    if (!k && !isLikelyNonEnglish(i)) return true;
    return false;
  }

  function releaseYearNum(i) {
    var y = i.year;
    if (y == null || y === '') return NaN;
    return Number(y);
  }

  var CURRENT_YEAR = new Date().getFullYear();
  var NEW_RELEASE_MIN_YEAR = CURRENT_YEAR - 3;

  function isRecentEnglishRelease(i) {
    if (!i.dateRated) return false;
    if (!isEnglishPrimary(i)) return false;
    var y = releaseYearNum(i);
    if (isNaN(y) || y < NEW_RELEASE_MIN_YEAR) return false;
    return true;
  }

  function isNonEnglishTv(i) {
    if (!i.dateRated) return false;
    var t = i.type || '';
    if (t.indexOf('TV') < 0) return false;
    return !isEnglishPrimary(i);
  }

  function byDateRatedDesc(a, b) {
    return (b.dateRated || '').localeCompare(a.dateRated || '');
  }

  function pickRailBadge(i) {
    if (isNonEnglishTv(i)) {
      var label = languageLabelOrInternational(i);
      return (
        '<span class="pick-pill pick-pill--lang">' + escapeHtmlText(label) + ' · series</span>'
      );
    }
    return '<span class="pick-pill pick-pill--en">English · new release</span>';
  }

  function worldPickBadge(i) {
    if (isEnglishPrimary(i)) {
      return '<span class="pick-pill pick-pill--en">English · world</span>';
    }
    return (
      '<span class="pick-pill pick-pill--lang">' +
      escapeHtmlText(languageLabelOrInternational(i)) +
      ' · world</span>'
    );
  }

  var RAIL_MAX_STANDARD = 12;

  var meaningful = data.genreStats
    .filter(function (g) {
      return g.count >= 15;
    })
    .sort(function (a, b) {
      return b.avgMyRating - a.avgMyRating;
    });
  var topGenre = meaningful[0];
  var crime = data.genreStats.find(function (g) {
    return g.genre === 'Crime';
  });
  var thriller = data.genreStats.find(function (g) {
    return g.genre === 'Thriller';
  });
  var tens = data.allItems.filter(function (i) {
    return i.myRating === 10;
  }).length;

  var ctv = crime && thriller ? crime.avgMyRating - thriller.avgMyRating : 0;
  var lean = ctv > 0 ? 'Crime' : ctv < 0 ? 'Thriller' : 'Balanced';
  var crimeThrillerLabel = '—';
  if (crime && thriller) {
    if (ctv === 0) {
      crimeThrillerLabel =
        'Crime avg ' +
        crime.avgMyRating +
        ' · Thriller avg ' +
        thriller.avgMyRating +
        ' — evenly matched';
    } else {
      crimeThrillerLabel =
        'Crime avg ' +
        crime.avgMyRating +
        ' · Thriller avg ' +
        thriller.avgMyRating +
        ' — a nudge toward <strong>' +
        lean +
        '</strong>';
    }
  }
  document.getElementById('insight-strip').innerHTML =
    '<div class="insight-card"><div class="insight-stat">' +
    (topGenre ? topGenre.genre : '—') +
    '</div><div class="insight-label">Genre we rate highest (only counting types with 15+ titles): ' +
    (topGenre ? topGenre.avgMyRating : '') +
    '</div></div>' +
    '<div class="insight-card"><div class="insight-stat">' +
    (crime && thriller ? Math.abs(ctv).toFixed(2) : '—') +
    '</div><div class="insight-label">' +
    crimeThrillerLabel +
    '</div></div>' +
    '<div class="insight-card"><div class="insight-stat">' +
    tens +
    '</div><div class="insight-label">Perfect 10s we’d still defend tomorrow</div></div>';

  var tensBase = data.topRated.filter(function (i) {
    return i.myRating === 10;
  });
  var radarFullPool = data.allItems
    .filter(function (i) {
      return i.myRating >= 8 && (i.votes || 0) < 50000;
    })
    .sort(function (a, b) {
      return b.myRating - a.myRating || (a.votes || 0) - (b.votes || 0);
    });

  var radarMode = 'recent';

  function renderRadarTeaser() {
    var rail = document.getElementById('radar-teaser');
    if (!rail) return;
    var pool;
    if (radarMode === 'recent') {
      pool = radarFullPool.filter(function (i) {
        return daysSinceRated(i.dateRated) <= 540;
      });
      if (pool.length < RAIL_MAX_STANDARD) pool = radarFullPool.slice();
    } else {
      pool = radarFullPool;
    }
    if (!pool.length) {
      rail.innerHTML =
        '<li class="featured-rail-item featured-rail-item--empty"><p class="section-lede" style="margin:0;color:var(--text-secondary)">No titles match the under-the-radar filters right now.</p></li>';
      return;
    }
    rail.innerHTML = pool
      .slice(0, RAIL_MAX_STANDARD)
      .map(function (i) {
        var langBit = S.languageKey(i) ? ' · ' + S.languagePillHtml(S.languageKey(i)) : '';
        var rel = relativeRated(i.dateRated);
        return (
          '<li class="featured-rail-item">' +
          '<a class="featured-card featured-card--lift" href="' +
          i.url +
          '" target="_blank" rel="noopener noreferrer">' +
          '<span class="pick-pill pick-pill--radar">Under-voted</span>' +
          '<span class="meta-line">' +
          i.year +
          ' · ' +
          (i.votes || 0).toLocaleString() +
          ' votes · Our ' +
          i.myRating +
          ' · IMDb ' +
          i.imdbRating +
          langBit +
          (i.dateRated
            ? ' · <time datetime="' + i.dateRated + '">' + formatRatedOn(i.dateRated) + '</time>'
            : '') +
          (rel ? ' · ' + rel : '') +
          '</span>' +
          '<h3>' +
          i.title +
          '</h3>' +
          '<p class="why">We gave it ' +
          i.myRating +
          '/10 while the crowd sits at ' +
          i.imdbRating +
          '.</p>' +
          '<span class="cta">IMDb</span>' +
          '</a></li>'
        );
      })
      .join('');
  }

  function renderWorldPicksRail() {
    var rail = document.getElementById('world-picks');
    if (!rail) return;
    var pool = data.allItems
      .filter(isLikelyNonEnglish)
      .sort(function (a, b) {
        return (
          b.myRating - a.myRating ||
          b.imdbRating - a.imdbRating ||
          (b.dateRated || '').localeCompare(a.dateRated || '')
        );
      });
    if (!pool.length) {
      rail.innerHTML =
        '<li class="featured-rail-item featured-rail-item--empty"><p class="section-lede" style="margin:0;color:var(--text-secondary)">No international-style listings in the dataset yet.</p></li>';
      return;
    }
    rail.innerHTML = pool
      .slice(0, RAIL_MAX_STANDARD)
      .map(function (i) {
        var orig =
          i.originalTitle && i.originalTitle.toLowerCase() !== (i.title || '').toLowerCase()
            ? '<p class="why"><span class="lang-pill lang-pill--meta">Original title</span> ' +
              escapeHtmlText(i.originalTitle) +
              '</p>'
            : '';
        var g = (i.genres || []).slice(0, 2).join(' · ');
        var rel = relativeRated(i.dateRated);
        return (
          '<li class="featured-rail-item">' +
          '<a class="featured-card featured-card--lift" href="' +
          i.url +
          '" target="_blank" rel="noopener noreferrer">' +
          worldPickBadge(i) +
          '<span class="meta-line">' +
          i.year +
          ' · Our ' +
          i.myRating +
          ' · IMDb ' +
          i.imdbRating +
          (i.dateRated
            ? ' · <time datetime="' + i.dateRated + '">' + formatRatedOn(i.dateRated) + '</time>'
            : '') +
          (rel ? ' · ' + rel : '') +
          '</span>' +
          '<h3>' +
          i.title +
          '</h3>' +
          orig +
          '<p class="why" style="margin-top:0.35rem">' +
          (g || '') +
          '</p>' +
          '<span class="cta">IMDb</span>' +
          '</a></li>'
        );
      })
      .join('');
  }

  function renderFreshShelfRail() {
    var MAX_TOTAL = 12;
    var SLOT_EN = 6;
    var SLOT_NE_TV = 6;
    var rail = document.getElementById('featured-picks');
    if (!rail) return;

    var enPool = data.allItems.filter(isRecentEnglishRelease).sort(byDateRatedDesc);
    var nePool = data.allItems.filter(isNonEnglishTv).sort(byDateRatedDesc);
    var seen = {};
    function dedupeKey(i) {
      return i.url || String(i.title || '') + '|' + String(i.year || '');
    }
    var out = [];
    function pushFrom(pool, maxAdd) {
      var added = 0;
      for (var j = 0; j < pool.length && out.length < MAX_TOTAL && added < maxAdd; j++) {
        var k = dedupeKey(pool[j]);
        if (seen[k]) continue;
        seen[k] = true;
        out.push(pool[j]);
        added++;
      }
    }
    pushFrom(enPool, SLOT_EN);
    pushFrom(nePool, SLOT_NE_TV);
    while (out.length < 10 && out.length < MAX_TOTAL) {
      var n = out.length;
      pushFrom(enPool, MAX_TOTAL - out.length);
      if (out.length === n) pushFrom(nePool, MAX_TOTAL - out.length);
      if (out.length === n) break;
    }
    out.sort(byDateRatedDesc);

    if (!out.length) {
      rail.innerHTML =
        '<li class="featured-rail-item featured-rail-item--empty"><p class="section-lede" style="margin:0;color:var(--text-secondary)">Nothing in this rail yet — titles need a rated date plus a recent release year (English) or an international TV row.</p></li>';
      return;
    }

    rail.innerHTML = out
      .map(function (i) {
        var g = (i.genres || []).slice(0, 2).join(' · ');
        var rel = relativeRated(i.dateRated);
        return (
          '<li class="featured-rail-item">' +
          '<a class="featured-card featured-card--lift" href="' +
          i.url +
          '" target="_blank" rel="noopener noreferrer">' +
          pickRailBadge(i) +
          '<span class="meta-line">' +
          i.year +
          ' · IMDb ' +
          i.imdbRating +
          (i.dateRated ? ' · <time datetime="' + i.dateRated + '">' + formatRatedOn(i.dateRated) + '</time>' : '') +
          (rel ? ' · ' + rel : '') +
          '</span>' +
          '<h3>' +
          i.title +
          '</h3>' +
          '<p class="why">' +
          (g || 'Genre mix on IMDb') +
          '</p>' +
          '<span class="cta">IMDb</span>' +
          '</a></li>'
        );
      })
      .join('');
  }

  function wireSegmented(groupId, attrName, callback) {
    var root = document.getElementById(groupId);
    if (!root) return;
    root.querySelectorAll('button[data-' + attrName + ']').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-' + attrName);
        root.querySelectorAll('button[data-' + attrName + ']').forEach(function (b) {
          b.classList.toggle('seg-btn--active', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        if (attrName === 'radar-mode') radarMode = v;
        callback();
      });
    });
  }

  renderFreshShelfRail();
  renderRadarTeaser();
  wireSegmented('radar-seg', 'radar-mode', renderRadarTeaser);
  renderWorldPicksRail();

  var recentSeen = data.allItems
    .filter(function (i) {
      return i.dateRated;
    })
    .sort(function (a, b) {
      return (b.dateRated || '').localeCompare(a.dateRated || '');
    })
    .slice(0, 15);

  var recentLangEl = document.getElementById('recent-lang-filter');
  if (recentLangEl && S.fillLanguageFilterOptions) {
    S.fillLanguageFilterOptions(recentLangEl, recentSeen);
  }
  function recentRowsFiltered() {
    var lf = recentLangEl ? recentLangEl.value : '';
    return recentSeen.filter(function (i) {
      var k = S.languageKey(i);
      if (lf === '__none__') return !k;
      if (lf) return k === lf;
      return true;
    });
  }
  function renderRecentTable() {
    document.getElementById('recent-table-body').innerHTML = recentRowsFiltered()
      .map(function (i) {
        var rowLang = displayLang(i);
        var rel = relativeRated(i.dateRated);
        var genres = (i.genres || [])
          .map(function (g) {
            return (
              '<a href="' +
              imdbGenreUrl(g) +
              '" target="_blank" rel="noopener noreferrer" class="recent-meta-link">' +
              g +
              '</a>'
            );
          })
          .join(', ');
        return (
          '<tr>' +
          '<td><time class="recent-time" datetime="' +
          i.dateRated +
          '">' +
          formatRatedOn(i.dateRated) +
          '</time>' +
          (rel ? ' <span class="recent-rel">' + rel + '</span>' : '') +
          '</td>' +
          '<td><a href="' +
          i.url +
          '" target="_blank" rel="noopener noreferrer"><strong>' +
          i.title +
          '</strong></a></td>' +
          '<td class="recent-lang">' +
          (rowLang
            ? S.languagePillHtml(rowLang, 'Original filming language when known')
            : '<span class="recent-muted">—</span>') +
          '</td>' +
          '<td>' +
          i.year +
          '</td>' +
          '<td>' +
          formatBadge(i.type) +
          '</td>' +
          '<td><span class="rating-badge rating-' +
          (i.myRating >= 10 ? '10' : i.myRating >= 9 ? '9' : i.myRating >= 8 ? '8' : '7') +
          '">' +
          i.myRating +
          '</span></td>' +
          '<td><span class="imdb-badge">' +
          i.imdbRating +
          '</span></td>' +
          '<td class="recent-mono">' +
          votesN(i).toLocaleString() +
          '</td>' +
          '<td class="rt-cell">' +
          RT.cellHtml(i) +
          '</td>' +
          '<td class="recent-genres">' +
          genres +
          '</td>' +
          '</tr>'
        );
      })
      .join('');
  }
  if (recentLangEl) recentLangEl.addEventListener('change', renderRecentTable);
  renderRecentTable();

  var grid = document.getElementById('stats-grid');
  var tvCount = data.allItems.filter(function (i) {
    return i.type.includes('TV');
  }).length;
  var movieCount = data.allItems.filter(function (i) {
    return i.type === 'Movie';
  }).length;
  var nonEnCount = data.allItems.filter(function (i) {
    return displayLang(i) || isLikelyNonEnglish(i);
  }).length;

  var estHours = data.estimatedWatchHours;
  var hoursLabel = estHours && estHours > 0
    ? '~' + Number(estHours).toLocaleString()
    : '~8,500+';
  var statCards = [
    { value: hoursLabel, label: 'Est. watch hours', icon: '⏱', mod: 'stat-card--a stat-card--hours' },
    { value: '1,000+', label: 'Titles rated', icon: '◆', mod: 'stat-card--b' },
    { value: movieCount, label: 'Films', icon: '▣', mod: 'stat-card--c' },
    { value: tvCount, label: 'Series & minis', icon: '▤', mod: 'stat-card--d' },
    { value: data.avgRating.toFixed(1), label: 'Our average', icon: '★', mod: 'stat-card--e' },
    { value: tens, label: 'Perfect 10s', icon: '✦', mod: 'stat-card--f' },
    { value: nonEnCount, label: 'Non-English lean', icon: '⌁', mod: 'stat-card--g' },
    { value: data.genreStats.length, label: 'Genre tags', icon: '※', mod: 'stat-card--h' },
  ];
  grid.innerHTML = statCards
    .map(function (s) {
      var tip = s.tip ? ' title="' + s.tip.replace(/"/g, '&quot;') + '"' : '';
      return (
        '<div class="stat-card ' +
        s.mod +
        '"' +
        tip +
        '><span class="stat-icon" aria-hidden="true">' +
        s.icon +
        '</span><div class="stat-value">' +
        s.value +
        '</div><div class="stat-label">' +
        s.label +
        '</div></div>'
      );
    })
    .join('');

  var maxCount = Math.max.apply(
    null,
    data.ratingDistribution.map(function (r) {
      return r.count;
    })
  );
  document.getElementById('rating-chart').innerHTML = data.ratingDistribution
    .map(function (r) {
      var pct = ((r.count / maxCount) * 100).toFixed(1);
      var cls = r.rating >= 9 ? 'green' : r.rating >= 7 ? '' : r.rating >= 5 ? 'orange' : 'red';
      return (
        '<div class="bar-row">' +
        '<div class="bar-label">' +
        r.rating +
        '/10</div>' +
        '<div class="bar-track"><div class="bar-fill ' +
        cls +
        '" style="width:' +
        pct +
        '%"></div></div>' +
        '<div class="bar-count">' +
        r.count +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  var maxDec = Math.max.apply(
    null,
    data.decadeStats.map(function (d) {
      return d.count;
    })
  );
  document.getElementById('decade-chart').innerHTML = data.decadeStats
    .map(function (d) {
      var pct = ((d.count / maxDec) * 100).toFixed(1);
      return (
        '<div class="bar-row">' +
        '<div class="bar-label">' +
        d.decade +
        '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' +
        pct +
        '%"></div></div>' +
        '<div class="bar-count">' +
        d.count +
        ' <span class="bar-avg">(' +
        d.avg +
        ')</span></div>' +
        '</div>'
      );
    })
    .join('');

  var PAGE_SIZE = 10;
  var tieTitle = function (a, b) {
    return String(a.title || '').localeCompare(String(b.title || ''), undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  };
  var tieName = function (a, b) {
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  };

  var directorStats = data.directorStats;
  var directorsLangEl = document.getElementById('directors-lang-filter');
  if (directorsLangEl && S.fillLanguageFilterOptions) {
    S.fillLanguageFilterOptions(directorsLangEl, data.allItems);
  }
  function directorsRowsFiltered() {
    var lf = directorsLangEl ? directorsLangEl.value : '';
    if (!lf) return directorStats;
    return directorStats.filter(function (d) {
      return data.allItems.some(function (i) {
        if (itemDirectors(i).indexOf(d.name) < 0) return false;
        var k = S.languageKey(i);
        if (lf === '__none__') return !k;
        return k === lf;
      });
    });
  }
  var sortStateDirectors = { key: 'vibe', dir: 'desc' };
  var specDirectors = {
    name: { type: 'string', val: function (d) {
      return d.name;
    } },
    count: {
      type: 'number',
      val: function (d) {
        return d.count;
      },
      tiebreak: tieName,
    },
    avg: {
      type: 'number',
      val: function (d) {
        return d.avg;
      },
      tiebreak: tieName,
    },
    vibe: {
      type: 'number',
      val: function (d) {
        return directorVibeScore(d);
      },
      tiebreak: tieName,
    },
  };

  var directorsTable = document.getElementById('directors-table');
  var dtb = document.querySelector('#directors-table tbody');
  var dirScroll = null;
  function mountDirectors() {
    if (dirScroll) dirScroll.teardown();
    dirScroll = global.createSilverScoreInfiniteScroll({
      getItems: function () {
        return S.sortRows(directorsRowsFiltered(), sortStateDirectors, specDirectors);
      },
      pageSize: PAGE_SIZE,
      anchorAfter: directorsTable,
      root: directorsTable.closest('.table-scroll'),
      render: function (rows, ctx) {
        var append = ctx.append;
        var startIndex = ctx.startIndex;
        var html = rows
          .map(function (d, i) {
            var offset = startIndex + i;
            var vs = directorVibeScore(d).toFixed(2);
            return (
              '<tr>' +
              '<td>' +
              (offset + 1) +
              '</td>' +
              '<td><a href="' +
              imdbPersonUrl(d.name) +
              '" target="_blank" rel="noopener noreferrer"><strong>' +
              d.name +
              '</strong></a></td>' +
              '<td>' +
              d.count +
              '</td>' +
              '<td><span class="rating-badge ' +
              (d.avg >= 9 ? 'rating-10' : d.avg >= 8 ? 'rating-9' : 'rating-8') +
              '">' +
              d.avg +
              '</span></td>' +
              '<td title="Our average, number of titles, and star level combined"><span class="vibe-stars">' +
              directorVibeStars(d) +
              '</span> <span class="vibe-num">' +
              vs +
              '</span></td>' +
              '</tr>'
            );
          })
          .join('');
        if (append) dtb.insertAdjacentHTML('beforeend', html);
        else dtb.innerHTML = html;
      },
    });
    dirScroll.reset();
  }
  S.bindSortableTable(directorsTable, {
    state: sortStateDirectors,
    spec: specDirectors,
    onChange: mountDirectors,
  });
  if (directorsLangEl) directorsLangEl.addEventListener('change', mountDirectors);
  mountDirectors();

  var loved = data.lovedMore;
  var lovedLangEl = document.getElementById('loved-lang-filter');
  if (lovedLangEl && S.fillLanguageFilterOptions) {
    S.fillLanguageFilterOptions(lovedLangEl, loved);
  }
  function lovedRowsFiltered() {
    var lf = lovedLangEl ? lovedLangEl.value : '';
    if (!lf) return loved;
    return loved.filter(function (i) {
      var k = S.languageKey(i);
      if (lf === '__none__') return !k;
      return k === lf;
    });
  }
  var sortStateLoved = { key: 'gap', dir: 'desc' };
  var specLoved = {
    title: { type: 'string', val: function (i) {
      return i.title;
    } },
    year: {
      type: 'number',
      val: function (i) {
        return i.year;
      },
      tiebreak: tieTitle,
    },
    myRating: {
      type: 'number',
      val: function (i) {
        return i.myRating;
      },
      tiebreak: tieTitle,
    },
    imdbRating: {
      type: 'number',
      val: function (i) {
        return i.imdbRating;
      },
      tiebreak: tieTitle,
    },
    votes: {
      type: 'number',
      val: votesN,
      tiebreak: tieTitle,
    },
    gap: {
      type: 'number',
      val: function (i) {
        return i.gap;
      },
      tiebreak: tieTitle,
    },
  };

  var lovedTable = document.getElementById('loved-table');
  var ltb = document.querySelector('#loved-table tbody');
  var lovedScroll = null;
  function mountLoved() {
    if (lovedScroll) lovedScroll.teardown();
    lovedScroll = global.createSilverScoreInfiniteScroll({
      getItems: function () {
        return S.sortRows(lovedRowsFiltered(), sortStateLoved, specLoved);
      },
      pageSize: PAGE_SIZE,
      anchorAfter: lovedTable,
      root: lovedTable.closest('.table-scroll'),
      render: function (rows, ctx) {
        var append = ctx.append;
        var html = rows
          .map(function (i) {
            return (
              '<tr>' +
              '<td><a href="' +
              i.url +
              '" target="_blank" rel="noopener noreferrer">' +
              i.title +
              '</a></td>' +
              '<td>' +
              i.year +
              '</td>' +
              '<td><span class="rating-badge rating-' +
              (i.myRating >= 10 ? '10' : i.myRating >= 9 ? '9' : '8') +
              '">' +
              i.myRating +
              '</span></td>' +
              '<td><span class="imdb-badge">' +
              i.imdbRating +
              '</span></td>' +
              '<td style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text-secondary)">' +
              votesN(i).toLocaleString() +
              '</td>' +
              '<td class="rt-cell">' +
              RT.cellHtml(i) +
              '</td>' +
              '<td style="color:var(--green);font-weight:700">+' +
              i.gap +
              '</td>' +
              '</tr>'
            );
          })
          .join('');
        if (append) ltb.insertAdjacentHTML('beforeend', html);
        else ltb.innerHTML = html;
      },
    });
    lovedScroll.reset();
  }
  S.bindSortableTable(lovedTable, {
    state: sortStateLoved,
    spec: specLoved,
    onChange: mountLoved,
  });
  if (lovedLangEl) lovedLangEl.addEventListener('change', mountLoved);
  mountLoved();

  var topLangEl = document.getElementById('top-lang-filter');
  if (topLangEl && S.fillLanguageFilterOptions) {
    S.fillLanguageFilterOptions(topLangEl, tensBase);
  }
  function topRowsFiltered() {
    var lf = topLangEl ? topLangEl.value : '';
    if (!lf) return tensBase;
    return tensBase.filter(function (i) {
      var k = S.languageKey(i);
      if (lf === '__none__') return !k;
      return k === lf;
    });
  }
  var sortStateTop = { key: 'imdbRating', dir: 'desc' };
  var specTop = {
    title: { type: 'string', val: function (i) {
      return i.title;
    } },
    year: {
      type: 'number',
      val: function (i) {
        return i.year;
      },
      tiebreak: tieTitle,
    },
    type: { type: 'string', val: function (i) {
      return i.type;
    } },
    imdbRating: {
      type: 'number',
      val: function (i) {
        return i.imdbRating;
      },
      tiebreak: tieTitle,
    },
    votes: {
      type: 'number',
      val: votesN,
      tiebreak: tieTitle,
    },
    genres: {
      type: 'string',
      val: function (i) {
        return (i.genres || []).join(', ');
      },
      tiebreak: tieTitle,
    },
  };

  var topTable = document.getElementById('top-table');
  var ttb = document.querySelector('#top-table tbody');
  var topScroll = null;
  function mountTop() {
    if (topScroll) topScroll.teardown();
    topScroll = global.createSilverScoreInfiniteScroll({
      getItems: function () {
        return S.sortRows(topRowsFiltered(), sortStateTop, specTop);
      },
      pageSize: PAGE_SIZE,
      anchorAfter: topTable,
      root: topTable.closest('.table-scroll'),
      render: function (rows, ctx) {
        var append = ctx.append;
        var html = rows
          .map(function (i) {
            return (
              '<tr>' +
              '<td><a href="' +
              i.url +
              '" target="_blank" rel="noopener noreferrer">' +
              i.title +
              '</a></td>' +
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
              '<td class="rt-cell">' +
              RT.cellHtml(i) +
              '</td>' +
              '<td style="font-size:0.8rem;color:var(--text-secondary)">' +
              i.genres
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
        if (append) ttb.insertAdjacentHTML('beforeend', html);
        else ttb.innerHTML = html;
      },
    });
    topScroll.reset();
  }
  S.bindSortableTable(topTable, {
    state: sortStateTop,
    spec: specTop,
    onChange: mountTop,
  });
  if (topLangEl) topLangEl.addEventListener('change', mountTop);
  mountTop();

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) e.target.classList.add('visible');
      });
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll('.fade-in').forEach(function (el) {
    observer.observe(el);
  });
})(typeof window !== 'undefined' ? window : globalThis);
