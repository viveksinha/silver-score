/**
 * Genres tab on Browse — call initGenrePanel(DATA) after DOM is ready.
 * Expects elements: #genre-bars, #genre-cards, #genre-compare tbody, #genre-select, #genre-top tbody
 * Load table-sort.js before this file when sortable genre tables are used.
 */
function initGenrePanel(data) {
  const PAGE_SIZE = 10;
  const S = typeof silverScoreTableSort !== 'undefined' ? silverScoreTableSort : null;
  function votesN(i) {
    const v = i.votes;
    if (v == null || v === '') return 0;
    return Number(v);
  }
  const rtCell =
    typeof silverScoreRt !== 'undefined'
      ? (i) => silverScoreRt.cellHtml(i)
      : () => '—';

  function imdbGenreUrl(g) {
    return `https://www.imdb.com/search/title/?genres=${encodeURIComponent(g.toLowerCase().replace(/ /g, '-'))}`;
  }

  const countEl = document.getElementById('genre-count');
  if (countEl) countEl.textContent = data.genreStats.length + ' genres';

  const sorted = [...data.genreStats]
    .filter((g) => g.count >= 5)
    .sort((a, b) => b.avgMyRating - a.avgMyRating);
  const maxG = Math.max(...sorted.map((g) => g.count), 1);

  function makeBarRow(g) {
    const pct = ((g.count / maxG) * 100).toFixed(1);
    const cls =
      g.avgMyRating >= 7.8 ? 'green' : g.avgMyRating >= 7.3 ? '' : g.avgMyRating >= 7 ? 'orange' : 'red';
    return `<div class="bar-row">
      <div class="bar-label"><a href="${imdbGenreUrl(g.genre)}" target="_blank" rel="noopener noreferrer" style="color:var(--text-secondary)">${g.genre}</a></div>
      <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
      <div class="bar-count">${g.count} <span style="color:var(--text-secondary);font-size:0.7rem">(${g.avgMyRating})</span></div>
    </div>`;
  }

  function makeCard(g) {
    let verdict, vclass;
    if (g.avgMyRating >= 7.8) {
      verdict = 'Love it';
      vclass = 'verdict-love';
    } else if (g.avgMyRating >= 7.3) {
      verdict = 'Like';
      vclass = 'verdict-like';
    } else if (g.avgMyRating >= 7.0) {
      verdict = 'Mixed';
      vclass = 'verdict-meh';
    } else {
      verdict = 'Not for us';
      vclass = 'verdict-avoid';
    }
    const barPct = (((g.avgMyRating - 5) / 5) * 100).toFixed(0);
    const barColor =
      g.avgMyRating >= 7.8
        ? 'var(--green)'
        : g.avgMyRating >= 7.3
          ? 'var(--accent)'
          : g.avgMyRating >= 7
            ? 'var(--orange)'
            : 'var(--red)';
    return `<div class="genre-card">
      <h3><a href="${imdbGenreUrl(g.genre)}" target="_blank" rel="noopener noreferrer">${g.genre}</a></h3>
      <div class="genre-meta"><span>${g.count} titles</span><span>Avg: ${g.avgMyRating}</span></div>
      <div class="genre-bar"><div class="genre-bar-fill" style="width:${barPct}%;background:${barColor}"></div></div>
      <div class="genre-verdict ${vclass}">${verdict}</div>
    </div>`;
  }

  function makeCompareRow(g) {
    const gap = (g.avgMyRating - g.avgImdbRating).toFixed(2);
    const gapColor = gap > 0 ? 'var(--green)' : gap < -0.3 ? 'var(--red)' : 'var(--text-secondary)';
    let verdict;
    if (g.avgMyRating >= 7.8) verdict = '<span class="genre-verdict verdict-love">Love it</span>';
    else if (g.avgMyRating >= 7.3) verdict = '<span class="genre-verdict verdict-like">Like</span>';
    else if (g.avgMyRating >= 7.0) verdict = '<span class="genre-verdict verdict-meh">Mixed</span>';
    else verdict = '<span class="genre-verdict verdict-avoid">Not for us</span>';
    return `<tr>
      <td><a href="${imdbGenreUrl(g.genre)}" target="_blank" rel="noopener noreferrer"><strong>${g.genre}</strong></a></td>
      <td>${g.count}</td>
      <td><span class="rating-badge ${g.avgMyRating >= 8 ? 'rating-9' : g.avgMyRating >= 7.5 ? 'rating-8' : 'rating-7'}">${g.avgMyRating}</span></td>
      <td><span class="imdb-badge">${g.avgImdbRating}</span></td>
      <td style="color:${gapColor};font-weight:600">${gap > 0 ? '+' : ''}${gap}</td>
      <td>${verdict}</td>
    </tr>`;
  }

  if (typeof createSilverScoreInfiniteScroll !== 'function') {
    console.error('genres-panel.js: load infinite-scroll.js before this file.');
    return;
  }

  const barsEl = document.getElementById('genre-bars');
  if (barsEl) {
    createSilverScoreInfiniteScroll({
      getItems: () => sorted,
      pageSize: PAGE_SIZE,
      anchorAfter: barsEl,
      root: null,
      render: (items, { append }) => {
        const html = items.map(makeBarRow).join('');
        if (append) barsEl.insertAdjacentHTML('beforeend', html);
        else barsEl.innerHTML = html;
      },
    }).reset();
  }

  const cards = document.getElementById('genre-cards');
  if (cards) {
    createSilverScoreInfiniteScroll({
      getItems: () => sorted,
      pageSize: PAGE_SIZE,
      anchorAfter: cards,
      root: null,
      render: (items, { append }) => {
        const html = items.map(makeCard).join('');
        if (append) cards.insertAdjacentHTML('beforeend', html);
        else cards.innerHTML = html;
      },
    }).reset();
  }

  const genreCompareTable = document.getElementById('genre-compare');
  const ctb = document.querySelector('#genre-compare tbody');
  const tieGenre = (a, b) =>
    String(a.genre || '').localeCompare(String(b.genre || ''), undefined, { sensitivity: 'base', numeric: true });
  const genreCompareSort = { key: 'avgMyRating', dir: 'desc' };
  const genreCompareSpec = {
    genre: { type: 'string', val: (g) => g.genre },
    count: { type: 'number', val: (g) => g.count, tiebreak: tieGenre },
    avgMyRating: { type: 'number', val: (g) => g.avgMyRating, tiebreak: tieGenre },
    avgImdbRating: { type: 'number', val: (g) => g.avgImdbRating, tiebreak: tieGenre },
    gap: {
      type: 'number',
      val: (g) => g.avgMyRating - g.avgImdbRating,
      tiebreak: tieGenre,
    },
  };

  let compareScroll = null;
  function mountCompare() {
    if (!ctb || !genreCompareTable) return;
    if (compareScroll) compareScroll.teardown();
    compareScroll = createSilverScoreInfiniteScroll({
      getItems: () => (S ? S.sortRows(sorted, genreCompareSort, genreCompareSpec) : sorted),
      pageSize: PAGE_SIZE,
      anchorAfter: genreCompareTable,
      root: genreCompareTable.closest('.table-scroll'),
      render: (items, { append }) => {
        const html = items.map(makeCompareRow).join('');
        if (append) ctb.insertAdjacentHTML('beforeend', html);
        else ctb.innerHTML = html;
      },
    });
    compareScroll.reset();
  }

  if (ctb && genreCompareTable) {
    if (S) {
      S.bindSortableTable(genreCompareTable, {
        state: genreCompareSort,
        spec: genreCompareSpec,
        onChange: mountCompare,
      });
    }
    mountCompare();
  }

  const genreTopTable = document.getElementById('genre-top');
  const langTopSelect = document.getElementById('genre-top-lang-filter');
  const lk =
    S && typeof S.languageKey === 'function'
      ? (i) => S.languageKey(i)
      : (i) => String((i && (i.languageLabel || i.languageHint)) || '').trim();
  const tieTitle = (a, b) =>
    String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base', numeric: true });
  const genreTopSort = { key: 'myRating', dir: 'desc' };
  const genreTopSpec = {
    title: { type: 'string', val: (i) => i.title },
    language: { type: 'string', val: (i) => lk(i), tiebreak: tieTitle },
    year: { type: 'number', val: (i) => i.year, tiebreak: tieTitle },
    myRating: { type: 'number', val: (i) => i.myRating, tiebreak: tieTitle },
    imdbRating: { type: 'number', val: (i) => i.imdbRating, tiebreak: tieTitle },
    votes: { type: 'number', val: votesN, tiebreak: tieTitle },
    type: { type: 'string', val: (i) => i.type },
  };
  let genreTopPool = [];
  let genreTopScroll = null;
  const GENRE_TOP_PAGE = 15;

  function mountGenreTop() {
    const tbody = document.querySelector('#genre-top tbody');
    if (!genreTopTable || !tbody) return;
    if (genreTopScroll) genreTopScroll.teardown();
    if (!genreTopPool.length) {
      tbody.innerHTML = '';
      return;
    }
    genreTopScroll = createSilverScoreInfiniteScroll({
      getItems: () => (S ? S.sortRows(genreTopPool, genreTopSort, genreTopSpec) : genreTopPool),
      pageSize: GENRE_TOP_PAGE,
      anchorAfter: genreTopTable,
      root: genreTopTable.closest('.table-scroll'),
      render: (items, { append, startIndex }) => {
        const html = items
          .map((i, idx) => {
            const rank = startIndex + idx + 1;
            const langRaw = lk(i);
            const langCell = S && S.languagePillHtml ? S.languagePillHtml(langRaw) : langRaw ? `<span class="lang-pill lang-pill--intl">${langRaw}</span>` : '—';
            return `<tr>
      <td>${rank}</td>
      <td><a href="${i.url}" target="_blank" rel="noopener noreferrer">${i.title}</a></td>
      <td style="font-size:0.75rem;max-width:7rem">${langCell}</td>
      <td>${i.year}</td>
      <td><span class="rating-badge rating-${i.myRating >= 10 ? '10' : i.myRating >= 9 ? '9' : i.myRating >= 8 ? '8' : '7'}">${i.myRating}</span></td>
      <td><span class="imdb-badge">${i.imdbRating}</span></td>
      <td style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text-secondary)">${votesN(i).toLocaleString()}</td>
      <td class="rt-cell">${rtCell(i)}</td>
      <td style="font-size:0.8rem;color:var(--text-secondary)">${i.type}</td>
    </tr>`;
          })
          .join('');
        if (append) tbody.insertAdjacentHTML('beforeend', html);
        else tbody.innerHTML = html;
      },
    });
    genreTopScroll.reset();
  }

  const select = document.getElementById('genre-select');
  let genreTopBinder = null;
  if (S && genreTopTable) {
    genreTopBinder = S.bindSortableTable(genreTopTable, {
      state: genreTopSort,
      spec: genreTopSpec,
      onChange: mountGenreTop,
    });
  }

  if (select) {
    sorted.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = g.genre;
      opt.textContent = `${g.genre} (${g.count})`;
      select.appendChild(opt);
    });
    if (langTopSelect && S && typeof S.fillLanguageFilterOptions === 'function') {
      S.fillLanguageFilterOptions(langTopSelect, data.allItems);
    }
    function syncGenreTopPool() {
      const genre = select.value;
      const lang = langTopSelect ? langTopSelect.value : '';
      let pool = genre ? data.allItems.filter((i) => i.genres.includes(genre)) : [];
      if (lang === '__none__') pool = pool.filter((i) => !lk(i));
      else if (lang) pool = pool.filter((i) => lk(i) === lang);
      genreTopPool = pool;
      genreTopSort.key = 'myRating';
      genreTopSort.dir = 'desc';
      if (genreTopBinder) genreTopBinder.updateHeaderClasses();
      mountGenreTop();
    }
    select.addEventListener('change', syncGenreTopPool);
    if (langTopSelect) langTopSelect.addEventListener('change', syncGenreTopPool);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('visible');
      });
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll('#panel-genre-dna .fade-in').forEach((el) => observer.observe(el));
}
