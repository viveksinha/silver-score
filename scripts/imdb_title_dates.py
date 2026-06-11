"""Shared IMDb GraphQL premiere date lookups for build pipelines."""
from __future__ import annotations

import json
import re
import time
import urllib.error

from scrape_imdb import _gql_post, release_date_to_iso, year_from_imdb_title

TITLE_DATES_QUERY = """query($id: ID!) {
  title(id: $id) {
    releaseYear { year }
    releaseDate { day month year }
  }
}"""

DEFAULT_SLEEP_S = 0.25
_YEAR_ONLY_DISPLAY_RE = re.compile(r"^\d{4}$")


def is_concrete_iso(iso: str, *, unknown_date: str = "9999-12-31") -> bool:
    """True when iso is a real YYYY-MM-DD premiere (not TBD placeholder)."""
    if not iso or iso == unknown_date:
        return False
    return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", iso[:10]))


def is_year_only_display(display: str) -> bool:
    return bool(_YEAR_ONLY_DISPLAY_RE.match((display or "").strip()))


class ImdbDateEnricher:
    """Rate-limited, in-memory cached IMDb premiere lookups for one build run."""

    def __init__(self, *, sleep_s: float = DEFAULT_SLEEP_S) -> None:
        self.sleep_s = sleep_s
        self._cache: dict[str, dict | None] = {}
        self.graphql_fetches = 0

    def fetch_title_dates(self, imdb_id: str) -> dict | None:
        """Return IMDb title payload with releaseYear/releaseDate, or None."""
        if imdb_id in self._cache:
            return self._cache[imdb_id]
        try:
            resp = _gql_post(TITLE_DATES_QUERY, {"id": imdb_id})
        except (RuntimeError, urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
            self._cache[imdb_id] = None
            return None
        title = (resp.get("data") or {}).get("title")
        result = title if isinstance(title, dict) else None
        self._cache[imdb_id] = result
        self.graphql_fetches += 1
        if self.sleep_s > 0:
            time.sleep(self.sleep_s)
        return result

    def premiere_iso(self, imdb_id: str) -> str:
        title = self.fetch_title_dates(imdb_id)
        if not title:
            return ""
        return release_date_to_iso(title.get("releaseDate"))

    def premiere_year(self, imdb_id: str) -> int:
        title = self.fetch_title_dates(imdb_id)
        if not title:
            return 0
        return year_from_imdb_title(title.get("releaseYear"), title.get("releaseDate"))
