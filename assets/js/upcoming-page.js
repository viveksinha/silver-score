/**
 * Upcoming page — timeline + filters. Requires UPCOMING_RELEASES from upcoming-data.js and theme.js.
 */
(function (global) {
  'use strict';

  var upcoming = global.UPCOMING_RELEASES;
  if (!upcoming || !upcoming.length) {
    console.error('upcoming-page.js: load upcoming-data.js first.');
    return;
  }

  function imdbGenreUrl(g) {
    return (
      'https://www.imdb.com/search/title/?genres=' +
      encodeURIComponent(g.toLowerCase().replace(/ /g, '-'))
    );
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function platformClass(platform) {
    var p = (platform || '').toLowerCase();
    if (/\bnetflix\b/.test(p)) return 'tag-pf-netflix';
    if (/prime video|\bamazon\b/.test(p)) return 'tag-pf-prime';
    if (/apple tv|apple\s*tv\+/.test(p)) return 'tag-pf-apple';
    if (/disney\+?|\bhulu\b/.test(p)) return 'tag-pf-disney';
    if (/\bhbo\b|\bmax\b|\bshowtime\b/.test(p)) return 'tag-pf-hbo';
    if (/itvx|\bbbc\b|channel 4|\bsky\b/.test(p)) return 'tag-pf-uktv';
    if (/theater|theatre|cinema|\bneon\b|\buniversal\b|\bwarner\b|\bparamount\b|\bsony\b|imax/.test(p))
      return 'tag-pf-cinema';
    return 'tag-pf-other';
  }

  function countryClass(country) {
    var c = (country || '').toLowerCase();
    if (/\bkorea|korean\b/.test(c)) return 'tag-ct-korea';
    if (/\bjapan|japanese\b/.test(c)) return 'tag-ct-japan';
    if (/\bfrance|french\b/.test(c)) return 'tag-ct-france';
    if (/sweden|denmark|norway|finland|iceland|nordic|scandi/.test(c)) return 'tag-ct-nordic';
    if (/\bisrael\b/.test(c)) return 'tag-ct-mideast';
    if (/\bus\s*\/\s*uk|\buk\s*\/\s*us/.test(c)) return 'tag-ct-usuk';
    if (/\buk\b|britain|england|scotland|wales|northern ireland/.test(c)) return 'tag-ct-uk';
    if (/\bu\.?s\.?\b|united states/.test(c)) return 'tag-ct-us';
    return 'tag-ct-world';
  }

  function parseReleaseMeta(s) {
    var str = (s || '').trim();
    var years = str.match(/\b(202[4-9]|203\d)\b/g);
    var y = years ? parseInt(years[0], 10) : 2099;
    var sort = y * 10000;
    var lower = str.toLowerCase();
    var parsed = Date.parse(str);
    if (!isNaN(parsed)) {
      sort = parsed;
    } else if (/spring/i.test(lower)) sort = y * 10000 + 320;
    else if (/summer/i.test(lower)) sort = y * 10000 + 620;
    else if (/fall|autumn/i.test(lower)) sort = y * 10000 + 920;
    else if (/winter/i.test(lower)) sort = y * 10000 + 120;
    else if (/expected|tbd/i.test(lower)) sort = y * 10000 + 800;
    else sort = y * 10000 + 500;

    var groupKey = years && years.length > 1 ? years[0] + '–' + years[years.length - 1] : String(y);
    return { groupKey: groupKey, sort: sort, label: str, primaryYear: y };
  }

  function renderCard(i) {
    var imdbLink = i.imdbUrl
      ? '<a href="' + i.imdbUrl + '" target="_blank" rel="noopener noreferrer">IMDb</a>'
      : '';
    var ratingDisplay =
      i.imdbRating === 'TBD'
        ? '<span class="imdb-badge" style="opacity:0.55">TBD</span>'
        : '<span class="imdb-badge">' + i.imdbRating + '</span>';
    var titleHtml = i.imdbUrl
      ? '<a href="' + i.imdbUrl + '" target="_blank" rel="noopener noreferrer">' + i.title + '</a>'
      : i.title;
    return (
      '<article class="timeline-card">' +
      '<div class="timeline-card__meta">' +
      '<span class="tag date">' +
      esc(i.releaseDate) +
      '</span>' +
      '<span class="tag platform ' +
      platformClass(i.platform) +
      '">' +
      esc(i.platform) +
      '</span>' +
      '<span class="tag ' +
      (i.type === 'movie' ? 'type-movie' : 'type-tv') +
      '">' +
      esc(i.type === 'movie' ? 'Movie' : 'TV Series') +
      '</span>' +
      '<span class="tag country ' +
      countryClass(i.country) +
      '">' +
      esc(i.country) +
      '</span>' +
      '</div>' +
      '<h3 class="timeline-card__title">' +
      titleHtml +
      '</h3>' +
      '<p class="timeline-card__desc">' +
      i.description +
      '</p>' +
      '<div class="upcoming-tags">' +
      i.tags
        .map(function (t) {
          return '<span class="tag-inline">' + t + '</span>';
        })
        .join('') +
      '</div>' +
      '<div class="timeline-card__foot">' +
      '<div class="timeline-card__genres">' +
      i.genre.split(', ').map(function (g) {
        var x = g.trim();
        return (
          '<a href="' +
          imdbGenreUrl(x) +
          '" target="_blank" rel="noopener noreferrer">' +
          x +
          '</a>'
        );
      }).join(', ') +
      '</div>' +
      '<div class="timeline-card__ratings">' +
      ratingDisplay +
      ' ' +
      imdbLink +
      '</div>' +
      '</div>' +
      '</article>'
    );
  }

  var grid = document.getElementById('upcoming-grid');
  var filteredItems = [];

  function applyFilter(filter) {
    filteredItems = upcoming.slice();
    if (filter === 'movie') {
      filteredItems = filteredItems.filter(function (i) {
        return i.type === 'movie';
      });
    } else if (filter === 'TV series') {
      filteredItems = filteredItems.filter(function (i) {
        return i.type === 'TV series';
      });
    } else if (filter === 'spy') {
      filteredItems = filteredItems.filter(function (i) {
        return i.tags.some(function (t) {
          return t.toLowerCase().indexOf('spy') >= 0;
        });
      });
    } else if (filter === 'nordic') {
      filteredItems = filteredItems.filter(function (i) {
        return (
          i.tags.some(function (t) {
            return t.toLowerCase().indexOf('nordic') >= 0;
          }) || /Sweden|Denmark|Norway|Finland|Iceland/i.test(i.country)
        );
      });
    } else if (filter === 'korean') {
      filteredItems = filteredItems.filter(function (i) {
        return (
          i.tags.some(function (t) {
            return t.toLowerCase().indexOf('korean') >= 0;
          }) || /South Korea|Korea/i.test(i.country)
        );
      });
    } else if (filter === 'french') {
      filteredItems = filteredItems.filter(function (i) {
        return (
          i.tags.some(function (t) {
            return /french|france|paris/i.test(t);
          }) || /France|French/i.test(i.country)
        );
      });
    } else if (filter === 'japanese') {
      filteredItems = filteredItems.filter(function (i) {
        return (
          i.tags.some(function (t) {
            return /japan|japanese|tokyo/i.test(t);
          }) || /Japan/i.test(i.country)
        );
      });
    }

    filteredItems.forEach(function (item) {
      item._meta = parseReleaseMeta(item.releaseDate);
    });
    filteredItems.sort(function (a, b) {
      return a._meta.sort - b._meta.sort;
    });

    var groups = {};
    filteredItems.forEach(function (item) {
      var k = item._meta.groupKey;
      if (!groups[k]) groups[k] = [];
      groups[k].push(item);
    });
    var groupKeys = Object.keys(groups).sort(function (a, b) {
      var ma = groups[a][0]._meta;
      var mb = groups[b][0]._meta;
      return ma.sort - mb.sort;
    });

    var html = '';
    if (!groupKeys.length) {
      html = '<p class="section-lede">Nothing in this filter yet.</p>';
      grid.innerHTML = html;
      return;
    }
    html = '<div class="timeline" role="feed">';
    groupKeys.forEach(function (gk) {
      html +=
        '<section class="timeline-year-block" aria-labelledby="tl-' +
        gk.replace(/[^a-z0-9]+/gi, '-') +
        '">' +
        '<h3 class="timeline-year-label" id="tl-' +
        gk.replace(/[^a-z0-9]+/gi, '-') +
        '">' +
        gk +
        '</h3>' +
        '<div class="timeline-rail">' +
        groups[gk].map(renderCard).join('') +
        '</div>' +
        '</section>';
    });
    html += '</div>';
    grid.innerHTML = html;
  }

  applyFilter('all');

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      applyFilter(btn.dataset.tab);
    });
  });

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
