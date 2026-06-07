#!/usr/bin/env python3
"""
Build assets/js/upcoming-data.js from scraped ratings JSON (site repo root).

  - Auto-derived favorite directors (from directorStats)
  - Seen TV series (from allItems where type in {TV Series, TV Mini Series} and myRating>=threshold)
  - Optional editorial overrides from scripts/upcoming-editorial.json

Data source: TMDB API (person.combined_credits for directors; tv details + external_ids for shows).
Responses are cached under scripts/tmdb-cache/ to keep reruns fast.

Usage:
  export TMDB_API_KEY=...
  python3 scripts/build_upcoming.py --input scripts/scraped-ratings.json
  python3 scripts/build_upcoming.py --dry-run
  python3 scripts/build_upcoming.py --min-director-ratings 3 --min-director-avg 7.5
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

TV_TYPES = frozenset({"TV Series", "TV Mini Series"})
TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w342"
UNKNOWN_DATE = "9999-12-31"


def _site_root() -> Path:
    return Path(__file__).resolve().parent.parent


def sync_upcoming_html(site: Path, cache_bust: str) -> bool:
    """Bump upcoming-data.js ?v= in pages/upcoming.html only (never touches footer)."""
    html_path = site / "pages" / "upcoming.html"
    if not html_path.is_file():
        return False
    text = html_path.read_text(encoding="utf-8")
    new = re.sub(
        r'(src="../assets/js/upcoming-data\.js\?v=)[^"]+',
        rf"\g<1>{cache_bust}",
        text,
    )
    if new == text:
        return False
    html_path.write_text(new, encoding="utf-8")
    return True


# ---------------------------------------------------------------------------
# Ratings export loading + favorites derivation
# ---------------------------------------------------------------------------


def load_export(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("export root must be a JSON object")
    if "allItems" not in data or "directorStats" not in data:
        raise ValueError("export missing allItems or directorStats")
    return data


def _split_directors(name: str) -> list[str]:
    """directorStats may combine duos with commas (e.g. 'Anthony Russo,Joe Russo')."""
    return [p.strip() for p in (name or "").split(",") if p.strip()]


def derive_favorite_directors(
    stats: list[dict], *, min_count: int, min_avg: float
) -> list[dict]:
    """Return a flat list of {name, count, avg} for directors meeting both thresholds."""
    favs: list[dict] = []
    seen: set[str] = set()
    for s in stats:
        if not isinstance(s, dict):
            continue
        count = s.get("count") or 0
        avg = s.get("avg") or 0
        if count < min_count or avg < min_avg:
            continue
        for name in _split_directors(s.get("name") or ""):
            if name in seen:
                continue
            seen.add(name)
            favs.append({"name": name, "count": int(count), "avg": float(avg)})
    favs.sort(key=lambda x: (-x["avg"], -x["count"], x["name"]))
    return favs


def derive_seen_tv(items: list[dict], *, min_rating: float) -> list[dict]:
    out: list[dict] = []
    for i in items:
        if not isinstance(i, dict):
            continue
        if i.get("type") not in TV_TYPES:
            continue
        if (i.get("myRating") or 0) < min_rating:
            continue
        iid = i.get("id")
        if not isinstance(iid, str) or not iid.startswith("tt"):
            continue
        out.append({
            "id": iid,
            "title": i.get("title") or "",
            "myRating": i.get("myRating"),
            "type": i.get("type"),
            "genres": i.get("genres") or [],
        })
    return out


# ---------------------------------------------------------------------------
# TMDB client with disk cache
# ---------------------------------------------------------------------------


class TMDB:
    def __init__(self, api_key: str, cache_dir: Path, *, ttl_days: int, sleep_s: float):
        self.api_key = api_key
        self.cache_dir = cache_dir
        self.ttl_seconds = max(1, ttl_days) * 86400
        self.sleep_s = sleep_s
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._stats = {"hits": 0, "misses": 0, "errors": 0}

    def stats(self) -> dict:
        return dict(self._stats)

    def _cache_path(self, key: str) -> Path:
        safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in key)
        return self.cache_dir / f"{safe}.json"

    def _read_cache(self, key: str) -> dict | None:
        p = self._cache_path(key)
        if not p.is_file():
            return None
        try:
            raw = json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        fetched = raw.get("_fetchedAt") if isinstance(raw, dict) else None
        if not isinstance(fetched, (int, float)):
            return None
        if time.time() - fetched > self.ttl_seconds:
            return None
        return raw.get("data")

    def _write_cache(self, key: str, data: dict | None) -> None:
        p = self._cache_path(key)
        try:
            p.write_text(
                json.dumps({"_fetchedAt": time.time(), "data": data}, ensure_ascii=False),
                encoding="utf-8",
            )
        except OSError:
            pass

    def _get(self, key: str, url: str) -> dict | None:
        cached = self._read_cache(key)
        if cached is not None:
            self._stats["hits"] += 1
            return cached
        self._stats["misses"] += 1
        if self.sleep_s > 0:
            time.sleep(self.sleep_s)
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError, TimeoutError, OSError):
            self._stats["errors"] += 1
            # Cache a None result briefly to avoid hammering on hard failures.
            self._write_cache(key, None)
            return None
        self._write_cache(key, data)
        return data

    def search_person(self, name: str) -> dict | None:
        key = f"person-search-{name.lower().replace(' ', '_')}"
        url = (
            f"{TMDB_BASE}/search/person?api_key={self.api_key}"
            f"&query={urllib.parse.quote(name)}&include_adult=false"
        )
        data = self._get(key, url)
        if not isinstance(data, dict):
            return None
        results = data.get("results")
        if not isinstance(results, list) or not results:
            return None
        # Prefer the result whose known_for_department is Directing, else highest popularity.
        directing = [r for r in results if isinstance(r, dict) and r.get("known_for_department") == "Directing"]
        pool = directing or [r for r in results if isinstance(r, dict)]
        pool.sort(key=lambda r: r.get("popularity") or 0, reverse=True)
        return pool[0] if pool else None

    def combined_credits(self, person_id: int) -> dict | None:
        key = f"person-{person_id}-combined_credits"
        url = f"{TMDB_BASE}/person/{person_id}/combined_credits?api_key={self.api_key}"
        data = self._get(key, url)
        return data if isinstance(data, dict) else None

    def movie_details(self, movie_id: int) -> dict | None:
        key = f"movie-{movie_id}"
        url = f"{TMDB_BASE}/movie/{movie_id}?api_key={self.api_key}&append_to_response=external_ids,release_dates"
        data = self._get(key, url)
        return data if isinstance(data, dict) else None

    def tv_details(self, tv_id: int) -> dict | None:
        key = f"tv-{tv_id}"
        url = f"{TMDB_BASE}/tv/{tv_id}?api_key={self.api_key}&append_to_response=external_ids"
        data = self._get(key, url)
        return data if isinstance(data, dict) else None

    def find_by_imdb(self, imdb_id: str) -> dict | None:
        key = f"find-{imdb_id}"
        url = f"{TMDB_BASE}/find/{imdb_id}?api_key={self.api_key}&external_source=imdb_id"
        data = self._get(key, url)
        return data if isinstance(data, dict) else None


# ---------------------------------------------------------------------------
# Pipeline builders
# ---------------------------------------------------------------------------


FUTURE_TV_STATUS = frozenset({"Returning Series", "In Production", "Planned"})
FUTURE_MOVIE_STATUS = frozenset({"In Production", "Post Production", "Planned"})


def _format_display_date(iso: str) -> str:
    if not iso or iso == UNKNOWN_DATE:
        return "Date TBD"
    try:
        d = datetime.strptime(iso, "%Y-%m-%d").date()
        return d.strftime("%B %-d, %Y")
    except ValueError:
        pass
    # Partial dates ("2026" or "2026-07") still useful
    if len(iso) == 4 and iso.isdigit():
        return iso
    if len(iso) == 7:
        try:
            d = datetime.strptime(iso, "%Y-%m").date()
            return d.strftime("%B %Y")
        except ValueError:
            pass
    return iso


def _genres_from_tmdb(obj: dict) -> list[str]:
    raw = obj.get("genres") if isinstance(obj, dict) else None
    if not isinstance(raw, list):
        return []
    return [g.get("name") for g in raw if isinstance(g, dict) and isinstance(g.get("name"), str)]


def _country_from_tmdb(obj: dict) -> str:
    cc = obj.get("origin_country") or obj.get("production_countries")
    if isinstance(cc, list) and cc:
        first = cc[0]
        if isinstance(first, str):
            return first
        if isinstance(first, dict):
            return first.get("iso_3166_1") or first.get("name") or ""
    return ""


def _poster_url(path: str | None) -> str:
    if not isinstance(path, str) or not path:
        return ""
    return f"{TMDB_IMG_BASE}{path}"


def build_movies_for_director(
    tmdb: TMDB,
    director: dict,
    *,
    today: date,
    lookback_days: int,
    cutoff_future_days: int,
) -> list[dict]:
    """Find upcoming / recent movies directed by `director['name']`."""
    person = tmdb.search_person(director["name"])
    if not person:
        return []
    person_id = person.get("id")
    if not isinstance(person_id, int):
        return []
    credits = tmdb.combined_credits(person_id)
    if not credits:
        return []
    crew = credits.get("crew") or []
    if not isinstance(crew, list):
        return []

    rows: list[dict] = []
    seen_ids: set[int] = set()
    for c in crew:
        if not isinstance(c, dict):
            continue
        if c.get("job") != "Director" and c.get("department") != "Directing":
            continue
        media_type = c.get("media_type")
        tmdb_id = c.get("id")
        if not isinstance(tmdb_id, int) or tmdb_id in seen_ids:
            continue
        if media_type not in ("movie", "tv"):
            continue

        release_date = (c.get("release_date") or c.get("first_air_date") or "").strip()
        is_future_or_recent = False
        if release_date:
            try:
                rd = datetime.strptime(release_date, "%Y-%m-%d").date()
                if (rd - today).days >= -lookback_days and (rd - today).days <= cutoff_future_days:
                    is_future_or_recent = True
            except ValueError:
                pass
        # Fetch details only if promising (future date or no date yet).
        details: dict | None = None
        if not release_date or is_future_or_recent:
            details = (
                tmdb.movie_details(tmdb_id) if media_type == "movie" else tmdb.tv_details(tmdb_id)
            )
            if not details:
                continue
            status = details.get("status") or ""
            if media_type == "movie":
                if not is_future_or_recent and status not in FUTURE_MOVIE_STATUS:
                    continue
            else:
                if not is_future_or_recent and status not in FUTURE_TV_STATUS:
                    continue

        if details is None:
            continue

        seen_ids.add(tmdb_id)

        ext = details.get("external_ids") or {}
        imdb_id = ext.get("imdb_id") or ""
        iso_date = (
            details.get("release_date") or details.get("first_air_date") or release_date or ""
        ) or UNKNOWN_DATE

        title = details.get("title") or details.get("name") or c.get("title") or c.get("name") or ""
        rows.append(
            {
                "id": imdb_id or f"tmdb-{media_type}-{tmdb_id}",
                "tmdbId": tmdb_id,
                "title": title,
                "type": "movie" if media_type == "movie" else "tv",
                "releaseDate": iso_date,
                "releaseDateDisplay": _format_display_date(iso_date),
                "status": details.get("status") or "",
                "genres": _genres_from_tmdb(details),
                "country": _country_from_tmdb(details),
                "posterUrl": _poster_url(details.get("poster_path")),
                "imdbUrl": f"https://www.imdb.com/title/{imdb_id}" if imdb_id else "",
                "source": "director",
                "sourceReason": f"{director['name']} directs",
                "relatedTitleId": None,
                "showTitle": None,
                "seasonNumber": None,
                "episodeCount": None,
                "description": details.get("overview") or "",
                "tags": [director["name"]],
                "platform": "",
            }
        )
    return rows


def build_next_season_for_show(tmdb: TMDB, show: dict) -> dict | None:
    imdb_id = show.get("id")
    if not isinstance(imdb_id, str):
        return None
    found = tmdb.find_by_imdb(imdb_id)
    if not found:
        return None
    tv_results = found.get("tv_results") or []
    if not isinstance(tv_results, list) or not tv_results or not isinstance(tv_results[0], dict):
        return None
    tv_id = tv_results[0].get("id")
    if not isinstance(tv_id, int):
        return None
    details = tmdb.tv_details(tv_id)
    if not details:
        return None
    status = details.get("status") or ""
    next_ep = details.get("next_episode_to_air") or {}
    if status not in FUTURE_TV_STATUS and not isinstance(next_ep, dict):
        return None
    if status not in FUTURE_TV_STATUS and not next_ep:
        return None

    # Prefer the season referenced by next_episode_to_air; else last season in seasons[].
    season_number = None
    air_date = None
    episode_count = None
    season_name = None
    if isinstance(next_ep, dict) and next_ep:
        season_number = next_ep.get("season_number")
        air_date = next_ep.get("air_date")
    if season_number is None:
        seasons = details.get("seasons") or []
        if isinstance(seasons, list) and seasons:
            last = seasons[-1]
            if isinstance(last, dict):
                season_number = last.get("season_number")
                air_date = last.get("air_date") or air_date
                episode_count = last.get("episode_count")
                season_name = last.get("name")
    iso_date = (air_date or details.get("next_episode_to_air", {}).get("air_date") or UNKNOWN_DATE) or UNKNOWN_DATE

    my_rating = show.get("myRating")
    reason = (
        f"Season {season_number} of a show you rated {my_rating}"
        if my_rating is not None and season_number is not None
        else f"A returning show you rated {my_rating}" if my_rating is not None
        else "A returning show you've watched"
    )

    return {
        "id": imdb_id,
        "tmdbId": tv_id,
        "title": show.get("title") or details.get("name") or "",
        "type": "tv",
        "releaseDate": iso_date,
        "releaseDateDisplay": _format_display_date(iso_date),
        "status": status,
        "genres": _genres_from_tmdb(details),
        "country": _country_from_tmdb(details),
        "posterUrl": _poster_url(details.get("poster_path")),
        "imdbUrl": f"https://www.imdb.com/title/{imdb_id}",
        "source": "seen-tv",
        "sourceReason": reason,
        "relatedTitleId": imdb_id,
        "showTitle": show.get("title") or details.get("name") or "",
        "seasonNumber": season_number,
        "episodeCount": episode_count,
        "description": details.get("overview") or "",
        "tags": [t for t in [season_name] if isinstance(t, str) and t],
        "platform": "",
    }


# ---------------------------------------------------------------------------
# Editorial merge + output
# ---------------------------------------------------------------------------


EDITORIAL_KEYS = ("description", "tags", "platform", "country", "eyebrow", "releaseDateDisplay")


def merge_editorial(rows: list[dict], editorial: dict) -> list[dict]:
    for r in rows:
        key = r.get("id")
        if not key:
            continue
        override = editorial.get(key)
        if not isinstance(override, dict):
            continue
        for k in EDITORIAL_KEYS:
            if k in override:
                r[k] = override[k]
    # Editorial-only rows: add any id that's in editorial but not in rows, treated as a full record.
    present = {r.get("id") for r in rows}
    for k, v in editorial.items():
        if k in present or not isinstance(v, dict):
            continue
        if not v.get("title"):
            continue
        rows.append({
            "id": k,
            "tmdbId": v.get("tmdbId"),
            "title": v.get("title"),
            "type": v.get("type") or "movie",
            "releaseDate": v.get("releaseDate") or UNKNOWN_DATE,
            "releaseDateDisplay": v.get("releaseDateDisplay") or _format_display_date(
                v.get("releaseDate") or ""
            ),
            "status": v.get("status") or "",
            "genres": v.get("genres") or [],
            "country": v.get("country") or "",
            "posterUrl": v.get("posterUrl") or "",
            "imdbUrl": v.get("imdbUrl") or (f"https://www.imdb.com/title/{k}" if k.startswith("tt") else ""),
            "source": "editorial",
            "sourceReason": v.get("sourceReason") or "Editor's pick",
            "relatedTitleId": v.get("relatedTitleId"),
            "showTitle": v.get("showTitle"),
            "seasonNumber": v.get("seasonNumber"),
            "episodeCount": v.get("episodeCount"),
            "description": v.get("description") or "",
            "tags": v.get("tags") or [],
            "platform": v.get("platform") or "",
        })
    return rows


def dedupe_and_sort(rows: list[dict]) -> list[dict]:
    by_id: dict[str, dict] = {}
    for r in rows:
        rid = r.get("id") or ""
        if not rid:
            continue
        existing = by_id.get(rid)
        if existing is None:
            by_id[rid] = r
            continue
        # Prefer editorial, then director (movies), then seen-tv; richer fields win.
        priority = {"editorial": 0, "director": 1, "seen-tv": 2}
        a = priority.get(existing.get("source") or "", 3)
        b = priority.get(r.get("source") or "", 3)
        if b < a:
            by_id[rid] = r
    rows = list(by_id.values())
    rows.sort(key=lambda r: (r.get("releaseDate") or UNKNOWN_DATE, r.get("title") or ""))
    return rows


def write_upcoming_js(path: Path, rows: list[dict], meta: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    releases = json.dumps(rows, ensure_ascii=False, indent=2)
    meta_json = json.dumps(meta, ensure_ascii=False, indent=2)
    path.write_text(
        "/* Generated by scripts/build_upcoming.py — do not edit by hand. */\n"
        f"window.UPCOMING_RELEASES = {releases};\n"
        f"window.UPCOMING_META = {meta_json};\n",
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    root = _site_root()
    scripts_dir = Path(__file__).resolve().parent
    default_in = scripts_dir / "scraped-ratings.json"
    default_out = root / "assets" / "js" / "upcoming-data.js"
    default_favs = scripts_dir / "favorites-derived.json"
    default_generated = scripts_dir / "upcoming-generated.json"
    default_cache = scripts_dir / "tmdb-cache"
    default_editorial = scripts_dir / "upcoming-editorial.json"

    p = argparse.ArgumentParser(description="Build upcoming-data.js from ratings + TMDB")
    p.add_argument(
        "--input",
        type=Path,
        default=default_in,
        help=f"Ratings JSON (default: {default_in})",
    )
    p.add_argument("-o", "--output", type=Path, default=default_out, help="Output upcoming-data.js path")
    p.add_argument("--cache-dir", type=Path, default=default_cache, help="TMDB disk cache directory")
    p.add_argument(
        "--editorial",
        type=Path,
        default=default_editorial,
        help="Optional editorial overrides JSON",
    )
    p.add_argument("--no-html", action="store_true", help="Skip upcoming.html cache-buster bump")
    p.add_argument("--min-director-ratings", type=int, default=3)
    p.add_argument("--min-director-avg", type=float, default=7.0)
    p.add_argument("--min-tv-rating", type=float, default=7.0)
    p.add_argument("--lookback-days", type=int, default=30, help="Include titles already released in the last N days")
    p.add_argument("--cutoff-future-days", type=int, default=365 * 3, help="Ignore titles more than N days out")
    p.add_argument("--ttl-days", type=int, default=7, help="TMDB cache TTL in days")
    p.add_argument("--sleep", type=float, default=0.2, help="Sleep between TMDB calls")
    p.add_argument("--dry-run", action="store_true", help="Print derived favorites + planned fetches; no network, no writes")
    p.add_argument("--limit-directors", type=int, default=0, help="(debug) only process N directors")
    p.add_argument("--limit-shows", type=int, default=0, help="(debug) only process N seen-TV shows")
    args = p.parse_args()

    in_path = args.input.expanduser().resolve()
    if not in_path.is_file():
        print(f"error: input not found: {in_path}", file=sys.stderr)
        return 1

    try:
        export = load_export(in_path)
    except (ValueError, json.JSONDecodeError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    favorites = derive_favorite_directors(
        export.get("directorStats") or [],
        min_count=args.min_director_ratings,
        min_avg=args.min_director_avg,
    )
    seen_tv = derive_seen_tv(export.get("allItems") or [], min_rating=args.min_tv_rating)

    if args.limit_directors > 0:
        favorites = favorites[: args.limit_directors]
    if args.limit_shows > 0:
        seen_tv = seen_tv[: args.limit_shows]

    # Persist the derived list for transparency.
    default_favs.parent.mkdir(parents=True, exist_ok=True)
    default_favs.write_text(
        json.dumps(
            {
                "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "thresholds": {
                    "minDirectorRatings": args.min_director_ratings,
                    "minDirectorAvg": args.min_director_avg,
                    "minTvRating": args.min_tv_rating,
                },
                "favoriteDirectors": favorites,
                "seenTvCount": len(seen_tv),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"favorite directors: {len(favorites)} | seen TV: {len(seen_tv)}")
    if args.dry_run:
        for f in favorites[:30]:
            print(f"  director {f['name']} (count={f['count']}, avg={f['avg']})")
        if len(favorites) > 30:
            print(f"  ... +{len(favorites) - 30} more directors")
        for s in seen_tv[:10]:
            print(f"  show {s['id']} {s['title']} (myRating={s['myRating']})")
        if len(seen_tv) > 10:
            print(f"  ... +{len(seen_tv) - 10} more shows")
        print("dry-run: no network calls, no writes to assets/")
        return 0

    api_key = (os.environ.get("TMDB_API_KEY") or "").strip()
    if not api_key:
        print("error: set TMDB_API_KEY (or use --dry-run)", file=sys.stderr)
        return 1

    cache_dir = args.cache_dir.expanduser().resolve()
    tmdb = TMDB(api_key, cache_dir, ttl_days=args.ttl_days, sleep_s=args.sleep)
    today = date.today()

    rows: list[dict] = []

    print("fetching director credits…")
    for idx, fav in enumerate(favorites, 1):
        new = build_movies_for_director(
            tmdb,
            fav,
            today=today,
            lookback_days=args.lookback_days,
            cutoff_future_days=args.cutoff_future_days,
        )
        if new:
            print(f"  [{idx}/{len(favorites)}] {fav['name']} → {len(new)} upcoming")
        rows.extend(new)

    print("fetching TV statuses…")
    tv_hits = 0
    for idx, show in enumerate(seen_tv, 1):
        r = build_next_season_for_show(tmdb, show)
        if r:
            rows.append(r)
            tv_hits += 1
        if idx % 25 == 0:
            print(f"  …polled {idx}/{len(seen_tv)} shows ({tv_hits} returning/in production)")
    print(f"  TV returning/in production: {tv_hits}")

    # Merge editorial overrides.
    editorial_path = args.editorial.expanduser().resolve()
    editorial: dict = {}
    if editorial_path.is_file():
        try:
            raw = json.loads(editorial_path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                editorial = raw
        except json.JSONDecodeError:
            print(f"warn: editorial JSON invalid at {editorial_path}", file=sys.stderr)
    if editorial:
        rows = merge_editorial(rows, editorial)
        print(f"merged editorial overrides for {len(editorial)} ids")

    rows = dedupe_and_sort(rows)

    meta = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "favoriteDirectors": [f["name"] for f in favorites],
        "seenShowCount": len(seen_tv),
        "itemCount": len(rows),
        "tmdbCacheStats": tmdb.stats(),
        "thresholds": {
            "minDirectorRatings": args.min_director_ratings,
            "minDirectorAvg": args.min_director_avg,
            "minTvRating": args.min_tv_rating,
        },
    }

    # Debug copy for inspection.
    default_generated.parent.mkdir(parents=True, exist_ok=True)
    default_generated.write_text(
        json.dumps({"meta": meta, "releases": rows}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    out_path = args.output.expanduser().resolve()
    write_upcoming_js(out_path, rows, meta)

    if not args.no_html:
        cache_bust = date.today().strftime("%Y%m%d")
        if sync_upcoming_html(root, cache_bust):
            print(f"updated pages/upcoming.html cache buster (?v={cache_bust})")

    try:
        rel = out_path.relative_to(root)
    except ValueError:
        rel = out_path
    print(
        f"wrote {rel} ({len(rows)} releases) · "
        f"cache hits={meta['tmdbCacheStats']['hits']} misses={meta['tmdbCacheStats']['misses']} errors={meta['tmdbCacheStats']['errors']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
