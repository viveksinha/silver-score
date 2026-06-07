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
    fetch_wikidata_language_info,
    is_english_label,
    language_info_from_export_field,
    normalize_language_label,
    parse_cache_entry,
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


def _manual_override(manual: dict, rid: str) -> dict | None:
    v = manual.get(rid)
    if v is None:
        return None
    if isinstance(v, str):
        return {"languageLabel": v.strip()}
    if isinstance(v, dict):
        return v
    return None


def enrich_languages(
    data: dict,
    cache_path: Path,
    *,
    use_wikidata: bool = True,
    overrides: dict | None = None,
) -> None:
    cache = _load_json_dict(cache_path)
    ids = sorted({item["id"] for item in data["allItems"] if item.get("id")})
    to_fetch = [i for i in ids if i not in cache]

    if use_wikidata and to_fetch:
        try:
            new = fetch_wikidata_language_info(to_fetch)
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
        iso = ""
        source = ""
        if rid in cache:
            cv = cache[rid]
            if cv is not False:
                lab, iso = parse_cache_entry(cv)
                source = "wikidata"
        if not source:
            exp_lab, exp_iso = language_info_from_export_field(item)
            if exp_lab or exp_iso not in ("", "unknown"):
                lab, iso = exp_lab, exp_iso
                source = "export"
        if is_english_label(lab):
            lab = ""
        if lab:
            lab = normalize_language_label(lab)
        if not iso:
            iso = "en" if source == "wikidata" and not lab else ("unknown" if not source else "en")
        if not source:
            source = "unknown"
        item["languageLabel"] = lab
        item["primaryLanguage"] = iso
        item["languageSource"] = source
        item.pop("languageHint", None)

        override = _manual_override(overrides or {}, rid)
        world_rail = override.get("worldRail") if override else None
        exclude_world_rail = override.get("excludeWorldRail") if override else None
        if world_rail is True:
            item["worldRail"] = True
        else:
            item.pop("worldRail", None)
        if exclude_world_rail is True:
            item["excludeWorldRail"] = True
        else:
            item.pop("excludeWorldRail", None)


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


def _format_title_count(main_items: int) -> str:
    return f"{main_items:,} titles"


def _patch_footer(text: str, *, main_items: int, stamp: str, index_page: bool) -> str:
    """Update footer month (and title count on non-index pages); preserve hours verbatim."""
    title_count = _format_title_count(main_items)
    foot_re = re.compile(
        r"(Silver Score &middot; )(.*?)( &middot; )(.*?)( &middot; )([A-Za-z]+ \d{4})"
    )

    def repl(m: re.Match[str]) -> str:
        prefix, hours, sep1, title_part, sep2, _month = m.groups()
        if index_page:
            return f"{prefix}{hours}{sep1}{title_part}{sep2}{stamp}"
        return f"{prefix}{hours}{sep1}{title_count}{sep2}{stamp}"

    return foot_re.sub(repl, text)


def sync_html_stamps(site: Path, total_ratings: int, main_items: int, stamp: str) -> list[Path]:
    updated: list[Path] = []
    hero_re = re.compile(r"<h1>\d+ ratings\. One taste profile\.</h1>")
    hero_sub = f"<h1>{total_ratings} ratings. One taste profile.</h1>"
    upcoming_html = (site / "pages" / "upcoming.html").resolve()

    for html in [site / "index.html", *(site / "pages").glob("*.html")]:
        if html.resolve() == upcoming_html:
            continue
        text = html.read_text(encoding="utf-8")
        new = hero_re.sub(hero_sub, text)
        new = _patch_footer(new, main_items=main_items, stamp=stamp, index_page=html.name == "index.html")
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
    overrides_path = site / "data" / "original-languages-overrides.json"
    overrides = _load_json_dict(overrides_path)
    enrich_languages(
        data,
        cache_path,
        use_wikidata=not args.no_wikidata,
        overrides=overrides,
    )

    # Scrape-only fields — keep out of public data.js
    data.pop("allRatedIds", None)

    out_path = args.output.expanduser().resolve()
    write_data_js(out_path, data)

    total = int(data["totalRatings"])
    stamp = footer_stamp()
    if not args.no_html:
        changed = sync_html_stamps(site, total, int(data["mainItems"]), stamp)
        for path in changed:
            print(f"updated stamps: {path.relative_to(site)}")
    else:
        print("skipped HTML stamp sync (--no-html)")

    print(f"wrote {out_path.name} ({total} ratings, {data['mainItems']} main items)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
