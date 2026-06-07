#!/usr/bin/env python3
"""Scrape IMDb user watchlist via GraphQL and write scraped-watchlist.json."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from scrape_imdb import (
    EPISODE_TYPES,
    PAGE_SIZE,
    PAGE_SLEEP,
    TYPE_MAP,
    _gql_post,
    resolve_user_id,
)

WATCHLIST_QUERY = """query($userId: ID!, $first: Int!, $after: ID) {
  predefinedList(userId: $userId, classType: WATCH_LIST) {
    id
    name { originalText }
    items(first: $first, after: $after) {
      total
      edges {
        node {
          itemId
          listItem {
            ... on Title {
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
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}"""


def _parse_title(t: dict) -> dict:
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

    return {
        "id": tid,
        "title": title_text,
        "originalTitle": orig_text,
        "year": year,
        "imdbRating": imdb_rating,
        "type": display_type,
        "genres": genres,
        "runtime": runtime_min,
        "votes": votes,
        "directors": directors,
        "url": f"https://www.imdb.com/title/{tid}",
    }


def fetch_all_watchlist(user_id: str, *, verbose: bool = False) -> tuple[str, list[dict]]:
    all_items: list[dict] = []
    cursor = None
    page = 0
    list_id = ""
    list_name = ""
    total = 0

    while True:
        page += 1
        variables: dict = {"userId": user_id, "first": PAGE_SIZE}
        if cursor:
            variables["after"] = cursor
        r = _gql_post(WATCHLIST_QUERY, variables, verbose=(verbose and page == 1))
        pl = r.get("data", {}).get("predefinedList")
        if not pl:
            errs = r.get("errors", [])
            raise RuntimeError(f"predefinedList query failed: {errs}")

        if not list_id:
            list_id = pl.get("id") or ""
            list_name = ((pl.get("name") or {}).get("originalText")) or "WATCHLIST"

        items_conn = pl.get("items") or {}
        total = items_conn.get("total") or total
        edges = items_conn.get("edges") or []
        for edge in edges:
            node = edge.get("node") or {}
            title = node.get("listItem")
            if title and title.get("id"):
                all_items.append(_parse_title(title))

        pi = items_conn.get("pageInfo") or {}
        print(f"  page {page}: fetched {len(edges)} items (total so far: {len(all_items)}/{total})")
        if not pi.get("hasNextPage"):
            break
        cursor = pi.get("endCursor")
        time.sleep(PAGE_SLEEP)

    return list_id, all_items


def main() -> int:
    p = argparse.ArgumentParser(description="Scrape IMDb watchlist to JSON")
    p.add_argument(
        "--profile-id",
        default=os.environ.get("IMDB_PROFILE_ID", ""),
        help="IMDb profile ID (p.XXX) or user ID (urXXX). Default: $IMDB_PROFILE_ID",
    )
    p.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent / "scraped-watchlist.json",
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

    print(f"fetching watchlist for {user_id}...")
    list_id, items = fetch_all_watchlist(user_id, verbose=args.verbose)
    print(f"fetched {len(items)} watchlist items")

    out_payload = {
        "meta": {
            "listId": list_id,
            "listName": "WATCHLIST",
            "total": len(items),
            "scrapedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "userId": user_id,
        },
        "items": items,
    }

    out = args.output.expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(out_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out} ({len(items)} items)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
