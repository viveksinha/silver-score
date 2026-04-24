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
        'Agencies, aliases, and anxiety — the shows we return to when we want people who are scary-good at hard jobs, with real stakes.',
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
    },
    {
      slug: 'italian-crime-no-heroes',
      title: 'Italian Crime — No Heroes Allowed',
      thesis:
        'Naples, Rome, Calabria — Italian crime TV and film where the system is the villain and nobody gets a redemption arc.',
      spoiler: 'No spoilers',
      ids: [
        'tt2049116',
        'tt8465388',
        'tt4700844',
        'tt6723592',
        'tt7221388',
        'tt0080684',
        'tt0317248'
      ]
    },
    {
      slug: 'war-films-that-earned-it',
      title: 'War Films That Earned It',
      thesis:
        'No glory montages. These are the films and series where war costs something — told with craft, restraint, and respect for the weight of what happened.',
      spoiler: 'No spoilers',
      ids: [
        'tt0185906',
        'tt0120815',
        'tt1631867',
        'tt5765670',
        'tt2119532',
        'tt6763664',
        'tt3280150',
        'tt1568346',
        'tt0208092',
        'tt2306299',
        'tt1856101'
      ]
    },
    {
      slug: 'korean-cinema-sharp-edges',
      title: 'Korean Cinema — Sharp Edges',
      thesis:
        'Revenge, class warfare, and genre-bending that Hollywood still studies. The titles from South Korea we rate highest — and why the hype is earned.',
      spoiler: 'Light spoilers',
      ids: [
        'tt6751668',
        'tt0364569',
        'tt0353969',
        'tt0834228',
        'tt7131622',
        'tt10919420',
        'tt4016934',
        'tt8108198',
        'tt14921986',
        'tt9765440'
      ]
    },
    {
      slug: 'slow-burns-worth-patience',
      title: 'Slow Burns Worth the Patience',
      thesis:
        'Films and series that trust the audience enough to take their time — tension built from craft, not jump cuts. Worth every quiet minute.',
      spoiler: 'No spoilers',
      ids: [
        'tt0816692',
        'tt3170832',
        'tt7366338',
        'tt1856101',
        'tt1049413',
        'tt4975722',
        'tt5491994',
        'tt2802850',
        'tt2356777',
        'tt7660850',
        'tt0475784',
        'tt10919420'
      ]
    },
    {
      slug: 'international-thrillers-beyond-english',
      title: 'International Thrillers — Beyond English',
      thesis:
        'The best tension doesn\'t need a shared language. Thrillers from France, Germany, Israel, India, and beyond — subtitles are a small price for this quality.',
      spoiler: 'No spoilers',
      ids: [
        'tt4063800',
        'tt5834204',
        'tt4016934',
        'tt6751668',
        'tt6763664',
        'tt7131622',
        'tt1733785',
        'tt10577736',
        'tt3561180',
        'tt14921986'
      ]
    }
  ],
  essays: [
    {
      slug: 'nordic-noir-deep-dive',
      title: 'Why Nordic Noir Works',
      dek: 'Landscape as character, silence as dialogue, and detectives who carry the weight of the case home. What makes Scandinavian crime drama different — and why we keep coming back.',
      href: 'essay-nordic-noir.html'
    },
    {
      slug: 'spy-craft-on-screen',
      title: 'The Craft of Spy TV',
      dek: 'From The Bureau to Slow Horses: what separates great espionage television from action shows in trench coats. Tradecraft, paranoia, and the cost of loyalty.',
      href: 'essay-spy-craft.html'
    },
    {
      slug: 'slow-burns-manifesto',
      title: 'In Defence of Slow Burns',
      dek: 'Why the best thrillers make you wait. A case for patience, quiet tension, and stories that respect the audience enough to take their time.',
      href: 'essay-slow-burns.html'
    }
  ],
  calendarHighlights: [
    {
      title: 'Korea on the calendar',
      dek: 'Film and series we\'re watching for — on Upcoming, pick Korea.',
      href: 'upcoming.html',
    },
    {
      title: 'French lane — releases we\'re eyeing',
      dek: 'On Upcoming, pick French for what\'s landing next.',
      href: 'upcoming.html',
    },
    {
      title: 'Japan — screens big and small',
      dek: 'Animated, live-action, and hybrids landing soon — on Upcoming, pick Japan.',
      href: 'upcoming.html',
    },
  ],
};
