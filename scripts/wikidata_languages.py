"""Fetch original film/TV language labels from Wikidata (P345 = IMDb id, P364 = language).

This module exists twice: movies/scripts/ (export builder) and site/scripts/ (GitHub Actions).
Edits must be applied to both copies so they stay byte-identical.
"""

from __future__ import annotations

import json
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request


def _urlopen(req: urllib.request.Request, *, timeout: float = 120):
    try:
        return urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.URLError as e:
        reason = str(getattr(e, "reason", e))
        if "CERTIFICATE_VERIFY_FAILED" in reason or "certificate verify failed" in reason.lower():
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            return urllib.request.urlopen(req, timeout=timeout, context=ctx)
        raise

UA = "SilverScoreBuild/1.0 (https://github.com/viveksinha/silver-score; local build)"

ISO_639_1 = {
    "aa": "Afar",
    "ab": "Abkhazian",
    "af": "Afrikaans",
    "ak": "Akan",
    "am": "Amharic",
    "ar": "Arabic",
    "as": "Assamese",
    "ay": "Aymara",
    "az": "Azerbaijani",
    "ba": "Bashkir",
    "be": "Belarusian",
    "bg": "Bulgarian",
    "bn": "Bengali",
    "bo": "Tibetan",
    "br": "Breton",
    "bs": "Bosnian",
    "ca": "Catalan",
    "cs": "Czech",
    "cy": "Welsh",
    "da": "Danish",
    "de": "German",
    "dv": "Divehi",
    "dz": "Dzongkha",
    "el": "Greek",
    "en": "",
    "eo": "Esperanto",
    "es": "Spanish",
    "et": "Estonian",
    "eu": "Basque",
    "fa": "Persian",
    "ff": "Fulah",
    "fi": "Finnish",
    "fo": "Faroese",
    "fr": "French",
    "fy": "Western Frisian",
    "ga": "Irish",
    "gd": "Scottish Gaelic",
    "gl": "Galician",
    "gn": "Guarani",
    "gu": "Gujarati",
    "gv": "Manx",
    "ha": "Hausa",
    "he": "Hebrew",
    "hi": "Hindi",
    "hr": "Croatian",
    "ht": "Haitian Creole",
    "hu": "Hungarian",
    "hy": "Armenian",
    "ia": "Interlingua",
    "id": "Indonesian",
    "ie": "Interlingue",
    "ig": "Igbo",
    "ik": "Inupiaq",
    "is": "Icelandic",
    "it": "Italian",
    "iu": "Inuktitut",
    "ja": "Japanese",
    "jv": "Javanese",
    "ka": "Georgian",
    "kg": "Kongo",
    "ki": "Kikuyu",
    "kk": "Kazakh",
    "kl": "Greenlandic",
    "km": "Khmer",
    "kn": "Kannada",
    "ko": "Korean",
    "ks": "Kashmiri",
    "ku": "Kurdish",
    "kv": "Komi",
    "kw": "Cornish",
    "ky": "Kyrgyz",
    "la": "Latin",
    "lb": "Luxembourgish",
    "lg": "Ganda",
    "li": "Limburgish",
    "ln": "Lingala",
    "lo": "Lao",
    "lt": "Lithuanian",
    "lu": "Luba-Katanga",
    "lv": "Latvian",
    "mg": "Malagasy",
    "mh": "Marshallese",
    "mi": "Maori",
    "mk": "Macedonian",
    "ml": "Malayalam",
    "mn": "Mongolian",
    "mr": "Marathi",
    "ms": "Malay",
    "mt": "Maltese",
    "my": "Burmese",
    "na": "Nauru",
    "nb": "Norwegian Bokmål",
    "nd": "North Ndebele",
    "ne": "Nepali",
    "nl": "Dutch",
    "nn": "Norwegian Nynorsk",
    "no": "Norwegian",
    "nr": "South Ndebele",
    "nv": "Navajo",
    "ny": "Chichewa",
    "oc": "Occitan",
    "oj": "Ojibwe",
    "om": "Oromo",
    "or": "Odia",
    "os": "Ossetian",
    "pa": "Punjabi",
    "pi": "Pali",
    "pl": "Polish",
    "ps": "Pashto",
    "pt": "Portuguese",
    "qu": "Quechua",
    "rm": "Romansh",
    "rn": "Rundi",
    "ro": "Romanian",
    "ru": "Russian",
    "rw": "Kinyarwanda",
    "sa": "Sanskrit",
    "sc": "Sardinian",
    "sd": "Sindhi",
    "se": "Northern Sami",
    "sg": "Sango",
    "si": "Sinhala",
    "sk": "Slovak",
    "sl": "Slovenian",
    "sm": "Samoan",
    "sn": "Shona",
    "so": "Somali",
    "sq": "Albanian",
    "sr": "Serbian",
    "ss": "Swati",
    "st": "Southern Sotho",
    "su": "Sundanese",
    "sv": "Swedish",
    "sw": "Swahili",
    "ta": "Tamil",
    "te": "Telugu",
    "tg": "Tajik",
    "th": "Thai",
    "ti": "Tigrinya",
    "tk": "Turkmen",
    "tl": "Tagalog",
    "tn": "Tswana",
    "to": "Tongan",
    "tr": "Turkish",
    "ts": "Tsonga",
    "tt": "Tatar",
    "tw": "Twi",
    "ty": "Tahitian",
    "ug": "Uyghur",
    "uk": "Ukrainian",
    "ur": "Urdu",
    "uz": "Uzbek",
    "ve": "Venda",
    "vi": "Vietnamese",
    "wa": "Walloon",
    "wo": "Wolof",
    "xh": "Xhosa",
    "yi": "Yiddish",
    "yo": "Yoruba",
    "za": "Zhuang",
    "zh": "Chinese",
    "zu": "Zulu",
}


def language_label_from_export_field(item: dict) -> str:
    """Use optional export fields originalLanguage / primaryLanguage (codes or names)."""
    raw = item.get("originalLanguage") or item.get("primaryLanguage")
    if not raw:
        return ""
    if isinstance(raw, list):
        parts = [str(p).strip() for p in raw if p]
    else:
        parts = [p.strip() for p in str(raw).split(",") if p.strip()]
    for p in parts:
        pl = p.lower()
        if pl in ("en", "eng", "english"):
            continue
        if len(p) == 2 and p.isalpha():
            name = ISO_639_1.get(pl)
            if name is not None:
                return name
            return p.upper()
        return p[:1].upper() + p[1:] if p else ""
    return ""


def fetch_wikidata_language_labels(
    imdb_ids: list[str],
    *,
    batch_size: int = 70,
    sleep_s: float = 1.2,
) -> dict[str, str]:
    """Return imdb id -> display label; English -> empty string. Missing ids omitted."""
    out: dict[str, str] = {}
    for i in range(0, len(imdb_ids), batch_size):
        chunk = imdb_ids[i : i + batch_size]
        vals = " ".join(f'"{x}"' for x in chunk)
        query = f"""SELECT ?imdb (SAMPLE(?langLabel) AS ?langLabel) WHERE {{
          VALUES ?imdb {{ {vals} }}
          ?item wdt:P345 ?imdb .
          ?item wdt:P364 ?l .
          ?l rdfs:label ?langLabel .
          FILTER(LANG(?langLabel) = "en")
        }} GROUP BY ?imdb"""
        body = urllib.parse.urlencode({"query": query}).encode()
        req = urllib.request.Request(
            "https://query.wikidata.org/sparql",
            data=body,
            method="POST",
            headers={
                "User-Agent": UA,
                "Accept": "application/sparql-results+json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        try:
            with _urlopen(req, timeout=120) as resp:
                payload = json.loads(resp.read().decode())
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            raise
        for b in payload.get("results", {}).get("bindings", []):
            imdb = b["imdb"]["value"]
            lab = b["langLabel"]["value"]
            out[imdb] = "" if lab.lower() == "english" else lab
        if i + batch_size < len(imdb_ids):
            time.sleep(sleep_s)
    return out
