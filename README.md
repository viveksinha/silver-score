# Silver Score

**[Visit the site →](https://viveksinha.github.io/silver-score/)**

Silver Score is **our shared watch shelf** in one calm, readable site: hundreds of rated films and series, lists with a point of view, and charts that show how our taste actually behaves—not a leaderboard, but shelves we live on.

Open it on your phone or desktop, switch **light** or **dark** in the nav, and wander.

---

## What you’ll find inside

- **Home** — Our living dashboard: favorites we’d argue for, “under the radar” teaser rail, world-cinema highlights, essay teasers, recently rated rows, star distribution, decade spread, directors we keep coming back to, and titles we liked more than the crowd.
- **Stories** — Our lists, essays, and what’s on our calendar: curated lists with a thesis, long reads, under-the-radar entry points into the full shelf, and release lanes we’re tracking.
- **Upcoming** — What we’re tracking next—filter by mood, region, or streamer-style tags when you want a narrower lens.
- **Browse** — Search everything we’ve rated or dive into **genre DNA**: how our averages line up against IMDb by category.
- **About** — Vivek and Abhilasha: same couch, honest scores, and why tension, craft, and stories that don’t talk down matter to us.

**Under the Radar** (full sortable shelf) lives at `pages/hidden-gems.html`; the home page and **Stories** surface it with teasers and entry cards—there is no separate top-level nav tab for it.

---

## Why it’s worth a bookmark

If you like **slow burns, thrillers, prestige TV, and stories that trust the audience**, this site is a filter bubble we built on purpose—honest scores, IMDb links everywhere you need them, and lists and essays that feel like a conversation, not a spreadsheet.

**[Go to Silver Score](https://viveksinha.github.io/silver-score/)**

---

*Source for this site: [github.com/viveksinha/silver-score](https://github.com/viveksinha/silver-score)*

---

## Ratings refresh (GitHub Actions)

The **`site/`** repo runs [`.github/workflows/refresh-ratings.yml`](.github/workflows/refresh-ratings.yml) daily (and on demand): scrape IMDb → `scripts/build_data.py` → commit `assets/js/data.js` and `watchlist-data.js`.

**Local vs CI**

| | **Local** (`movies/scripts/build_from_export.py`) | **CI** (`site/scripts/build_data.py`) |
|---|-----|-----|
| Ratings source | `private/data/ratings-export.json` | Scraped `scripts/scraped-ratings.json` |
| Language cache | `private/data/wikidata-original-languages.json` | `scripts/wikidata-language-cache.json` (committed) |
| Manual overrides | `private/data/original-languages.json` (gitignored) | Not available |
| World-rail overrides | **`site/data/original-languages-overrides.json`** (committed) | Same file |

`private/` never reaches GitHub Actions. Language labels come from Wikidata + scrape fields only in CI.

**Beyond English rail** (`excludeWorldRail`, `worldRail` on items in `data.js`) is controlled by **`site/data/original-languages-overrides.json`**. Both build scripts merge that file so overrides survive every CI run. Edit the committed JSON for rail exclusions; use `private/data/original-languages.json` locally for extra language fixes that should not ship.

---

## Pageview counter (GoatCounter)

Maintainer notes only — nothing about GoatCounter is linked from the public site except the footer total when it loads successfully.

**Dashboard:** [vivek-silver-score.goatcounter.com](https://vivek-silver-score.goatcounter.com/)

### What it counts

- **Page views**, not unique visitors. Home → Stories → Browse in one visit = **three** views.
- Each full HTML page load sends one beacon via `assets/js/pageviews.js`.
- Hash-only navigation (e.g. Browse tabs) does **not** add a view unless you load another page.

### How to create / wire up

1. Sign up at [goatcounter.com](https://www.goatcounter.com/) and create a site with code **`vivek-silver-score`** (must match `GC_CODE` in `assets/js/pageviews.js`).
2. **Settings → Allow adding visitor counts on your website** — turn **on** (required for the footer number).
3. Add the live site URL (`https://viveksinha.github.io/silver-score/`) under allowed domains if prompted.
4. Deploy `site/` as usual. The footer span `#footer-visit-count` is filled by `pageviews.js` on every page that loads that script.

### Frequency & freshness

| What | When |
|------|------|
| Recording a view | On each page load, as soon as the GoatCounter beacon runs |
| Footer number on a page | Fetched **once** when that page loads (8s timeout) |
| GoatCounter total API cache | Up to **~4 hours** — the footer total can lag behind the dashboard |
| Dashboard charts | Near real-time; use the dashboard link above for detail |

So: visits are logged immediately, but the **footer total may not tick up on every refresh** until GoatCounter’s cache expires.

### Pageview counter (GoatCounter)
**Dashboard:** [vivek-silver-score-goatcounter](https://vivek-silver-score.goatcounter.com/)
