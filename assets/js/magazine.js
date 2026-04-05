/**
 * Editorial curated lists — IMDB title ids must exist in DATA.allItems.
 * Load after data.js on list pages.
 */
const MAGAZINE = {
  lists: [
    {
      slug: 'nordic-noir-and-neighbours',
      title: 'Nordic Noir & Neighbours',
      thesis:
        'Slow-burn crime from the north — moral grey zones, landscapes as character, and detectives who look tired in the right way.',
      spoiler: 'No spoilers',
      ids: [
        'tt1733785',
        'tt0826760',
        'tt1637727',
        'tt3561180',
        'tt1526318',
        'tt4088268',
        'tt2438644',
        'tt9100822',
        'tt10834220',
        'tt9466596',
        'tt31810018'
      ]
    },
    {
      slug: 'spy-thriller-escape',
      title: 'Spy & Thriller Escape Room',
      thesis:
        'Agencies, aliases, and anxiety — the shows we return to when we want competence porn with consequences.',
      spoiler: 'No spoilers',
      ids: [
        'tt4063800',
        'tt5875444',
        'tt10577736',
        'tt1796960',
        'tt7493974',
        'tt1399664',
        'tt15565872',
        'tt0080297'
      ]
    },
    {
      slug: 'prestige-tv-10s',
      title: 'Prestige TV That Earned the Label',
      thesis:
        'Series that justified the late nights — high craft, sharp writing, and finales we still argue about.',
      spoiler: 'No spoilers',
      ids: [
        'tt5491994',
        'tt7366338',
        'tt0944947',
        'tt2395695',
        'tt8420184',
        'tt1475582',
        'tt7660850',
        'tt2356777',
        'tt2802850',
        'tt27497448',
        'tt5753856',
        'tt2303687'
      ]
    }
  ],
  /** Short hub cards pointing at Upcoming (not full lists). */
  calendarHighlights: [
    {
      title: 'Korea on the calendar',
      dek: 'Film and series we’re tracking — on Upcoming, use the Korean filter on the timeline.',
      href: 'upcoming.html',
    },
    {
      title: 'French lane — releases we’re eyeing',
      dek: 'Filter Upcoming by French for the current strip.',
      href: 'upcoming.html',
    },
    {
      title: 'Japan — screens big and small',
      dek: 'Animated, live-action, and hybrids landing soon — Japanese tab on the upcoming timeline.',
      href: 'upcoming.html',
    },
  ],
};
