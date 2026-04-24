/**
 * Genres excluded from “insight” surfaces (charts, rankings, home strip, Browse DNA).
 * Drama is almost always present on IMDb titles — it drowns out signal elsewhere.
 * Load before home.js and genres-panel.js.
 * @see .cursor/rules/genre-insights-exclusions.mdc
 */
(function (global) {
  var EXCLUDED_FROM_GENRE_INSIGHTS = ['Drama'];

  function isGenreUsedForInsights(name) {
    return EXCLUDED_FROM_GENRE_INSIGHTS.indexOf(String(name || '').trim()) === -1;
  }

  function filterGenreStatsForInsights(stats) {
    if (!stats || !stats.length) return [];
    return stats.filter(function (g) {
      return isGenreUsedForInsights(g.genre);
    });
  }

  global.silverScoreGenreInsights = {
    excludedFromGenreInsights: EXCLUDED_FROM_GENRE_INSIGHTS,
    isGenreUsedForInsights: isGenreUsedForInsights,
    filterGenreStatsForInsights: filterGenreStatsForInsights,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
