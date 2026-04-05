/**
 * Rotten Tomatoes — search URL when rtUrl/rtScore missing from DATA (see rt-scores.json + build).
 */
(function (global) {
  'use strict';
  function searchUrl(title, year) {
    var q = String(title || '').trim() + ' ' + String(year != null ? year : '').trim();
    return 'https://www.rottentomatoes.com/search?search=' + encodeURIComponent(q.trim());
  }
  function cellHtml(item) {
    var url = item.rtUrl || searchUrl(item.title, item.year);
    var label =
      item.rtScore != null && item.rtScore !== '' ? String(item.rtScore) : 'Search';
    return (
      '<a class="rt-link" href="' +
      url +
      '" target="_blank" rel="noopener noreferrer" title="Rotten Tomatoes">' +
      '<span class="rt-icon" aria-hidden="true">🍅</span> ' +
      label +
      '</a>'
    );
  }
  global.silverScoreRt = { searchUrl: searchUrl, cellHtml: cellHtml };
})(typeof window !== 'undefined' ? window : globalThis);
