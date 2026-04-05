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
      '<strong class="pitch-stat">' +
      data.totalRatings.toLocaleString() +
      '</strong> IMDb ratings. One through line: tension, craft, and stories that don’t talk down. Start with picks below — or jump to <a href="pages/read.html#curated-lists">lists</a>, <a href="pages/hidden-gems.html">under-voted gems</a>, or the <a href="pages/browse.html">full archive</a>.';
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
  document.getElementById('insight-strip').innerHTML =
    '<div class="insight-card"><div class="insight-stat">' +
    (topGenre ? topGenre.genre : '—') +
    '</div><div class="insight-label">Top genre by our average (15+ titles seen): ' +
    (topGenre ? topGenre.avgMyRating : '') +
    '</div></div>' +
    '<div class="insight-card"><div class="insight-stat">' +
    (crime && thriller ? Math.abs(ctv).toFixed(2) : '—') +
    '</div><div class="insight-label">Points warmer toward <strong>' +
    lean +
    '</strong> vs the other — our avg Crime ' +
    (crime ? crime.avgMyRating : '—') +
    ' vs Thriller ' +
    (thriller ? thriller.avgMyRating : '—') +
    '</div></div>' +
    '<div class="insight-card"><div class="insight-stat">' +
    tens +
    '</div><div class="insight-label">Perfect 10s we’d still argue for after a second glass of wine</div></div>';

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

  var picksMode = 'recent';
  var radarMode = 'recent';

  function renderStaffPicks() {
    var list;
    if (picksMode === 'recent') {
      list = tensBase
        .slice()
        .sort(function (a, b) {
          return (b.dateRated || '').localeCompare(a.dateRated || '') || b.imdbRating - a.imdbRating;
        })
        .slice(0, 4);
    } else {
      list = tensBase
        .slice()
        .sort(function (a, b) {
          return b.imdbRating - a.imdbRating || b.year - a.year;
        })
        .slice(0, 4);
    }
    document.getElementById('featured-picks').innerHTML = list
      .map(function (i) {
        var g = i.genres.slice(0, 2).join(' · ');
        return (
          '<a class="featured-card featured-card--lift" href="' +
          i.url +
          '" target="_blank" rel="noopener noreferrer">' +
          '<span class="meta-line">' +
          i.year +
          ' · IMDb ' +
          i.imdbRating +
          (i.dateRated ? ' · <time datetime="' + i.dateRated + '">' + formatRatedOn(i.dateRated) + '</time>' : '') +
          '</span>' +
          '<h3>' +
          i.title +
          '</h3>' +
          '<p class="why">' +
          (g || 'Genre mix on IMDb') +
          '</p>' +
          '<span class="cta">Open on IMDb →</span>' +
          '</a>'
        );
      })
      .join('');
  }

  function renderRadarTeaser() {
    var pool;
    if (radarMode === 'recent') {
      pool = radarFullPool.filter(function (i) {
        return daysSinceRated(i.dateRated) <= 540;
      });
      if (pool.length < 4) pool = radarFullPool.slice();
    } else {
      pool = radarFullPool;
    }
    document.getElementById('radar-teaser').innerHTML = pool
      .slice(0, 4)
      .map(function (i) {
        return (
          '<a class="featured-card featured-card--lift" href="' +
          i.url +
          '" target="_blank" rel="noopener noreferrer">' +
          '<span class="meta-line">' +
          i.year +
          ' · ' +
          (i.votes || 0).toLocaleString() +
          ' votes' +
          (i.dateRated
            ? ' · <time datetime="' + i.dateRated + '">' + formatRatedOn(i.dateRated) + '</time>'
            : '') +
          '</span>' +
          '<h3>' +
          i.title +
          '</h3>' +
          '<p class="why">We gave it ' +
          i.myRating +
          '/10 while the crowd sits at ' +
          i.imdbRating +
          '.</p>' +
          '<span class="cta">IMDb →</span>' +
          '</a>'
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
        if (attrName === 'picks-mode') picksMode = v;
        if (attrName === 'radar-mode') radarMode = v;
        callback();
      });
    });
  }

  renderStaffPicks();
  renderRadarTeaser();
  wireSegmented('picks-seg', 'picks-mode', renderStaffPicks);
  wireSegmented('radar-seg', 'radar-mode', renderRadarTeaser);

  var nonEnPool = data.allItems.filter(isLikelyNonEnglish).sort(function (a, b) {
    return b.myRating - a.myRating || b.imdbRating - a.imdbRating;
  });
  document.getElementById('world-picks').innerHTML = nonEnPool
    .slice(0, 4)
    .map(function (i) {
      var lang = displayLang(i);
      var orig =
        i.originalTitle && i.originalTitle.toLowerCase() !== (i.title || '').toLowerCase()
          ? '<p class="why"><span class="lang-pill">Original title</span> ' +
            i.originalTitle +
            '</p>'
          : '<p class="why"><span class="lang-pill">International</span> Listed with a non-English primary title on IMDb.</p>';
      var g = (i.genres || []).slice(0, 2).join(' · ');
      return (
        '<a class="featured-card featured-card--lift" href="' +
        i.url +
        '" target="_blank" rel="noopener noreferrer">' +
        '<span class="meta-line">' +
        i.year +
        ' · Our ' +
        i.myRating +
        ' · IMDb ' +
        i.imdbRating +
        (lang ? ' · <span class="lang-pill">' + lang + '</span>' : '') +
        '</span>' +
        '<h3>' +
        i.title +
        '</h3>' +
        orig +
        '<p class="why" style="margin-top:0.35rem">' +
        (g || '') +
        '</p>' +
        '<span class="cta">IMDb →</span>' +
        '</a>'
      );
    })
    .join('');

  var recentSeen = data.allItems
    .filter(function (i) {
      return i.dateRated;
    })
    .sort(function (a, b) {
      return (b.dateRated || '').localeCompare(a.dateRated || '');
    })
    .slice(0, 15);

  document.getElementById('recent-table-body').innerHTML = recentSeen
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
          ? '<span class="lang-pill" title="Original filming language when known">' +
            rowLang +
            '</span>'
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

  var statCards = [
    { value: data.totalRatings, label: 'Total ratings', icon: '◆', mod: 'stat-card--a' },
    { value: movieCount, label: 'Films', icon: '▣', mod: 'stat-card--b' },
    { value: tvCount, label: 'Series & minis', icon: '▤', mod: 'stat-card--c' },
    { value: data.avgRating.toFixed(1), label: 'Our average', icon: '★', mod: 'stat-card--d' },
    { value: tens, label: 'Perfect 10s', icon: '✦', mod: 'stat-card--e' },
    { value: nonEnCount, label: 'Non-English lean', icon: '⌁', mod: 'stat-card--f' },
    { value: data.genreStats.length, label: 'Genre tags', icon: '※', mod: 'stat-card--g' },
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
        return S.sortRows(directorStats, sortStateDirectors, specDirectors);
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
              '<td title="Composite: avg, title count, star tier"><span class="vibe-stars">' +
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
  mountDirectors();

  var loved = data.lovedMore;
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
        return S.sortRows(loved, sortStateLoved, specLoved);
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
  mountLoved();

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
        return S.sortRows(tensBase, sortStateTop, specTop);
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
