/**
 * Editorial curated lists — rule-based filters over DATA.allItems.
 *
 * Load after data.js on list pages; list.html applies the filter in-browser
 * so new ratings flow in automatically on each data.js rebuild. DO NOT switch
 * back to hardcoded `ids: [...]` arrays — that approach caused real drift
 * (e.g. tt8108198, hand-entered as "The Wailing" in the Korean list, actually
 * resolves to the Hindi film "Andhadhun"; several other IDs in that list
 * resolved to unrelated titles or didn't exist in the data at all).
 *
 * Supported `filter` primitives (all optional, combined with AND semantics):
 *   languages:      ['Swedish', 'Korean', ...]   // languageLabel must match one
 *   nonEnglishOnly: true                         // languageLabel !== '' (build
 *                                                 //  blanks English)
 *   types:          ['Movie','TV Series',        // item.type must match one
 *                    'TV Mini Series']
 *   anyGenre:       ['Crime','Drama',...]        // genres must include >=1
 *   allGenres:      ['Drama']                    // genres must include all
 *   excludeGenres:  ['Action','Horror',...]      // genres must include none
 *   minMyRating:    9                            // myRating >= N
 *   minImdbRating:  7.5                          // imdbRating >= N
 *   minRuntimeMovie: 115                         // only applied when type ===
 *                                                 //  'Movie' (ignored for TV)
 *
 * Rules are the source of truth. Refreshing data.js never edits this file;
 * to tune a list, adjust its filter here. Hub ordering in stories.html is
 * automatic (by resulting row count, desc).
 */
const MAGAZINE = {
  lists: [
    {
      slug: 'nordic-noir-and-neighbours',
      title: 'Nordic Noir & Neighbours',
      thesis:
        'Slow-burn crime from the north — moral grey zones, landscapes as character, and detectives who look tired in the right way.',
      filter: {
        languages: ['Swedish', 'Danish', 'Norwegian', 'Icelandic', 'Finnish'],
        anyGenre: ['Crime', 'Thriller', 'Mystery', 'Drama'],
        minMyRating: 7,
      },
    },
    {
      slug: 'spy-thriller-escape',
      title: 'Spy & Thriller Escape Room',
      thesis:
        'Agencies, aliases, and anxiety — the shows we return to when we want people who are scary-good at hard jobs, with real stakes.',
      filter: {
        types: ['TV Series', 'TV Mini Series'],
        allGenres: ['Thriller'],
        minMyRating: 9,
      },
    },
    {
      slug: 'prestige-tv-10s',
      title: 'Prestige TV That Earned the Label',
      thesis:
        'Series that justified the late nights — high craft, sharp writing, and finales we still argue about.',
      filter: {
        types: ['TV Series', 'TV Mini Series'],
        allGenres: ['Drama'],
        minMyRating: 9,
      },
    },
    {
      slug: 'italian-crime-no-heroes',
      title: 'Italian Crime — No Heroes Allowed',
      thesis:
        'Naples, Rome, Calabria — Italian crime TV and film where the system is the villain and nobody gets a redemption arc.',
      filter: {
        languages: ['Italian'],
        anyGenre: ['Crime', 'Thriller', 'Drama'],
        minMyRating: 7,
      },
    },
    {
      slug: 'war-films-that-earned-it',
      title: 'War Films That Earned It',
      thesis:
        'No glory montages. These are the films and series where war costs something — told with craft, restraint, and respect for the weight of what happened.',
      filter: {
        allGenres: ['War'],
        minMyRating: 8,
      },
    },
    {
      slug: 'korean-cinema-sharp-edges',
      title: 'Korean Cinema — Sharp Edges',
      thesis:
        'Revenge, class warfare, and genre-bending that Hollywood still studies. The titles from South Korea we rate highest — and why the hype is earned.',
      filter: {
        languages: ['Korean'],
        minMyRating: 7,
      },
    },
    {
      slug: 'slow-burns-worth-patience',
      title: 'Slow Burns Worth the Patience',
      thesis:
        'Films and series that trust the audience enough to take their time — tension built from craft, not jump cuts. Worth every quiet minute.',
      // Tightened from "anyGenre Drama/Mystery/Thriller + myR>=9 + imdb>=7.5"
      // (175 rows, too broad) to a Drama-led rule that also requires good
      // IMDb reception and, for films, enough runtime to earn the "slow"
      // label. Excludes high-action / comedy / fantasy / horror genres where
      // "slow burn" is not the right framing.
      filter: {
        allGenres: ['Drama'],
        excludeGenres: [
          'Action', 'Adventure', 'Comedy', 'Horror', 'Fantasy', 'Sci-Fi',
          'Animation', 'Family', 'Musical', 'Sport', 'Western', 'War',
          'Romance',
        ],
        minMyRating: 9,
        minImdbRating: 7.8,
        minRuntimeMovie: 115,
      },
    },
    {
      slug: 'international-thrillers-beyond-english',
      title: 'International Thrillers — Beyond English',
      thesis:
        'The best tension doesn\'t need a shared language. Thrillers from France, Germany, Israel, India, and beyond — subtitles are a small price for this quality.',
      filter: {
        nonEnglishOnly: true,
        allGenres: ['Thriller'],
        minMyRating: 8,
      },
    },
  ],
  essays: [
    {
      slug: 'nordic-noir-deep-dive',
      title: 'Why Nordic Noir Works',
      dek: 'Landscape as character, silence as dialogue, and detectives who carry the weight of the case home. What makes Scandinavian crime drama different — and why we keep coming back.',
      href: 'essay-nordic-noir.html',
      tags: ['noir', 'tv', 'world']
    },
    {
      slug: 'spy-craft-on-screen',
      title: 'The Craft of Spy TV',
      dek: 'From The Bureau to Slow Horses: what separates great espionage television from action shows in trench coats. Tradecraft, paranoia, and the cost of loyalty.',
      href: 'essay-spy-craft.html',
      tags: ['spy', 'tv']
    },
    {
      slug: 'french-polar-tradition',
      title: 'The French Polar — Noir That Never Quit',
      dek: 'While Hollywood noir had to be rediscovered every generation, France kept its parallel tradition running — from Melville through Spiral and Le Bureau des Légendes.',
      href: 'essay-french-polar.html',
      tags: ['noir', 'spy', 'world', 'film']
    },
    {
      slug: 'slow-burns-manifesto',
      title: 'In Defence of Slow Burns',
      dek: 'Why the best thrillers make you wait. A case for patience, quiet tension, and stories that respect the audience enough to take their time.',
      href: 'essay-slow-burns.html',
      tags: ['craft']
    },
    {
      slug: 'limited-series-new-prestige',
      title: 'The Limited Series Is the New Prestige Film',
      dek: 'Six to eight episodes have absorbed the craft energy that used to define mid-budget prestige film. Where directors, writers, and leading actors go to say one big thing well.',
      href: 'essay-limited-series.html',
      tags: ['craft', 'tv']
    },
    {
      slug: 'subtitles-vs-dubbing',
      title: 'Subtitles, Dubbing, and What Gets Lost',
      dek: 'Dubbing swaps an actor\'s instrument for a session performer. Subtitles ask you to do a little work — and give you back the performance the director actually shot.',
      href: 'essay-subtitles.html',
      tags: ['world', 'craft']
    },
    {
      slug: 'radar-hunt-method',
      title: 'How We Find Under-the-Radar Gems',
      dek: 'Under the radar isn\'t a marketing tag — it\'s a rule. We rate 8+ while fewer than 50k people have voted on IMDb. That gap is where most of our favourites live.',
      href: 'essay-radar-hunt.html',
      tags: ['radar', 'method']
    },
    {
      slug: 'why-we-rewatch-mann',
      title: 'Why We Rewatch Michael Mann',
      dek: 'Nobody films men who take their work seriously like Michael Mann. Professionalism as drama, cities as pressure systems, and the shelf we keep going back to.',
      href: 'essay-rewatch-mann.html',
      tags: ['director', 'film']
    }
  ],
  calendarHighlights: [
    {
      title: 'Spy TV on the calendar',
      dek: 'The espionage lane we\'re watching for — new seasons of long-running covers, new ensembles, new agencies. More on Upcoming.',
      href: 'upcoming.html',
    },
    {
      title: 'Nordic noir — returning',
      dek: 'Scandinavian crime sequels and continuations we\'ve flagged for this year. More on Upcoming.',
      href: 'upcoming.html',
    },
    {
      title: 'British crime — dates to save',
      dek: 'UK procedurals, Sunday-night detectives, and BBC/ITV prestige we expect to rate high. More on Upcoming.',
      href: 'upcoming.html',
    },
    {
      title: 'Korea on the calendar',
      dek: 'Film and series we\'re watching for. More on Upcoming.',
      href: 'upcoming.html',
    },
    {
      title: 'French lane — releases we\'re eyeing',
      dek: 'French releases we\'re eyeing. More on Upcoming.',
      href: 'upcoming.html',
    },
    {
      title: 'Japan — screens big and small',
      dek: 'Animated, live-action, and hybrids landing soon. More on Upcoming.',
      href: 'upcoming.html',
    },
  ],
  radarHighlights: [
    {
      title: 'Recent gems — last 18 months',
      dek: 'Fresh 8+ picks with fewer than 50k IMDb votes. The quiet end of our recent log — the full ranked list is on the shelf.',
      href: 'hidden-gems.html',
    },
    {
      title: 'All-time quiet favourites',
      dek: 'Rewind mode: the full under-voted shelf, sorted by how far above the crowd we landed. Great for a weekend rabbit hole.',
      href: 'hidden-gems.html',
    },
    {
      title: 'Beyond English — under-voted',
      dek: 'World cinema and TV that hasn\'t gone loud yet. The shelf is where we keep the full list.',
      href: 'hidden-gems.html',
    },
    {
      title: 'Under-voted crime drama',
      dek: 'Sharp procedurals and moral-grey thrillers the crowd hasn\'t piled onto yet.',
      href: 'hidden-gems.html',
    },
    {
      title: 'Hidden Asian cinema',
      dek: 'Korean, Japanese, Thai, and Taiwanese titles we rated 8+ with under-50k vote counts.',
      href: 'hidden-gems.html',
    },
    {
      title: 'Forgotten 2010s',
      dek: 'The middle decade had more craft than the canon remembers. Our 2010s under-voted favourites live on the shelf.',
      href: 'hidden-gems.html',
    },
    {
      title: 'Quiet 9s and 10s',
      dek: 'The upper tail of our ratings inside the under-voted shelf — films and shows we\'d defend tomorrow, that almost nobody has heard of.',
      href: 'hidden-gems.html',
    },
    {
      title: 'How we find them',
      dek: 'The method behind the shelf — vote thresholds, director signals, and the three patterns we keep hitting. Read the piece.',
      href: 'essay-radar-hunt.html',
    },
  ],
};

const MAGAZINE_UTILS = {
  /**
   * Apply a list filter object against one item from DATA.allItems.
   * See the file-level docstring for the full list of supported primitives.
   */
  matchesFilter(item, filter) {
    if (!filter) return false;
    const genres = item.genres || [];
    const lang = item.languageLabel || '';
    if (filter.languages && filter.languages.length && !filter.languages.includes(lang)) return false;
    if (filter.nonEnglishOnly && !lang) return false;
    if (filter.types && filter.types.length && !filter.types.includes(item.type)) return false;
    if (filter.anyGenre && filter.anyGenre.length && !filter.anyGenre.some((g) => genres.includes(g))) return false;
    if (filter.allGenres && filter.allGenres.length && !filter.allGenres.every((g) => genres.includes(g))) return false;
    if (filter.excludeGenres && filter.excludeGenres.length && filter.excludeGenres.some((g) => genres.includes(g))) return false;
    if (typeof filter.minMyRating === 'number' && Number(item.myRating) < filter.minMyRating) return false;
    if (typeof filter.minImdbRating === 'number' && Number(item.imdbRating) < filter.minImdbRating) return false;
    if (typeof filter.minRuntimeMovie === 'number' && item.type === 'Movie') {
      const rt = Number(item.runtime);
      if (!isFinite(rt) || rt < filter.minRuntimeMovie) return false;
    }
    return true;
  },
  /** Rows from DATA.allItems matching a list's filter. */
  rowsForList(meta, allItems) {
    return (allItems || []).filter((i) => MAGAZINE_UTILS.matchesFilter(i, meta.filter));
  },
};

if (typeof window !== 'undefined') {
  window.MAGAZINE = MAGAZINE;
  window.MAGAZINE_UTILS = MAGAZINE_UTILS;
}
