#!/usr/bin/env python3
"""Scrape IMDB user ratings via the public GraphQL API and output ratings-export-compatible JSON."""
from __future__ import annotations

import argparse
import json
import math
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

GQL_URL = "https://api.graphql.imdb.com/"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": UA,
    "x-imdb-client-name": "imdb-web-next",
    "x-imdb-user-country": "US",
}

PAGE_SIZE = 250
PAGE_SLEEP = 1.5
MAX_RETRIES = 3


def _ssl_ctx() -> ssl.SSLContext:
    try:
        return ssl.create_default_context()
    except Exception:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx


def _gql_post(query: str, variables: dict | None = None, *, verbose: bool = False) -> dict:
    payload = json.dumps({"query": query, "variables": variables or {}}).encode()
    ctx = _ssl_ctx()
    for attempt in range(MAX_RETRIES):
        req = urllib.request.Request(GQL_URL, data=payload, method="POST", headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
                data = json.loads(resp.read().decode())
                if verbose and attempt == 0:
                    print(json.dumps(data, indent=2)[:2000], file=sys.stderr)
                return data
        except urllib.error.URLError as e:
            reason = str(getattr(e, "reason", e))
            if "CERTIFICATE_VERIFY_FAILED" in reason:
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                continue
            if hasattr(e, "code") and e.code in (429, 500, 502, 503):
                wait = 2 ** (attempt + 1)
                print(f"  retrying in {wait}s (HTTP {e.code})...", file=sys.stderr)
                time.sleep(wait)
                continue
            raise
        except TimeoutError:
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** (attempt + 1))
                continue
            raise
    raise RuntimeError("Max retries exceeded")


def resolve_user_id(profile_id: str) -> str:
    q = 'query { userProfile(input: { profileId: "%s" }) { userId } }' % profile_id
    r = _gql_post(q)
    uid = r.get("data", {}).get("userProfile", {}).get("userId")
    if not uid:
        raise RuntimeError(f"Could not resolve profile {profile_id}: {r}")
    return uid


RATINGS_QUERY = """query($userId: ID!, $first: Int!, $after: String) {
  userRatings(userId: $userId, first: $first, after: $after) {
    total
    edges {
      node {
        title {
          id
          titleText { text }
          originalTitleText { text }
          releaseYear { year }
          titleType { id text }
          ratingsSummary { aggregateRating voteCount }
          runtime { seconds }
          genres { genres { text } }
          directors: credits(first: 5, filter: { categories: ["director"] }) {
            edges { node { name { nameText { text } } } }
          }
        }
        userRating { value date }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}"""

TYPE_MAP = {
    "movie": "Movie",
    "tvSeries": "TV Series",
    "tvMiniSeries": "TV Mini Series",
    "tvEpisode": "TV Episode",
    "tvMovie": "TV Movie",
    "tvSpecial": "TV Special",
    "podcastSeries": "Podcast Series",
    "video": "Video",
    "short": "Short",
    "videoGame": "Video Game",
    "musicVideo": "Music Video",
}

EPISODE_TYPES = {"TV Episode"}


def _parse_item(edge: dict) -> dict:
    node = edge["node"]
    t = node["title"]
    ur = node.get("userRating") or {}
    tid = t["id"]
    title_text = (t.get("titleText") or {}).get("text") or ""
    orig_text = (t.get("originalTitleText") or {}).get("text") or title_text
    year = (t.get("releaseYear") or {}).get("year") or 0
    tt = t.get("titleType") or {}
    type_id = tt.get("id") or "movie"
    type_text = tt.get("text") or TYPE_MAP.get(type_id, type_id)
    display_type = TYPE_MAP.get(type_id, type_text)
    rs = t.get("ratingsSummary") or {}
    imdb_rating = rs.get("aggregateRating") or 0
    votes = rs.get("voteCount") or 0
    runtime_sec = (t.get("runtime") or {}).get("seconds") or 0
    runtime_min = round(runtime_sec / 60) if runtime_sec else 0
    genres = [g["text"] for g in ((t.get("genres") or {}).get("genres") or [])]
    directors_edges = (t.get("directors") or {}).get("edges") or []
    directors = ", ".join(
        e["node"]["name"]["nameText"]["text"]
        for e in directors_edges
        if e.get("node", {}).get("name", {}).get("nameText", {}).get("text")
    )
    my_rating = ur.get("value") or 0
    date_str = ur.get("date") or ""
    date_rated = date_str[:10] if date_str else ""

    return {
        "id": tid,
        "title": title_text,
        "originalTitle": orig_text,
        "year": year,
        "myRating": my_rating,
        "imdbRating": imdb_rating,
        "type": display_type,
        "genres": genres,
        "runtime": runtime_min,
        "votes": votes,
        "dateRated": date_rated,
        "directors": directors,
        "url": f"https://www.imdb.com/title/{tid}",
    }


def fetch_all_ratings(user_id: str, *, verbose: bool = False) -> list[dict]:
    all_items: list[dict] = []
    cursor = None
    page = 0
    while True:
        page += 1
        variables: dict = {"userId": user_id, "first": PAGE_SIZE}
        if cursor:
            variables["after"] = cursor
        r = _gql_post(RATINGS_QUERY, variables, verbose=(verbose and page == 1))
        ur = r.get("data", {}).get("userRatings")
        if not ur:
            errs = r.get("errors", [])
            raise RuntimeError(f"userRatings query failed: {errs}")
        edges = ur.get("edges") or []
        for edge in edges:
            all_items.append(_parse_item(edge))
        pi = ur.get("pageInfo") or {}
        total = ur.get("total", "?")
        print(f"  page {page}: fetched {len(edges)} items (total so far: {len(all_items)}/{total})")
        if not pi.get("hasNextPage"):
            break
        cursor = pi.get("endCursor")
        time.sleep(PAGE_SLEEP)
    return all_items


def compute_stats(all_rated: list[dict]) -> dict:
    main_items = [i for i in all_rated if i["type"] not in EPISODE_TYPES]
    total_ratings = len(all_rated)
    main_count = len(main_items)
    avg_rating = round(sum(i["myRating"] for i in main_items) / main_count, 2) if main_count else 0

    # ratingDistribution
    rating_counts: dict[int, int] = defaultdict(int)
    for i in main_items:
        rating_counts[i["myRating"]] += 1
    rating_dist = [{"rating": r, "count": rating_counts.get(r, 0)} for r in range(10, 0, -1)]

    # genreStats
    genre_my: dict[str, list[int]] = defaultdict(list)
    genre_imdb: dict[str, list[float]] = defaultdict(list)
    for i in main_items:
        for g in i["genres"]:
            genre_my[g].append(i["myRating"])
            genre_imdb[g].append(i["imdbRating"])
    genre_stats = sorted(
        [
            {
                "genre": g,
                "count": len(genre_my[g]),
                "avgMyRating": round(sum(genre_my[g]) / len(genre_my[g]), 2),
                "avgImdbRating": round(sum(genre_imdb[g]) / len(genre_imdb[g]), 2),
            }
            for g in genre_my
        ],
        key=lambda x: -x["count"],
    )

    # decadeStats
    decade_ratings: dict[str, list[int]] = defaultdict(list)
    for i in main_items:
        if i["year"]:
            dec = f"{(i['year'] // 10) * 10}s"
            decade_ratings[dec].append(i["myRating"])
    decade_stats = sorted(
        [
            {
                "decade": d,
                "count": len(decade_ratings[d]),
                "avg": round(sum(decade_ratings[d]) / len(decade_ratings[d]), 2),
            }
            for d in decade_ratings
        ],
        key=lambda x: x["decade"],
    )

    # typeStats (includes episodes)
    type_counts: dict[str, int] = defaultdict(int)
    for i in all_rated:
        type_counts[i["type"]] += 1
    type_stats = sorted(
        [{"type": t, "count": c} for t, c in type_counts.items()],
        key=lambda x: -x["count"],
    )

    # directorStats
    dir_ratings: dict[str, list[int]] = defaultdict(list)
    for i in main_items:
        if i["directors"]:
            for d in i["directors"].split(", "):
                d = d.strip()
                if d:
                    dir_ratings[d].append(i["myRating"])
    director_stats = sorted(
        [
            {
                "name": d,
                "count": len(ratings),
                "avg": round(sum(ratings) / len(ratings), 2),
            }
            for d, ratings in dir_ratings.items()
            if len(ratings) >= 3
        ],
        key=lambda x: (-x["avg"], -x["count"]),
    )[:25]

    # topRated: 10s first, then 9s, up to 80
    top = sorted(main_items, key=lambda i: (-i["myRating"], -i["imdbRating"]))[:80]

    # bottomRated: 1s first, then 2s, up to 30
    bottom = sorted(main_items, key=lambda i: (i["myRating"], i["imdbRating"]))[:30]

    # lovedMore: gap >= 1.5
    loved = []
    for i in main_items:
        gap = round(i["myRating"] - i["imdbRating"], 1)
        if gap >= 1.5:
            item_copy = dict(i)
            item_copy["gap"] = gap
            loved.append(item_copy)
    loved.sort(key=lambda x: -x["gap"])
    loved = loved[:30]

    return {
        "totalRatings": total_ratings,
        "mainItems": main_count,
        "avgRating": avg_rating,
        "ratingDistribution": rating_dist,
        "genreStats": genre_stats,
        "decadeStats": decade_stats,
        "typeStats": type_stats,
        "directorStats": director_stats,
        "topRated": top,
        "bottomRated": bottom,
        "lovedMore": loved,
        "allItems": main_items,
    }


def main() -> int:
    p = argparse.ArgumentParser(description="Scrape IMDB ratings and output export-compatible JSON")
    p.add_argument(
        "--profile-id",
        default=os.environ.get("IMDB_PROFILE_ID", ""),
        help="IMDB profile ID (p.XXX) or user ID (urXXX). Default: $IMDB_PROFILE_ID",
    )
    p.add_argument(
        "-o", "--output",
        type=Path,
        default=Path(__file__).resolve().parent / "scraped-ratings.json",
        help="Output JSON path",
    )
    p.add_argument("--verbose", action="store_true", help="Print first GraphQL response to stderr")
    args = p.parse_args()

    pid = args.profile_id
    if not pid:
        print("error: provide --profile-id or set IMDB_PROFILE_ID", file=sys.stderr)
        return 1

    if pid.startswith("p."):
        print(f"resolving profile {pid}...")
        user_id = resolve_user_id(pid)
        print(f"  → user ID: {user_id}")
    else:
        user_id = pid

    print(f"fetching ratings for {user_id}...")
    all_rated = fetch_all_ratings(user_id, verbose=args.verbose)
    print(f"fetched {len(all_rated)} rated items")

    print("computing stats...")
    export = compute_stats(all_rated)

    out = args.output.expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(export, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out} ({export['totalRatings']} ratings, {export['mainItems']} main items)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
