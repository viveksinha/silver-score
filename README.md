# Silver Score (static site)

This repository is **only** the public static site. Point your host (e.g. [GitHub Pages](https://pages.github.com/)) at the **repository root** so `index.html` is the site entry.

## Regenerating `assets/js/data.js`

`data.js` is **generated**; it is not hand-edited. Build it from the parent **movies** workspace on your machine (same folder layout as a full checkout: `movies/site/` = this repo, `movies/private/` = local export + caches, not published).

From the **`movies/`** directory (parent of `site/`):

```bash
python3 scripts/build_from_export.py
```

- Input: `private/data/ratings-export.json`
- Output: `site/assets/js/data.js` (this tree)

Optional private merges (same machine, under `movies/private/data/`): Rotten Tomatoes (`rt-scores.json`), language overrides (`original-languages.json`), Wikidata cache, TV watch enrichment — see `scripts/build_from_export.py` in the parent project.

Flags: `--no-html`, `--no-wikidata` (see script help).

## Original language

Titles carry **`languageLabel`** when the build resolved a **non-English** original filming language (Wikidata + overrides). English-only rows omit it.

## Runtime hours on the home page

`totalWatchHours` sums **per catalogue row** (export `runtime` in minutes). Films are roughly one feature each; TV rows use one runtime per series unless you add **TV enrichment** in the private build (see parent `scripts/build_from_export.py`).

## Layout

- `index.html` — home
- `pages/` — other HTML
- `assets/css/`, `assets/js/` — static assets
