#!/usr/bin/env python3
"""Read scraped ratings JSON, enrich with Wikidata languages, and emit data.js + HTML stamps."""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

from wikidata_languages import (
    fetch_wikidata_language_labels,
    language_label_from_export_field,
)

REQUIRED_TOP_LEVEL = (
    "allItems",
    "avgRating",
    "bottomRated",
    "decadeStats",
    "directorStats",
    "genreStats",
    "lovedMore",
    "mainItems",
    "ratingDistribution",
    "topRated",
    "totalRatings",
    "typeStats",
)

REQUIRED_ITEM_FIELDS = ("id", "title", "year", "myRating", "imdbRating", "type", "genres", "url")


def _site_root() -> Path:
    return Path(__file__).resolve().parent.parent


def load_data(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("Root must be a JSON object")
    missing = [k for k in REQUIRED_TOP_LEVEL if k not in data]
    if missing:
        raise ValueError(f"Missing top-level keys: {missing}")
    items = data["allItems"]
    if not isinstance(items, list) or not items:
        raise ValueError("allItems must be a non-empty list")
    sample = items[0]
    imissing = [k for k in REQUIRED_ITEM_FIELDS if k not in sample]
    if imissing:
        raise ValueError(f"Items missing fields: {imissing}")
    if int(data["mainItems"]) != len(items):
        raise ValueError(f"mainItems ({data['mainItems']}) != len(allItems) ({len(items)})")
    return data


def _load_json_dict(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except json.JSONDecodeError:
        return {}


def enrich_languages(data: dict, cache_path: Path, *, use_wikidata: bool = True) -> None:
    cache = _load_json_dict(cache_path)
    ids = sorted({item["id"] for item in data["allItems"] if item.get("id")})
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

    for item in data["allItems"]:
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
        item.pop("languageHint", None)


def compute_estimated_hours(data: dict) -> int:
    total_minutes = 0
    for item in data["allItems"]:
        tv_min = item.get("tvTotalMinutes")
        if isinstance(tv_min, (int, float)) and tv_min > 0:
            total_minutes += int(tv_min)
        else:
            rt = item.get("runtime")
            if isinstance(rt, (int, float)) and rt > 0:
                total_minutes += int(rt)
    return round(total_minutes / 60)


def write_data_js(out: Path, data: dict) -> None:
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        f"var DATA = {payload};\n"
        f"if (typeof window !== 'undefined') window.DATA = DATA;\n",
        encoding="utf-8",
    )


def footer_stamp(now: datetime | None = None) -> str:
    now = now or datetime.now()
    return now.strftime("%B %Y")


def sync_html_stamps(site: Path, total_ratings: int, stamp: str) -> list[Path]:
    updated: list[Path] = []
    hero_re = re.compile(r"<h1>\d+ ratings\. One taste profile\.</h1>")
    hero_sub = f"<h1>{total_ratings} ratings. One taste profile.</h1>"
    foot_re = re.compile(
        r"(?:Silver Score &middot; )?[Bb]uilt from \d+ IMDb? ratings &middot; [^<\n]+",
    )
    foot_sub = f"Silver Score &middot; ~8,500+ hours &middot; 1,000+ titles &middot; {stamp}"
    foot_modern_re = re.compile(
        r"Silver Score &middot; (?:~8,500\+ hours &middot; 1,000\+ titles|~10,000 hours &middot; 1,000\+ titles|\d+ IMDb ratings) &middot; [A-Za-z]+ \d{4}"
    )
    foot_modern_sub = f"Silver Score &middot; ~8,500+ hours &middot; 1,000+ titles &middot; {stamp}"

    for html in [site / "index.html", *(site / "pages").glob("*.html")]:
        text = html.read_text(encoding="utf-8")
        new = hero_re.sub(hero_sub, text)
        new = foot_re.sub(foot_sub, new)
        new = foot_modern_re.sub(foot_modern_sub, new)
        if new != text:
            html.write_text(new, encoding="utf-8")
            updated.append(html)
    return updated


def main() -> int:
    site = _site_root()
    scripts_dir = Path(__file__).resolve().parent
    default_in = scripts_dir / "scraped-ratings.json"
    default_out = site / "assets" / "js" / "data.js"
    default_cache = scripts_dir / "wikidata-language-cache.json"

    p = argparse.ArgumentParser(description="Build data.js from scraped ratings JSON")
    p.add_argument(
        "--input",
        type=Path,
        default=default_in,
        help=f"Path to scraped JSON (default: {default_in})",
    )
    p.add_argument(
        "-o", "--output",
        type=Path,
        default=default_out,
        help=f"Output data.js path (default: {default_out})",
    )
    p.add_argument(
        "--language-cache",
        type=Path,
        default=default_cache,
        help=f"Wikidata language cache path (default: {default_cache})",
    )
    p.add_argument("--no-html", action="store_true", help="Skip HTML stamp updates")
    p.add_argument("--no-wikidata", action="store_true", help="Skip Wikidata queries (cache only)")
    args = p.parse_args()

    in_path = args.input.expanduser().resolve()
    if not in_path.is_file():
        print(f"error: input not found: {in_path}", file=sys.stderr)
        return 1

    try:
        data = load_data(in_path)
    except (ValueError, json.JSONDecodeError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    cache_path = args.language_cache.expanduser().resolve()
    enrich_languages(data, cache_path, use_wikidata=not args.no_wikidata)

    est_raw = compute_estimated_hours(data)
    # Summed runtimes often undercount TV; keep JSON in line with ~8.5k+ site copy until totals catch up.
    est_hours = max(est_raw, 8500)
    data["estimatedWatchHours"] = est_hours
    print(f"estimated watch hours: ~{est_hours:,}")

    out_path = args.output.expanduser().resolve()
    write_data_js(out_path, data)

    total = int(data["totalRatings"])
    stamp = footer_stamp()
    if not args.no_html:
        changed = sync_html_stamps(site, total, stamp)
        for path in changed:
            print(f"updated stamps: {path.relative_to(site)}")
    else:
        print("skipped HTML stamp sync (--no-html)")

    print(f"wrote {out_path.name} ({total} ratings, {data['mainItems']} main items)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
