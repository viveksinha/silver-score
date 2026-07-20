#!/usr/bin/env python3
"""Build watchlist-data.js from scraped watchlist JSON, minus already-rated titles."""
from __future__ import annotations

import argparse
import json
import sys
import re
from datetime import date, datetime, timezone
from pathlib import Path

from scrape_imdb import EPISODE_TYPES, release_date_to_iso, year_from_imdb_title
from imdb_title_dates import ImdbDateEnricher, is_concrete_iso
from wikidata_languages import (
    fetch_wikidata_language_labels,
    language_label_from_export_field,
)

REQUIRED_ITEM_FIELDS = ("id", "title", "year", "imdbRating", "type", "genres", "url")


def _site_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _load_json_dict(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except json.JSONDecodeError:
        return {}


def load_watchlist(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict) or "items" not in data:
        raise ValueError("watchlist JSON must be an object with items[]")
    items = data["items"]
    if not isinstance(items, list):
        raise ValueError("items must be a list")
    if items:
        missing = [k for k in REQUIRED_ITEM_FIELDS if k not in items[0]]
        if missing:
            raise ValueError(f"Items missing fields: {missing}")
    return data


def load_rated_ids(ratings_path: Path) -> set[str]:
    if not ratings_path.is_file():
        print(f"warning: ratings file not found: {ratings_path}", file=sys.stderr)
        return set()
    raw = json.loads(ratings_path.read_text(encoding="utf-8"))
    ids = raw.get("allRatedIds")
    if isinstance(ids, list) and ids:
        return set(ids)
    # Fallback: allItems only (no episodes) when allRatedIds missing
    items = raw.get("allItems") or []
    return {i["id"] for i in items if i.get("id")}


def _item_premiere_year(item: dict) -> int:
    rd = (item.get("releaseDate") or "").strip()
    if rd and len(rd) >= 4 and rd[:4].isdigit():
        return int(rd[:4])
    return int(item.get("year") or 0)


def correct_imdb_years(items: list[dict], *, today: date) -> int:
    """Refresh year from IMDb premiere when scrape year is stale (e.g. announced 2026, out 2025)."""
    corrected = 0
    stale_cutoff = today.year - 1
    enricher = ImdbDateEnricher()
    for item in items:
        iid = item.get("id")
        if not isinstance(iid, str) or not iid.startswith("tt"):
            continue
        old_y = int(item.get("year") or 0)
        rd = (item.get("releaseDate") or "").strip()
        if is_concrete_iso(rd):
            new_y = int(rd[:4])
            if new_y != old_y:
                item["year"] = new_y
                corrected += 1
            continue
        if old_y > 0 and old_y < stale_cutoff:
            continue
        title = enricher.fetch_title_dates(iid)
        if not title:
            continue
        iso = release_date_to_iso(title.get("releaseDate"))
        if iso:
            item["releaseDate"] = iso
        new_y = year_from_imdb_title(title.get("releaseYear"), title.get("releaseDate"))
        if new_y and new_y != old_y:
            item["year"] = new_y
            corrected += 1
    return corrected


def enrich_languages(items: list[dict], cache_path: Path, *, use_wikidata: bool = True) -> None:
    cache = _load_json_dict(cache_path)
    ids = sorted({item["id"] for item in items if item.get("id")})
    to_fetch = [i for i in ids if i not in cache]

    if use_wikidata and to_fetch:
        try:
            new = fetch_wikidata_language_labels(to_fetch)
            for i in to_fetch:
                cache[i] = new[i] if i in new else False
            cache_path.write_text(
                json.dumps(cache, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            print(f"wikidata: cached languages for {len(to_fetch)} new ids")
        except OSError as e:
            print(f"wikidata: skipped ({e})", file=sys.stderr)

    for item in items:
        rid = item.get("id") or ""
        lab = ""
        if rid in cache:
            cv = cache[rid]
            if isinstance(cv, str):
                lab = cv
        if not lab:
            lab = language_label_from_export_field(item)
        if lab.lower() == "english":
            lab = ""
        item["languageLabel"] = lab


def write_watchlist_js(out: Path, meta: dict, items: list[dict]) -> None:
    payload = {"meta": meta, "items": items}
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        f"var WATCHLIST = {body};\n"
        f"if (typeof window !== 'undefined') window.WATCHLIST = WATCHLIST;\n",
        encoding="utf-8",
    )


def sync_watchlist_cache_buster(site: Path, cache_bust: str) -> list[Path]:
    """Bump watchlist-data.js ?v= on every page that loads it."""
    pattern = re.compile(r'(src="(?:\.\./)?assets/js/watchlist-data\.js\?v=)[^"]+')
    updated: list[Path] = []
    for html in [site / "index.html", *(site / "pages").glob("*.html")]:
        text = html.read_text(encoding="utf-8")
        new = pattern.sub(rf"\g<1>{cache_bust}", text)
        if new != text:
            html.write_text(new, encoding="utf-8")
            updated.append(html)
    return updated


def main() -> int:
    scripts_dir = Path(__file__).resolve().parent
    site = _site_root()
    default_in = scripts_dir / "scraped-watchlist.json"
    default_ratings = scripts_dir / "scraped-ratings.json"
    default_out = site / "assets" / "js" / "watchlist-data.js"
    default_cache = scripts_dir / "wikidata-language-cache.json"

    p = argparse.ArgumentParser(description="Build watchlist-data.js from scraped watchlist JSON")
    p.add_argument("--input", type=Path, default=default_in, help="Scraped watchlist JSON")
    p.add_argument(
        "--ratings",
        type=Path,
        default=default_ratings,
        help="Scraped ratings JSON (for allRatedIds subtraction)",
    )
    p.add_argument("-o", "--output", type=Path, default=default_out, help="Output watchlist-data.js")
    p.add_argument("--language-cache", type=Path, default=default_cache)
    p.add_argument("--no-wikidata", action="store_true")
    p.add_argument(
        "--no-year-refresh",
        action="store_true",
        help="Skip IMDb premiere lookup for recent/future years",
    )
    args = p.parse_args()

    in_path = args.input.expanduser().resolve()
    if not in_path.is_file():
        print(f"error: input not found: {in_path}", file=sys.stderr)
        return 1

    try:
        data = load_watchlist(in_path)
    except (ValueError, json.JSONDecodeError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    rated_ids = load_rated_ids(args.ratings.expanduser().resolve())
    raw_items = data.get("items") or []
    total_raw = len(raw_items)

    items = [
        i
        for i in raw_items
        if i.get("id") not in rated_ids and i.get("type") not in EPISODE_TYPES
    ]
    excluded_rated = sum(1 for i in raw_items if i.get("id") in rated_ids)
    excluded_episodes = sum(
        1 for i in raw_items if i.get("type") in EPISODE_TYPES and i.get("id") not in rated_ids
    )

    if not args.no_year_refresh:
        n_fixed = correct_imdb_years(items, today=date.today())
        if n_fixed:
            print(f"imdb: corrected year on {n_fixed} title(s)")

    cache_path = args.language_cache.expanduser().resolve()
    enrich_languages(items, cache_path, use_wikidata=not args.no_wikidata)

    src_meta = data.get("meta") or {}
    meta = {
        "listId": src_meta.get("listId", ""),
        "listName": src_meta.get("listName", "WATCHLIST"),
        "totalScraped": total_raw,
        "totalUnrated": len(items),
        "excludedRated": excluded_rated,
        "excludedEpisodes": excluded_episodes,
        "builtAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sourceScrapedAt": src_meta.get("scrapedAt", ""),
    }

    out_path = args.output.expanduser().resolve()
    write_watchlist_js(out_path, meta, items)

    cache_bust = datetime.now().strftime("%Y%m%d")
    for path in sync_watchlist_cache_buster(site, cache_bust):
        print(f"updated watchlist-data.js cache buster: {path.relative_to(site)}")

    print(
        f"wrote {out_path.name} ({meta['totalUnrated']} unrated of {total_raw} scraped; "
        f"{excluded_rated} already rated, {excluded_episodes} episodes skipped)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
