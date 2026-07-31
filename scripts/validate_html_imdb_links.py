#!/usr/bin/env python3
"""Validate IMDb title links in static HTML (essays, hubs) against IMDb GraphQL.

The data pipelines already validate ids in data.js/upcoming-data.js, but static
essay HTML is hand-written — a pasted wrong id survives forever (see the Nordic
noir The Killing/The Bridge mixup). This sweeps every imdb.com/title/tt* anchor
in index.html + pages/*.html, resolves the ids in batches, and warns when the
anchor text shares no significant word with the IMDb primary/original title.

Usage (from site/):
  python3 scripts/validate_html_imdb_links.py            # warnings only
  python3 scripts/validate_html_imdb_links.py --strict   # exit 1 on any warning
"""
from __future__ import annotations

import argparse
import html as html_mod
import json
import re
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path

GRAPHQL_URL = "https://api.graphql.imdb.com/"
BATCH = 25

# IMDb 403s self-identifying bot UAs; reuse the browser-like headers + retries
# that scrape_imdb/build_upcoming already use against the same endpoint.
try:
    from scrape_imdb import HEADERS as GQL_HEADERS, _gql_post
except ImportError:
    _gql_post = None
    GQL_HEADERS = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "x-imdb-client-name": "imdb-web-next",
        "x-imdb-user-country": "US",
    }


def _urlopen(req: urllib.request.Request, *, timeout: float = 60):
    # Same local-cert fallback as wikidata_languages.py (python.org builds on macOS).
    try:
        return urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.URLError as e:
        reason = str(getattr(e, "reason", e))
        if "certificate verify failed" in reason.lower():
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            return urllib.request.urlopen(req, timeout=timeout, context=ctx)
        raise

STOPWORDS = frozenset(
    {"the", "a", "an", "of", "and", "in", "on", "le", "la", "les", "der", "die", "das"}
)

ANCHOR_RE = re.compile(
    r'href="https?://(?:www\.)?imdb\.com/title/(tt\d+)/?[^"]*"[^>]*>(.*?)</a>',
    re.S,
)
TAG_RE = re.compile(r"<[^>]+>")


def tokens(s: str) -> set[str]:
    words = re.split(r"[^a-z0-9]+", s.lower())
    return {w for w in words if w and w not in STOPWORDS}


def collect_links(site: Path) -> list[tuple[Path, str, str]]:
    links: list[tuple[Path, str, str]] = []
    for html in [site / "index.html", *sorted((site / "pages").glob("*.html"))]:
        text = html.read_text(encoding="utf-8")
        for m in ANCHOR_RE.finditer(text):
            label = html_mod.unescape(TAG_RE.sub("", m.group(2))).strip()
            if label:
                links.append((html, m.group(1), label))
    return links


def fetch_titles(ids: list[str]) -> dict[str, dict]:
    """id -> {"title": str, "original": str, "year": int|None}; missing ids map to {}."""
    out: dict[str, dict] = {}
    for i in range(0, len(ids), BATCH):
        chunk = ids[i : i + BATCH]
        fields = " ".join(
            f't{n}: title(id: "{tid}") {{ titleText {{ text }} '
            f"originalTitleText {{ text }} releaseYear {{ year }} }}"
            for n, tid in enumerate(chunk)
        )
        query = "{" + fields + "}"
        if _gql_post is not None:
            payload = _gql_post(query)
        else:
            req = urllib.request.Request(
                GRAPHQL_URL,
                data=json.dumps({"query": query}).encode(),
                headers=GQL_HEADERS,
            )
            with _urlopen(req) as resp:
                payload = json.load(resp)
        data = payload.get("data") or {}
        for n, tid in enumerate(chunk):
            node = data.get(f"t{n}")
            if not node:
                out[tid] = {}
                continue
            out[tid] = {
                "title": ((node.get("titleText") or {}).get("text") or ""),
                "original": ((node.get("originalTitleText") or {}).get("text") or ""),
                "year": (node.get("releaseYear") or {}).get("year"),
            }
    return out


def main() -> int:
    p = argparse.ArgumentParser(description="Validate IMDb links in static HTML")
    p.add_argument("--strict", action="store_true", help="Exit non-zero on any warning")
    args = p.parse_args()

    site = Path(__file__).resolve().parent.parent
    links = collect_links(site)
    if not links:
        print("no imdb title links found in static HTML")
        return 0

    resolved = fetch_titles(sorted({tid for _, tid, _ in links}))
    warnings = 0
    for html, tid, label in links:
        info = resolved.get(tid)
        rel = html.relative_to(site)
        if not info:
            print(f"warning: {rel}: {tid} did not resolve on IMDb (label {label!r})", file=sys.stderr)
            warnings += 1
            continue
        label_tokens = tokens(label)
        imdb_tokens = tokens(info["title"]) | tokens(info["original"])
        if label_tokens and imdb_tokens and not (label_tokens & imdb_tokens):
            print(
                f"warning: {rel}: {tid} is {info['title']!r}"
                f" ({info['year']}) but the link text is {label!r}",
                file=sys.stderr,
            )
            warnings += 1

    checked = len(links)
    if warnings:
        print(f"{checked} links checked, {warnings} warning(s)", file=sys.stderr)
        return 1 if args.strict else 0
    print(f"{checked} links checked, all match")
    return 0


if __name__ == "__main__":
    sys.exit(main())
