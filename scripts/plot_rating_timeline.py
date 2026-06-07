#!/usr/bin/env python3
"""Plot titles rated per month from scraped-ratings.json (dateRated). Output: PNG for local viewing only."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

import matplotlib.dates as mdates
import matplotlib.pyplot as plt


def month_key(iso: str) -> tuple[int, int] | None:
    s = (iso or "").strip()[:10]
    if len(s) < 7:
        return None
    try:
        y = int(s[0:4])
        m = int(s[5:7])
    except ValueError:
        return None
    if not (1 <= m <= 12):
        return None
    return (y, m)


def iter_months(start: tuple[int, int], end: tuple[int, int]):
    y, m = start
    ey, em = end
    while (y, m) <= (ey, em):
        yield (y, m)
        m += 1
        if m > 12:
            m = 1
            y += 1


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    default_in = root / "scripts" / "scraped-ratings.json"
    default_out = root.parent / "private" / "charts" / "ratings-by-month.png"

    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", type=Path, default=default_in, help="scraped-ratings.json path")
    p.add_argument("-o", "--output", type=Path, default=default_out, help="PNG output path")
    args = p.parse_args()

    in_path = args.input.expanduser().resolve()
    if not in_path.is_file():
        print(f"error: input not found: {in_path}", file=sys.stderr)
        return 1

    data = json.loads(in_path.read_text(encoding="utf-8"))
    items = data.get("allItems") or []
    counts: Counter[tuple[int, int]] = Counter()
    for it in items:
        k = month_key(str(it.get("dateRated") or ""))
        if k:
            counts[k] += 1

    if not counts:
        print("error: no dateRated values found", file=sys.stderr)
        return 1

    start = min(counts)
    end = max(counts)
    months = list(iter_months(start, end))
    xs = [datetime(y, m, 15) for y, m in months]
    ys = [counts[(y, m)] for y, m in months]

    fig, ax = plt.subplots(figsize=(14, 5), dpi=120)
    ax.plot(xs, ys, color="#c2410c", linewidth=1.8, marker="o", markersize=3, alpha=0.9)
    ax.fill_between(xs, ys, alpha=0.12, color="#c2410c")
    ax.set_title("Titles logged per month (IMDb dateRated)", fontsize=14, fontweight="600", pad=12)
    ax.set_xlabel("Month")
    ax.set_ylabel("Count")
    ax.grid(True, alpha=0.25, linestyle="-")
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=3))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    fig.autofmt_xdate(rotation=35)
    ax.set_ylim(bottom=0)
    fig.tight_layout()

    out = args.output.expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, bbox_inches="tight")
    plt.close(fig)
    print(f"wrote {out} ({len(items)} items, {len(months)} months)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
